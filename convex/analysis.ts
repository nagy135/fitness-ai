import { ConvexError, v } from 'convex/values';
import {
  calculateVolume,
  estimate1RM,
  groupWorkoutsByMonth,
  groupWorkoutsByWeek,
} from '@fitness/domain';
import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { query } from './_generated/server';
import { requireUserProfile } from './lib/auth';

const dateRangeArgs = { from: v.optional(v.string()), to: v.optional(v.string()) };

function bounds(from?: string, to?: string) {
  return {
    from: from ? Date.parse(`${from}T00:00:00.000Z`) : 0,
    to: to ? Date.parse(`${to}T23:59:59.999Z`) : Number.MAX_SAFE_INTEGER,
  };
}

async function workoutsInRange(
  ctx: QueryCtx,
  userId: Id<'userProfiles'>,
  from?: string,
  to?: string,
) {
  const range = bounds(from, to);
  const workouts = await ctx.db
    .query('workouts')
    .withIndex('by_user_performed', (q) =>
      q.eq('userId', userId).gte('performedAt', range.from).lte('performedAt', range.to),
    )
    .collect();
  return workouts.sort((a, b) => a.performedAt - b.performedAt);
}

function exerciseSessions(workouts: Doc<'workouts'>[], exerciseId: Id<'exercises'>) {
  return workouts.flatMap((workout) =>
    workout.exercises
      .filter((exercise) => exercise.exerciseId === exerciseId)
      .map((exercise) => ({
        workoutId: workout._id,
        performedAt: workout.performedAt,
        name: exercise.nameSnapshot,
        sets: exercise.sets,
        volume: calculateVolume(exercise.sets),
      })),
  );
}

async function requireOwnedExercise(
  ctx: QueryCtx,
  exerciseId: Id<'exercises'>,
  userId: Id<'userProfiles'>,
) {
  const exercise = await ctx.db.get(exerciseId);
  if (!exercise || exercise.userId !== userId) throw new ConvexError('Exercise not found');
  return exercise;
}

export const searchWorkouts = query({
  args: { query: v.string(), limit: v.optional(v.number()), ...dateRangeArgs },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const workouts = await workoutsInRange(ctx, user._id, args.from, args.to);
    const needle = args.query.trim().toLocaleLowerCase('en-US');
    return workouts
      .filter(
        (workout) =>
          workout.notes?.toLocaleLowerCase('en-US').includes(needle) ||
          workout.exercises.some((exercise) =>
            exercise.nameSnapshot.toLocaleLowerCase('en-US').includes(needle),
          ),
      )
      .slice(-(args.limit ?? 20))
      .reverse();
  },
});

export const getExerciseHistory = query({
  args: { exerciseId: v.id('exercises'), ...dateRangeArgs },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    await requireOwnedExercise(ctx, args.exerciseId, user._id);
    return exerciseSessions(
      await workoutsInRange(ctx, user._id, args.from, args.to),
      args.exerciseId,
    );
  },
});

export const getExerciseStats = query({
  args: { exerciseId: v.id('exercises'), ...dateRangeArgs },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const exercise = await requireOwnedExercise(ctx, args.exerciseId, user._id);
    const sessions = exerciseSessions(
      await workoutsInRange(ctx, user._id, args.from, args.to),
      args.exerciseId,
    );
    const estimated = sessions.map((session) =>
      Math.max(
        0,
        ...session.sets.map((set) =>
          set.weightKg && set.reps ? estimate1RM(set.weightKg, set.reps) : 0,
        ),
      ),
    );
    const maxWeights = sessions.map((session) =>
      Math.max(0, ...session.sets.map((set) => set.weightKg ?? 0)),
    );
    return {
      exercise: { id: exercise._id, name: exercise.name },
      sessions: sessions.length,
      firstSession: sessions.at(0)?.performedAt,
      latestSession: sessions.at(-1)?.performedAt,
      estimated1RM: {
        first: estimated.at(0),
        latest: estimated.at(-1),
        best: Math.max(0, ...estimated),
      },
      maximumWeight: {
        first: maxWeights.at(0),
        latest: maxWeights.at(-1),
        best: Math.max(0, ...maxWeights),
      },
      totalVolume: sessions.reduce((total, session) => total + session.volume, 0),
    };
  },
});

