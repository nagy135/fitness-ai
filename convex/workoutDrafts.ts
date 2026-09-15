import { ConvexError, v } from 'convex/values';
import { normalizeSetForTrackingType } from '@fitness/domain';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { mutation, query } from './_generated/server';
import { requireUserProfile } from './lib/auth';
import { eventSourceValidator, setFields } from './model';
import { assertWorkoutRequest } from './lib/workoutRequest';
import { validateExerciseOrder, validateTrackedSet } from './lib/draftValidation';

type ReadCtx = QueryCtx | MutationCtx;
type Source = 'user_ui' | 'ai';

function dateKey() {
  return new Date().toISOString().slice(0, 10);
}

function snapshot(draft: Doc<'workoutDrafts'>) {
  return {
    date: draft.date,
    status: draft.status,
    exercises: draft.exercises,
    notes: draft.notes,
  };
}

async function currentForUser(ctx: ReadCtx, userId: Id<'userProfiles'>) {
  const drafts = await ctx.db
    .query('workoutDrafts')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect();
  return drafts.find((draft) => draft.status === 'active' || draft.status === 'confirming') ?? null;
}

async function requireCurrent(
  ctx: MutationCtx,
  userId: Id<'userProfiles'>,
  args: { source: Source; requestId?: Id<'workoutRequests'> },
) {
  const draft = await currentForUser(ctx, userId);
  if (!draft) throw new ConvexError('No active workout draft');
  await assertWorkoutRequest(ctx, userId, draft._id, args);
  return draft;
}

async function recordEvent(
  ctx: MutationCtx,
  draft: Doc<'workoutDrafts'>,
  type: Doc<'draftEvents'>['type'],
  source: Source,
  payload: unknown,
) {
  await ctx.db.insert('draftEvents', {
    userId: draft.userId,
    draftId: draft._id,
    type,
    source,
    payload,
    beforeSnapshot: snapshot(draft),
    createdAt: Date.now(),
  });
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUserProfile(ctx);
    const draft = await currentForUser(ctx, user._id);
    if (!draft) return null;

    const catalog = await Promise.all(
      draft.exercises.map((row) => (row.exerciseId ? ctx.db.get(row.exerciseId) : null)),
    );
    return {
      ...draft,
      exercises: draft.exercises.map((row, index) => {
        const exercise = catalog[index];
        if (!exercise) return row;
        return {
          ...row,
          sets: row.sets.map((set) => ({
            setId: set.setId,
            ...normalizeSetForTrackingType(set, exercise.trackingType),
          })),
        };
      }),
    };
  },
});

