import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MutationCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { requireUserProfile } from './lib/auth';
import {
  acknowledgeWorkoutRequest,
  beginWorkoutRequest,
  conversation,
  finishWorkoutRequest,
  prepareWorkoutRequest,
} from './aiMessages';
import { beginEdit, cancelEdit, confirmDraft, remove as deleteWorkout } from './workouts';
import {
  addExercises,
  removeSet,
  updateSet,
  currentForUser,
  undoLastAction,
} from './workoutDrafts';
import { assertWorkoutRequest } from './lib/workoutRequest';

vi.mock('./lib/auth', () => ({ requireUserProfile: vi.fn() }));

function handler<A, R>(fn: unknown) {
  return (fn as { _handler: (ctx: MutationCtx, args: A) => Promise<R> })._handler;
}
const prepare = handler<{ prompt: string }, Id<'workoutRequests'>>(prepareWorkoutRequest);
const begin = handler<
  { requestId: Id<'workoutRequests'> },
  { execute: boolean; request: Doc<'workoutRequests'> }
>(beginWorkoutRequest);
const finish = handler<{ requestId: Id<'workoutRequests'>; text: string; failed: boolean }, void>(
  finishWorkoutRequest,
);
const acknowledge = handler<{ requestId: Id<'workoutRequests'> }, void>(acknowledgeWorkoutRequest);
const history = handler<{ mode: 'workout' | 'analysis' }, { role: string; content: string }[]>(
  conversation,
);
const add = handler<
  {
    exercises: { exerciseId: Id<'exercises'>; sets: { reps: number }[] }[];
    source: 'ai';
    requestId: Id<'workoutRequests'>;
  },
  string[]
>(addExercises);
const remove = handler<{ rowId: string; setId: string; source: 'user_ui' }, void>(removeSet);

const userId = 'user-1' as Id<'userProfiles'>;
const draftId = 'draft-1' as Id<'workoutDrafts'>;
const exerciseId = 'exercise-1' as Id<'exercises'>;
// A small stateful DB double exercises the real mutation handlers and persisted
// receipts. Production concurrency is enforced by Convex's mutation transaction.
type Row = Record<string, unknown> & { _id: string; table: string };
let rows: Row[];
let ctx: MutationCtx;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireUserProfile).mockResolvedValue({ _id: userId } as Doc<'userProfiles'>);
  rows = [
    {
      _id: draftId,
      table: 'workoutDrafts',
      userId,
      status: 'active',
      date: '2026-09-15',
      exercises: [],
    },
    { _id: exerciseId, table: 'exercises', userId, name: 'Push-ups', trackingType: 'reps' },
  ];
  let serial = 0;
  ctx = {
    db: {
      get: async (id: string) => rows.find((row) => row._id === id) ?? null,
      insert: async (table: string, value: Record<string, unknown>) => {
        const _id = `${table}-${++serial}`;
        rows.push({ ...value, _id, table });
        return _id;
      },
      delete: async (id: string) => {
        rows = rows.filter((row) => row._id !== id);
      },
      patch: async (id: string, value: Record<string, unknown>) => {
        Object.assign(
          rows.find((row) => row._id === id)!,
          value,
        );
      },
      query: (table: string) => {
        let selected = rows.filter((row) => row.table === table);
        const query = {
          withIndex: (_: string, build: (q: unknown) => unknown) => {
            const index = {
              eq: (key: string, value: unknown) => {
                selected = selected.filter((row) => row[key] === value);
                return index;
              },
            };
            build(index);
            return query;
          },
          order: (direction: string) => {
            selected.sort(
              (a, b) =>
                (Number(a.createdAt) - Number(b.createdAt)) * (direction === 'asc' ? 1 : -1),
            );
            return query;
          },
          collect: async () => selected,
          unique: async () => selected[0] ?? null,
          take: async (n: number) => selected.slice(0, n),
        };
        return query;
      },
    },
  } as unknown as MutationCtx;
});

async function running(prompt = 'Two sets of 10 push-ups') {
  const requestId = await prepare(ctx, { prompt });
  expect((await begin(ctx, { requestId })).execute).toBe(true);
  return requestId;
}

function batch(requestId: Id<'workoutRequests'>) {
  return {
    requestId,
    source: 'ai' as const,
    exercises: [{ exerciseId, sets: [{ reps: 10 }, { reps: 10 }] }],
  };
}

