import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { api, internal } from './_generated/api';
import * as questions from './aiQuestions';
import { requireAuthenticatedUser, requireUserProfile } from './lib/auth';

vi.mock('./lib/auth', () => ({ requireAuthenticatedUser: vi.fn(), requireUserProfile: vi.fn() }));
function handler<F extends FunctionReference<'query' | 'mutation', 'public' | 'internal'>>(
  fn: unknown,
  _ref: F,
) {
  return (
    fn as {
      _handler: (ctx: MutationCtx, args: FunctionArgs<F>) => Promise<FunctionReturnType<F>>;
    }
  )._handler;
}
const create = handler(questions.create, internal.aiQuestions.create);
const respond = handler(questions.respond, api.aiQuestions.respond);
const read = handler(questions.read, internal.aiQuestions.read);
const close = handler(questions.close, internal.aiQuestions.close);
const expire = handler(questions.expire, internal.aiQuestions.expire);
const pending = handler(questions.pending, api.aiQuestions.pending);
type Row = Record<string, unknown> & { _id: string; table: string };
let rows: Row[];
let ctx: MutationCtx;
const requestId = 'request' as Id<'workoutRequests'>;
const sessionId = 'session' as Id<'analysisSessions'>;
const input = { question: 'Which exercise?', options: ['Push-ups', 'Squats'] };
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-24T12:00:00Z'));
  vi.resetAllMocks();
  vi.mocked(requireUserProfile).mockResolvedValue({ _id: 'user' } as Doc<'userProfiles'>);
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ _id: 'auth' } as never);
  rows = [
    { _id: 'user', table: 'userProfiles', authUserId: 'auth' },
    {
      _id: requestId,
      table: 'workoutRequests',
      userId: 'user',
      draftId: 'draft',
      status: 'running',
      expiresAt: Date.now() + 600_000,
    },
    { _id: sessionId, table: 'analysisSessions', userId: 'user' },
  ];
  ctx = {
    scheduler: { runAfter: vi.fn() },
    db: {
      get: async (id: string) => rows.find((row) => row._id === id) ?? null,
      insert: async (table: string, data: Record<string, unknown>) => {
        const id = `${table}-${rows.length}`;
        rows.push({ ...data, _id: id, table });
        return id;
      },
      patch: async (id: string, data: Record<string, unknown>) => {
        Object.assign(
          rows.find((row) => row._id === id)!,
          data,
        );
      },
      query: (table: string) => {
        let selected = rows.filter((row) => row.table === table);
        const query = {
          withIndex: (_name: string, build: (q: unknown) => unknown) => {
            const index = {
              eq: (key: string, value: unknown) => {
                selected = selected.filter((row) => row[key] === value);
                return index;
              },
            };
            build(index);
            return query;
          },
          collect: async () => selected,
          unique: async () => selected[0] ?? null,
        };
        return query;
      },
    },
  } as unknown as MutationCtx;
});
afterEach(() => vi.useRealTimers());

const ask = () =>
  create(ctx, { ...input, mode: 'workout', requestId, expiresAt: Date.now() + 180_000 });

it('authenticates questions and answers, preserving the first response across repeated submissions', async () => {
  const id = await ask();
  expect((await pending(ctx, {})).map((question) => question._id)).toEqual([id]);
  await respond(ctx, { id, answer: '  Push-ups  ' });
  await respond(ctx, { id, answer: 'Squats' });
  await close(ctx, { id });
  expect(await read(ctx, { id })).toMatchObject({ status: 'answered', answer: 'Push-ups' });
  expect(await pending(ctx, {})).toEqual([]);
});

it('prevents another account from creating, answering, or reading the question', async () => {
  const id = await ask();
  vi.mocked(requireUserProfile).mockResolvedValue({ _id: 'other-user' } as Doc<'userProfiles'>);
  await expect(ask()).rejects.toThrow('Request not found');
  await expect(respond(ctx, { id, answer: 'Push-ups' })).rejects.toThrow('Question not found');
  await expect(read(ctx, { id })).rejects.toThrow('Question not found');
  await expect(close(ctx, { id })).rejects.toThrow('Question not found');
});

it('rejects answers after expiry and hides questions from finished workout requests', async () => {
  const id = await ask();
  vi.advanceTimersByTime(180_001);
  await expect(respond(ctx, { id, answer: 'Push-ups' })).rejects.toThrow('no longer waiting');
  await expire(ctx, { id });
  expect(await read(ctx, { id })).toHaveProperty('status', 'expired');
  const next = await ask();
  rows.find((row) => row._id === requestId)!.status = 'completed';
  expect(await pending(ctx, {})).toEqual([]);
  await expect(respond(ctx, { id: next, answer: 'Push-ups' })).rejects.toThrow('no longer waiting');
});

it('schedules expiry, and an expiry job cannot replace an answer', async () => {
  const id = await ask();
  expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(180_000, expect.anything(), { id });
  await respond(ctx, { id, answer: 'Push-ups' });
  vi.advanceTimersByTime(180_001);
  await expire(ctx, { id });
  expect(await read(ctx, { id })).toHaveProperty('answer', 'Push-ups');
});

it('dismisses without manufacturing an answer and validates custom text', async () => {
  const id = await ask();
  await expect(respond(ctx, { id, answer: ' ' })).rejects.toThrow('between 1 and 2000');
  await expect(respond(ctx, { id, answer: 'x'.repeat(2_001) })).rejects.toThrow(
    'between 1 and 2000',
  );
  await respond(ctx, { id });
  expect(await read(ctx, { id })).toMatchObject({ status: 'dismissed' });
  expect(await read(ctx, { id })).not.toHaveProperty('answer');
});

it('retains analysis clarifications in their original session without modifying workout data', async () => {
  const id = await create(ctx, {
    ...input,
    mode: 'analysis',
    sessionId,
    expiresAt: Date.now() + 180_000,
  });
  await respond(ctx, { id, answer: 'Push-ups' });
  expect(rows.filter((row) => row.table === 'aiMessages')).toMatchObject([
    { role: 'assistant', sessionId, text: input.question },
    { role: 'user', sessionId, text: 'Push-ups' },
  ]);
  expect(rows.find((row) => row._id === requestId)).toHaveProperty('status', 'running');
});
