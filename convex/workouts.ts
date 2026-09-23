import { ConvexError, v } from 'convex/values';
import { normalizeSetForTrackingType } from '@fitness/domain';
import { internalQuery, mutation, query } from './_generated/server';
import { assertWorkoutRequest } from './lib/workoutRequest';
import { currentForUser } from './workoutDrafts';
import { validateTrackedSet } from './lib/draftValidation';
import { requireUserProfile } from './lib/auth';

export const get = query({
  args: { workoutId: v.id('workouts') },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const workout = await ctx.db.get(args.workoutId);
    if (!workout || workout.userId !== user._id) throw new ConvexError('Workout not found');
    return workout;
  },
});

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    return ctx.db
      .query('workouts')
      .withIndex('by_user_performed', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(Math.min(args.limit ?? 10, 50));
  },
});

export const remove = mutation({
  args: { workoutId: v.id('workouts') },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const workout = await ctx.db.get(args.workoutId);
    if (!workout || workout.userId !== user._id) throw new ConvexError('Workout not found');
    await ctx.db.delete(workout._id);
    // Keep the confirmation receipt so a retried confirmation cannot recreate history.
  },
});

// History edits use the same validated draft tools as a new workout. The ordinary
// draft stays intact and becomes current again when this editing draft is removed.
export const beginEdit = mutation({
  args: { workoutId: v.id('workouts') },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const workout = await ctx.db.get(args.workoutId);
    if (!workout || workout.userId !== user._id) throw new ConvexError('Workout not found');
    const current = await currentForUser(ctx, user._id);
    if (current?.editingWorkoutId === workout._id) return current._id;
    if (current?.editingWorkoutId)
      throw new ConvexError('Save or cancel your current history edit first');
    await assertWorkoutRequest(ctx, user._id, workout.sourceDraftId, { source: 'user_ui' });
    const now = Date.now();
    return ctx.db.insert('workoutDrafts', {
      userId: user._id,
      editingWorkoutId: workout._id,
      name: workout.name,
      date: new Date(workout.performedAt).toISOString().slice(0, 10),
      status: 'active',
      exercises: workout.exercises.map((row) => ({
        rowId: crypto.randomUUID(),
        exerciseId: row.exerciseId,
        name: row.nameSnapshot,
        notes: row.notes,
        sets: row.sets.map((set) => ({ ...set, setId: crypto.randomUUID() })),
      })),
      notes: workout.notes,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const cancelEdit = mutation({
  args: { draftId: v.id('workoutDrafts') },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft) return;
    if (draft.userId !== user._id || !draft.editingWorkoutId)
      throw new ConvexError('History editing draft not found');
    await assertWorkoutRequest(ctx, user._id, draft._id, { source: 'user_ui' });
    await ctx.db.delete(draft._id);
  },
});

// Discard the draft shown in review. Keep the ordinary draft while editing
// history; otherwise start a fresh empty draft so old AI requests stay fenced.
export const discardDraft = mutation({
  args: { draftId: v.id('workoutDrafts') },
  handler: async (ctx, { draftId }) => {
    const user = await requireUserProfile(ctx);
    const draft = await ctx.db.get(draftId);
    if (!draft) return;
    if (draft.userId !== user._id || (await currentForUser(ctx, user._id))?._id !== draftId)
      throw new ConvexError('Workout draft not found');
    await assertWorkoutRequest(ctx, user._id, draftId, { source: 'user_ui' });
    await ctx.db.delete(draftId);
    if (!draft.editingWorkoutId) {
      const now = Date.now();
      await ctx.db.insert('workoutDrafts', {
        userId: user._id,
        date: new Date(now).toISOString().slice(0, 10),
        status: 'active',
        exercises: [],
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const confirmDraft = mutation({
  args: { draftId: v.id('workoutDrafts'), name: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const receipt = await ctx.db
      .query('workoutConfirmations')
      .withIndex('by_user_draft', (q) =>
        q.eq('userId', user._id).eq('draftId', String(args.draftId)),
      )
      .unique();
    if (receipt) return receipt.workoutId;

    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.userId !== user._id) throw new ConvexError('Workout draft not found');
    const name = (args.name ?? draft.name)?.trim() || undefined;
    if (name && name.length > 100)
      throw new ConvexError('Workout name must be 100 characters or fewer');
    await assertWorkoutRequest(ctx, user._id, draft._id, { source: 'user_ui' });
    if (draft.exercises.length === 0 || draft.exercises.every((row) => row.sets.length === 0)) {
      throw new ConvexError('Cannot confirm an empty workout');
    }
    for (const row of draft.exercises) {
      if (!row.exerciseId)
        throw new ConvexError(`Exercise ${row.name} is not linked to the catalog`);
      if (row.sets.length === 0) throw new ConvexError(`Exercise ${row.name} has no sets`);
    }

    const catalog = await Promise.all(draft.exercises.map((row) => ctx.db.get(row.exerciseId!)));
    if (catalog.some((exercise) => !exercise || exercise.userId !== user._id)) {
      throw new ConvexError('Draft contains an invalid exercise');
    }

    const now = Date.now();
    const exercises = draft.exercises.map((row, index) => ({
      exerciseId: row.exerciseId!,
      nameSnapshot: row.name,
      notes: row.notes,
      sets: row.sets.map(({ setId: _, ...set }) => {
        const normalized = normalizeSetForTrackingType(set, catalog[index]!.trackingType);
        validateTrackedSet(normalized);
        return normalized;
      }),
    }));
    let workoutId;
    if (draft.editingWorkoutId) {
      const workout = await ctx.db.get(draft.editingWorkoutId);
      if (!workout || workout.userId !== user._id) throw new ConvexError('Workout not found');
      workoutId = workout._id;
      await ctx.db.patch(workoutId, { name, exercises, notes: draft.notes });
    } else {
      if ((await currentForUser(ctx, user._id))?._id !== draft._id)
        throw new ConvexError('Workout draft is not currently selected');
      workoutId = await ctx.db.insert('workouts', {
        userId: user._id,
        sourceDraftId: draft._id,
        name,
        performedAt: Date.parse(`${draft.date}T12:00:00.000Z`),
        exercises,
        notes: draft.notes,
        createdAt: now,
      });
    }
    await ctx.db.insert('workoutConfirmations', {
      userId: user._id,
      draftId: String(draft._id),
      workoutId,
      createdAt: now,
    });
    await ctx.db.delete(draft._id);
    return workoutId;
  },
});

export const namingContext = internalQuery({
  args: { draftId: v.id('workoutDrafts') },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const draft = await currentForUser(ctx, user._id);
    if (!draft || draft._id !== args.draftId) throw new ConvexError('Workout draft not found');
    const recent = await ctx.db
      .query('workouts')
      .withIndex('by_user_performed', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(draft.editingWorkoutId ? 6 : 5);
    return {
      aiSettings: user.aiSettings,
      exercises: draft.exercises.map(({ name }) => name),
      previousWorkouts: recent
        .filter((workout) => workout._id !== draft.editingWorkoutId)
        .slice(0, 5)
        .map((workout) => ({
          name: workout.name ?? '',
          exercises: workout.exercises.map(({ nameSnapshot }) => nameSnapshot),
        })),
    };
  },
});