describe('durable workout submissions', () => {
  it('recovers a lost completed response without re-executing or re-appending the user message', async () => {
    const requestId = await running();
    await add(ctx, batch(requestId));
    await finish(ctx, { requestId, text: 'Added two sets.', failed: false });
    expect(await prepare(ctx, { prompt: 'Two sets of 10 push-ups' })).toBe(requestId);
    expect(await begin(ctx, { requestId })).toMatchObject({
      execute: false,
      request: { text: 'Added two sets.' },
    });
    expect(rows.filter((row) => row.table === 'aiMessages')).toHaveLength(2);
  });

  it('does not rerun a failed request after sets have already committed', async () => {
    const requestId = await running();
    await add(ctx, batch(requestId));
    await finish(ctx, { requestId, text: 'Stopped after saving sets.', failed: true });
    expect((await begin(ctx, { requestId })).execute).toBe(false);
    await expect(add(ctx, batch(requestId))).rejects.toThrow('no longer active');
  });

  it('makes replaying an addition return its receipt, preserving legitimate identical sets', async () => {
    const requestId = await running();
    const first = await add(ctx, batch(requestId));
    expect(await add(ctx, batch(requestId))).toEqual(first);
    const draft = rows.find((row) => row._id === draftId) as unknown as Doc<'workoutDrafts'>;
    expect(draft.exercises[0].sets).toHaveLength(2);
    expect(draft.exercises[0].sets.map((set) => set.reps)).toEqual([10, 10]);
    expect(new Set(draft.exercises[0].sets.map((set) => set.setId)).size).toBe(2);
    expect(rows.filter((row) => row.table === 'draftEvents')).toHaveLength(1);
  });

  it('allows another intentional identical submission after acknowledgement', async () => {
    const requestId = await running();
    await add(ctx, batch(requestId));
    await finish(ctx, { requestId, text: 'Done', failed: false });
    await acknowledge(ctx, { requestId });
    const next = await running();
    expect(next).not.toBe(requestId);
    await add(ctx, batch(next));
    const draft = rows.find((row) => row._id === draftId) as unknown as Doc<'workoutDrafts'>;
    expect(draft.exercises[0].sets).toHaveLength(4);
  });

  it('blocks two queued requests from executing concurrently, including the same request twice', async () => {
    const first = await prepare(ctx, { prompt: 'First' });
    const second = await prepare(ctx, { prompt: 'Second' });
    await begin(ctx, { requestId: first });
    await expect(begin(ctx, { requestId: second })).rejects.toThrow('Another workout request');
    await expect(begin(ctx, { requestId: first })).rejects.toThrow('still running');
    await expect(prepare(ctx, { prompt: 'Third' })).rejects.toThrow('still running');
    expect(await prepare(ctx, { prompt: 'First' })).toBe(first);
  });

  it('blocks manual edits and confirmation while the AI is running', async () => {
    const requestId = await running();
    await add(ctx, batch(requestId));
    await expect(remove(ctx, { rowId: 'row', setId: 'set', source: 'user_ui' })).rejects.toThrow(
      'Wait for the workout request',
    );
    await expect(assertWorkoutRequest(ctx, userId, draftId, { source: 'user_ui' })).rejects.toThrow(
      'before editing or confirming',
    );
  });

  it('fences expired actions even after a new request starts, and never re-executes the expired request', async () => {
    const old = await running();
    rows.find((row) => row._id === old)!.expiresAt = 0;
    const next = await running('Another set');
    await expect(add(ctx, batch(old))).rejects.toThrow('no longer active');
    await add(ctx, batch(next));
    expect(await begin(ctx, { requestId: old })).toMatchObject({
      execute: false,
      request: { text: expect.stringContaining('timed out') },
    });
  });

  it('rejects foreign request IDs and writes to a different draft', async () => {
    const requestId = await running();
    await expect(
      assertWorkoutRequest(ctx, userId, 'another-draft' as Id<'workoutDrafts'>, {
        source: 'ai',
        requestId,
      }),
    ).rejects.toThrow('no longer active');
    rows.find((row) => row._id === requestId)!.userId = 'other-user';
    await expect(begin(ctx, { requestId })).rejects.toThrow('Request not found');
    await expect(add(ctx, batch(requestId))).rejects.toThrow('no longer active');
    await expect(acknowledge(ctx, { requestId })).rejects.toThrow('Request not found');
  });

  it('rejects request IDs attached to manual writes', async () => {
    const requestId = await running();
    await expect(
      assertWorkoutRequest(ctx, userId, draftId, { source: 'user_ui', requestId }),
    ).rejects.toThrow('reserved');
  });
});

