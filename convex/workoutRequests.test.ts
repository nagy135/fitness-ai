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
import { addExercises, removeSet } from './workoutDrafts';
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