export const getOrCreate = mutation({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const existing = await currentForUser(ctx, user._id);
    if (existing) return existing._id;
    const now = Date.now();
    return ctx.db.insert('workoutDrafts', {
      userId: user._id,
      date: args.date ?? dateKey(),
      status: 'active',
      exercises: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const addExercise = mutation({
  args: {
    exerciseId: v.id('exercises'),
    notes: v.optional(v.string()),
    requestId: v.optional(v.id('workoutRequests')),
    source: eventSourceValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const draft = await requireCurrent(ctx, user._id, args);
    const exercise = await ctx.db.get(args.exerciseId);
    if (!exercise || exercise.userId !== user._id || exercise.archivedAt) {
      throw new ConvexError('Exercise not found');
    }
    const existing = draft.exercises.find((row) => row.exerciseId === exercise._id);
    if (existing) return existing.rowId;
    const rowId = crypto.randomUUID();
    await recordEvent(ctx, draft, 'add_exercise', args.source, { rowId, exerciseId: exercise._id });
    await ctx.db.patch(draft._id, {
      exercises: [
        ...draft.exercises,
        { rowId, exerciseId: exercise._id, name: exercise.name, notes: args.notes, sets: [] },
      ],
      updatedAt: Date.now(),
    });
    return rowId;
  },
});

export const addExercises = mutation({
  args: {
    exercises: v.array(
      v.object({
        exerciseId: v.id('exercises'),
        notes: v.optional(v.string()),
        sets: v.array(v.object(setFields)),
      }),
    ),
    requestId: v.optional(v.id('workoutRequests')),
    source: eventSourceValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const draft = await requireCurrent(ctx, user._id, args);
    const request = args.requestId ? await ctx.db.get(args.requestId) : null;
    if (request?.addedRowIds) return request.addedRowIds;
    if (args.exercises.length === 0 || args.exercises.length > 100) {
      throw new ConvexError('Exercise batch must contain between 1 and 100 exercises');
    }
    if (args.exercises.some(({ sets }) => sets.length > 100)) {
      throw new ConvexError('An exercise cannot contain more than 100 sets per batch');
    }
    if (
      new Set(args.exercises.map(({ exerciseId }) => exerciseId)).size !== args.exercises.length
    ) {
      throw new ConvexError('Exercise batch contains duplicates');
    }

    const catalog = await Promise.all(
      args.exercises.map(({ exerciseId }) => ctx.db.get(exerciseId)),
    );
    if (
      catalog.some((exercise) => !exercise || exercise.userId !== user._id || exercise.archivedAt)
    ) {
      throw new ConvexError('Exercise not found');
    }

    const exercises = [...draft.exercises];
    const rowIds: string[] = [];
    for (const [index, input] of args.exercises.entries()) {
      const exercise = catalog[index]!;
      const sets = input.sets.map((set) => {
        const normalizedSet = normalizeSetForTrackingType(set, exercise.trackingType);
        validateTrackedSet(normalizedSet);
        return { setId: crypto.randomUUID(), ...normalizedSet };
      });
      const rowIndex = exercises.findIndex((row) => row.exerciseId === exercise._id);
      if (rowIndex === -1) {
        const rowId = crypto.randomUUID();
        rowIds.push(rowId);
        exercises.push({
          rowId,
          exerciseId: exercise._id,
          name: exercise.name,
          notes: input.notes,
          sets,
        });
      } else {
        const row = exercises[rowIndex];
        rowIds.push(row.rowId);
        exercises[rowIndex] = {
          ...row,
          notes: input.notes ?? row.notes,
          sets: [...row.sets, ...sets],
        };
      }
    }

    await recordEvent(ctx, draft, 'add_exercises', args.source, {
      exercises: args.exercises.map(({ exerciseId, sets }) => ({
        exerciseId,
        setCount: sets.length,
      })),
    });
    await ctx.db.patch(draft._id, { exercises, updatedAt: Date.now() });
    if (args.requestId) await ctx.db.patch(args.requestId, { addedRowIds: rowIds });
    return rowIds;
  },
});

export const removeExercise = mutation({
  args: {
    rowId: v.string(),
    requestId: v.optional(v.id('workoutRequests')),
    source: eventSourceValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const draft = await requireCurrent(ctx, user._id, args);
    if (!draft.exercises.some((row) => row.rowId === args.rowId))
      throw new ConvexError('Draft exercise not found');
    await recordEvent(ctx, draft, 'remove_exercise', args.source, { rowId: args.rowId });
    await ctx.db.patch(draft._id, {
      exercises: draft.exercises.filter((row) => row.rowId !== args.rowId),
      updatedAt: Date.now(),
    });
  },
});

export const addSet = mutation({
  args: {
    exerciseId: v.id('exercises'),
    set: v.object(setFields),
    requestId: v.optional(v.id('workoutRequests')),
    source: eventSourceValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const draft = await requireCurrent(ctx, user._id, args);
    const exercise = await ctx.db.get(args.exerciseId);
    if (!exercise || exercise.userId !== user._id || exercise.archivedAt)
      throw new ConvexError('Exercise not found');
    const normalizedSet = normalizeSetForTrackingType(args.set, exercise.trackingType);
    validateTrackedSet(normalizedSet);
    const setId = crypto.randomUUID();
    const rowIndex = draft.exercises.findIndex((row) => row.exerciseId === exercise._id);
    const exercises = [...draft.exercises];
    if (rowIndex === -1) {
      exercises.push({
        rowId: crypto.randomUUID(),
        exerciseId: exercise._id,
        name: exercise.name,
        sets: [{ setId, ...normalizedSet }],
      });
    } else {
      exercises[rowIndex] = {
        ...exercises[rowIndex],
        sets: [...exercises[rowIndex].sets, { setId, ...normalizedSet }],
      };
    }
    await recordEvent(ctx, draft, 'add_set', args.source, { exerciseId: exercise._id, setId });
    await ctx.db.patch(draft._id, { exercises, updatedAt: Date.now() });
    return setId;
  },
});

export const updateSet = mutation({
  args: {
    rowId: v.string(),
    setId: v.string(),
    patch: v.object(setFields),
    requestId: v.optional(v.id('workoutRequests')),
    source: eventSourceValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const draft = await requireCurrent(ctx, user._id, args);
    const targetRow = draft.exercises.find((row) => row.rowId === args.rowId);
    const exercise = targetRow?.exerciseId ? await ctx.db.get(targetRow.exerciseId) : null;
    let found = false;
    const exercises = draft.exercises.map((row) => {
      if (row.rowId !== args.rowId) return row;
      return {
        ...row,
        sets: row.sets.map((set) => {
          if (set.setId !== args.setId) return set;
          found = true;
          const patched = { ...set, ...args.patch };
          const next = exercise
            ? { setId: set.setId, ...normalizeSetForTrackingType(patched, exercise.trackingType) }
            : patched;
          validateTrackedSet(next);
          return next;
        }),
      };
    });
    if (!found) throw new ConvexError('Draft set not found');
    await recordEvent(ctx, draft, 'update_set', args.source, {
      rowId: args.rowId,
      setId: args.setId,
    });
    await ctx.db.patch(draft._id, { exercises, updatedAt: Date.now() });
  },
});

export const removeSet = mutation({
  args: {
    rowId: v.string(),
    setId: v.string(),
    requestId: v.optional(v.id('workoutRequests')),
    source: eventSourceValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const draft = await requireCurrent(ctx, user._id, args);
    const row = draft.exercises.find((item) => item.rowId === args.rowId);
    if (!row?.sets.some((set) => set.setId === args.setId))
      throw new ConvexError('Draft set not found');
    await recordEvent(ctx, draft, 'remove_set', args.source, {
      rowId: args.rowId,
      setId: args.setId,
    });
    const exercises = draft.exercises.map((item) =>
      item.rowId === args.rowId
        ? { ...item, sets: item.sets.filter((set) => set.setId !== args.setId) }
        : item,
    );
    await ctx.db.patch(draft._id, { exercises, updatedAt: Date.now() });
  },
});

export const updateExerciseNotes = mutation({
  args: {
    rowId: v.string(),
    notes: v.string(),
    requestId: v.optional(v.id('workoutRequests')),
    source: eventSourceValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const draft = await requireCurrent(ctx, user._id, args);
    if (!draft.exercises.some((row) => row.rowId === args.rowId))
      throw new ConvexError('Draft exercise not found');
    await recordEvent(ctx, draft, 'update_notes', args.source, { rowId: args.rowId });
    await ctx.db.patch(draft._id, {
      exercises: draft.exercises.map((row) =>
        row.rowId === args.rowId ? { ...row, notes: args.notes } : row,
      ),
      updatedAt: Date.now(),
    });
  },
});

export const reorderExercises = mutation({
  args: {
    orderedRowIds: v.array(v.string()),
    requestId: v.optional(v.id('workoutRequests')),
    source: eventSourceValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const draft = await requireCurrent(ctx, user._id, args);
    validateExerciseOrder(
      draft.exercises.map((row) => row.rowId),
      args.orderedRowIds,
    );
    const byId = new Map(draft.exercises.map((row) => [row.rowId, row]));
    const exercises = args.orderedRowIds.map((rowId) => byId.get(rowId));
    if (exercises.some((row) => !row)) throw new ConvexError('Unknown row in order');
    await recordEvent(ctx, draft, 'reorder_exercises', args.source, {
      orderedRowIds: args.orderedRowIds,
    });
    await ctx.db.patch(draft._id, {
      exercises: exercises as typeof draft.exercises,
      updatedAt: Date.now(),
    });
  },
});

export const undoLastAction = mutation({
  args: { requestId: v.optional(v.id('workoutRequests')), source: eventSourceValidator },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const draft = await requireCurrent(ctx, user._id, args);
    const events = await ctx.db
      .query('draftEvents')
      .withIndex('by_draft_created', (q) => q.eq('draftId', draft._id))
      .order('desc')
      .take(50);
    const target = events.find((event) => event.type !== 'undo' && event.revertedAt === undefined);
    if (!target?.beforeSnapshot) throw new ConvexError('Nothing to undo');
    await recordEvent(ctx, draft, 'undo', args.source, { revertedEventId: target._id });
    await ctx.db.patch(target._id, { revertedAt: Date.now() });
    await ctx.db.patch(draft._id, { ...target.beforeSnapshot, updatedAt: Date.now() });
    return target.type;
  },
});