describe('full model conversation', () => {
  it('includes more than 50 messages in chronological order with user and mode isolation', async () => {
    for (let i = 60; i >= 0; i--)
      rows.push({
        _id: `message-${i}`,
        table: 'aiMessages',
        userId,
        mode: 'workout',
        role: i % 2 ? 'assistant' : 'user',
        text: String(i),
        createdAt: i,
      });
    rows.push({
      _id: 'foreign',
      table: 'aiMessages',
      userId: 'someone-else',
      mode: 'workout',
      role: 'user',
      text: 'secret',
    });
    rows.push({
      _id: 'analysis',
      table: 'aiMessages',
      userId,
      mode: 'analysis',
      role: 'user',
      text: 'analysis',
    });
    const messages = await history(ctx, { mode: 'workout' });
    expect(messages).toHaveLength(61);
    expect(messages[0]).toEqual({ role: 'user', content: '0' });
    expect(messages[60]).toEqual({ role: 'user', content: '60' });
    expect(await history(ctx, { mode: 'analysis' })).toEqual([
      { role: 'user', content: 'analysis' },
    ]);
  });
});

const editHistory = handler<{ workoutId: Id<'workouts'> }, Id<'workoutDrafts'>>(beginEdit);
const cancelHistory = handler<{ draftId: Id<'workoutDrafts'> }, void>(cancelEdit);
const save = handler<{ draftId: Id<'workoutDrafts'> }, Id<'workouts'>>(confirmDraft);
const erase = handler<{ workoutId: Id<'workouts'> }, void>(deleteWorkout);
const update = handler<
  {
    rowId: string;
    setId: string;
    patch: { reps: number; weightKg?: number };
    source: 'user_ui';
  },
  void
>(updateSet);
const undo = handler<{ source: 'user_ui' }, void>(undoLastAction);
const savedId = 'saved-workout' as Id<'workouts'>;

function seedWorkout() {
  rows.push({
    _id: savedId,
    table: 'workouts',
    userId,
    sourceDraftId: 'original-draft',
    performedAt: Date.parse('2026-08-20T08:30:00Z'),
    createdAt: 123,
    notes: 'Morning session',
    exercises: [
      { exerciseId, nameSnapshot: 'Original push-ups', notes: 'Slow tempo', sets: [{ reps: 8 }] },
    ],
  });
}