export const getPersonalRecords = query({
  args: { exerciseId: v.id('exercises'), ...dateRangeArgs },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    await requireOwnedExercise(ctx, args.exerciseId, user._id);
    const sessions = exerciseSessions(
      await workoutsInRange(ctx, user._id, args.from, args.to),
      args.exerciseId,
    );
    const attempts = sessions.flatMap((session) =>
      session.sets.map((set) => ({
        workoutId: session.workoutId,
        performedAt: session.performedAt,
        ...set,
        estimated1RM: set.weightKg && set.reps ? estimate1RM(set.weightKg, set.reps) : undefined,
      })),
    );
    const by = (field: 'weightKg' | 'reps' | 'estimated1RM') =>
      attempts.reduce<(typeof attempts)[number] | null>(
        (best, set) => ((set[field] ?? -1) > (best?.[field] ?? -1) ? set : best),
        null,
      );
    return {
      maximumWeight: by('weightKg'),
      maximumReps: by('reps'),
      estimated1RM: by('estimated1RM'),
    };
  },
});

function volumeGroups(workouts: Doc<'workouts'>[], period: 'week' | 'month') {
  const groups = period === 'week' ? groupWorkoutsByWeek(workouts) : groupWorkoutsByMonth(workouts);
  return [...groups.entries()]
    .map(([key, group]) => ({
      period: key,
      workouts: group.length,
      volume: group.reduce(
        (total, workout) =>
          total +
          workout.exercises.reduce(
            (exerciseTotal, exercise) => exerciseTotal + calculateVolume(exercise.sets),
            0,
          ),
        0,
      ),
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

export const getWeeklyVolume = query({
  args: dateRangeArgs,
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    return volumeGroups(await workoutsInRange(ctx, user._id, args.from, args.to), 'week');
  },
});

export const getMonthlyVolume = query({
  args: dateRangeArgs,
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    return volumeGroups(await workoutsInRange(ctx, user._id, args.from, args.to), 'month');
  },
});

export const compareExercises = query({
  args: { exerciseIds: v.array(v.id('exercises')), ...dateRangeArgs },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const workouts = await workoutsInRange(ctx, user._id, args.from, args.to);
    return Promise.all(
      args.exerciseIds.map(async (exerciseId) => {
        const exercise = await requireOwnedExercise(ctx, exerciseId, user._id);
        const sessions = exerciseSessions(workouts, exerciseId);
        const first = sessions.at(0);
        const latest = sessions.at(-1);
        const best1RM = (session: (typeof sessions)[number] | undefined) =>
          Math.max(
            0,
            ...(session?.sets.map((set) =>
              set.weightKg && set.reps ? estimate1RM(set.weightKg, set.reps) : 0,
            ) ?? []),
          );
        return {
          exerciseId,
          name: exercise.name,
          sessions: sessions.length,
          firstEstimated1RM: best1RM(first),
          latestEstimated1RM: best1RM(latest),
          changePercent: best1RM(first)
            ? ((best1RM(latest) - best1RM(first)) / best1RM(first)) * 100
            : null,
        };
      }),
    );
  },
});

export const getExerciseFrequency = query({
  args: { exerciseId: v.id('exercises'), ...dateRangeArgs },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    await requireOwnedExercise(ctx, args.exerciseId, user._id);
    const sessions = exerciseSessions(
      await workoutsInRange(ctx, user._id, args.from, args.to),
      args.exerciseId,
    );
    return {
      sessions: sessions.length,
      trainingDays: new Set(sessions.map((item) => item.performedAt)).size,
    };
  },
});

export const getTrainingDays = query({
  args: dateRangeArgs,
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const workouts = await workoutsInRange(ctx, user._id, args.from, args.to);
    return workouts.map((workout) => ({
      workoutId: workout._id,
      performedAt: workout.performedAt,
      exercises: workout.exercises.map((exercise) => exercise.nameSnapshot),
    }));
  },
});
