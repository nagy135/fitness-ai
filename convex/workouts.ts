import { ConvexError, v } from 'convex/values';
import { normalizeSetForTrackingType } from '@fitness/domain';
import { mutation, query } from './_generated/server';
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

export const confirmDraft = mutation({
  args: { draftId: v.id('workoutDrafts') },
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
    const workoutId = await ctx.db.insert('workouts', {
      userId: user._id,
      sourceDraftId: draft._id,
      performedAt: Date.parse(`${draft.date}T12:00:00.000Z`),
      exercises: draft.exercises.map((row, index) => ({
        exerciseId: row.exerciseId!,
        nameSnapshot: row.name,
        sets: row.sets.map(({ setId: _, ...set }) =>
          normalizeSetForTrackingType(set, catalog[index]!.trackingType),
        ),
      })),
      notes: draft.notes,
      createdAt: now,
    });
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