describe('history editing through shared workout tools', () => {
  beforeEach(seedWorkout);

  it('reuses an editing draft and cancels without changing history or the ordinary draft', async () => {
    rows[0].exercises = [
      {
        rowId: 'in-progress',
        exerciseId,
        name: 'Push-ups',
        sets: [{ setId: 'in-progress-set', reps: 20 }],
      },
    ];
    const original = structuredClone(rows);
    const editingId = await editHistory(ctx, { workoutId: savedId });
    expect(await editHistory(ctx, { workoutId: savedId })).toBe(editingId);
    expect((await currentForUser(ctx, userId))?._id).toBe(editingId);
    const requestId = await running();
    await add(ctx, batch(requestId));
    await finish(ctx, { requestId, text: 'Added', failed: false });
    await cancelHistory(ctx, { draftId: editingId });
    await cancelHistory(ctx, { draftId: editingId });
    expect(await currentForUser(ctx, userId)).toEqual(original[0]);
    expect(rows.find((row) => row._id === savedId)).toEqual(original[2]);
  });

  it('supports manual edits, undo, AI additions and an idempotent save to the same history record', async () => {
    const editingId = await editHistory(ctx, { workoutId: savedId });
    const draft = (await currentForUser(ctx, userId))!;
    const row = draft.exercises[0];
    await update(ctx, {
      rowId: row.rowId,
      setId: row.sets[0].setId,
      patch: { reps: 12, weightKg: 30 },
      source: 'user_ui',
    });
    expect((await currentForUser(ctx, userId))!.exercises[0].sets[0]).toMatchObject({ reps: 12 });
    expect((await currentForUser(ctx, userId))!.exercises[0].sets[0].weightKg).toBeUndefined();
    await undo(ctx, { source: 'user_ui' });
    expect((await currentForUser(ctx, userId))!.exercises[0].sets[0].reps).toBe(8);
    const requestId = await running();
    await add(ctx, batch(requestId));
    await finish(ctx, { requestId, text: 'Added', failed: false });
    expect(await save(ctx, { draftId: editingId })).toBe(savedId);
    expect(await save(ctx, { draftId: editingId })).toBe(savedId);
    const workout = rows.find((row) => row._id === savedId)!;
    expect(workout).toMatchObject({
      performedAt: Date.parse('2026-08-20T08:30:00Z'),
      createdAt: 123,
      sourceDraftId: 'original-draft',
      notes: 'Morning session',
      exercises: [
        {
          nameSnapshot: 'Original push-ups',
          notes: 'Slow tempo',
          sets: [{ reps: 8 }, { reps: 10 }, { reps: 10 }],
        },
      ],
    });
    expect(rows.filter((row) => row.table === 'workouts')).toHaveLength(1);
    expect((await currentForUser(ctx, userId))?._id).toBe(draftId);
  });

  it('scopes identical prompt retries to the selected draft and blocks queued requests for the previous draft', async () => {
    const oldRequest = await prepare(ctx, { prompt: 'Same prompt' });
    const editingId = await editHistory(ctx, { workoutId: savedId });
    const newRequest = await prepare(ctx, { prompt: 'Same prompt' });
    expect(newRequest).not.toBe(oldRequest);
    expect(rows.find((row) => row._id === newRequest)?.draftId).toBe(editingId);
    await expect(begin(ctx, { requestId: oldRequest })).rejects.toThrow('not currently selected');
  });

  it('blocks opening, saving, and canceling history edits while an AI write is running', async () => {
    const first = await running();
    await expect(editHistory(ctx, { workoutId: savedId })).rejects.toThrow('Wait for');
    await finish(ctx, { requestId: first, text: 'Done', failed: false });
    const editingId = await editHistory(ctx, { workoutId: savedId });
    await running('Edit history');
    await expect(save(ctx, { draftId: editingId })).rejects.toThrow('Wait for');
    await expect(cancelHistory(ctx, { draftId: editingId })).rejects.toThrow('Wait for');
  });

  it('never recreates a workout deleted during editing', async () => {
    const editingId = await editHistory(ctx, { workoutId: savedId });
    await erase(ctx, { workoutId: savedId });
    await expect(save(ctx, { draftId: editingId })).rejects.toThrow('Workout not found');
    expect(rows.filter((row) => row.table === 'workouts')).toHaveLength(0);
    await cancelHistory(ctx, { draftId: editingId });
    expect((await currentForUser(ctx, userId))?._id).toBe(draftId);
  });

  it('rejects foreign workouts and editing drafts', async () => {
    rows.find((row) => row._id === savedId)!.userId = 'someone-else';
    await expect(editHistory(ctx, { workoutId: savedId })).rejects.toThrow('Workout not found');
    rows.find((row) => row._id === savedId)!.userId = userId;
    const editingId = await editHistory(ctx, { workoutId: savedId });
    rows.find((row) => row._id === editingId)!.userId = 'someone-else';
    await expect(cancelHistory(ctx, { draftId: editingId })).rejects.toThrow('not found');
    await expect(save(ctx, { draftId: editingId })).rejects.toThrow('not found');
  });

  it('requires finishing one history edit before opening another', async () => {
    await editHistory(ctx, { workoutId: savedId });
    const otherId = 'other-workout' as Id<'workouts'>;
    rows.push({ ...rows.find((row) => row._id === savedId)!, _id: otherId });
    await expect(editHistory(ctx, { workoutId: otherId })).rejects.toThrow('Save or cancel');
    expect(rows.filter((row) => row.table === 'workoutDrafts')).toHaveLength(2);
  });

  it('does not save an empty history edit', async () => {
    const editingId = await editHistory(ctx, { workoutId: savedId });
    const row = (await currentForUser(ctx, userId))!.exercises[0];
    await remove(ctx, { rowId: row.rowId, setId: row.sets[0].setId, source: 'user_ui' });
    await expect(save(ctx, { draftId: editingId })).rejects.toThrow('empty workout');
    expect(rows.find((row) => row._id === savedId)).toMatchObject({
      exercises: [{ sets: [{ reps: 8 }] }],
    });
  });
});
