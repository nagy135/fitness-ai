import { beforeEach, expect, it, vi } from 'vitest';
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';
import type { MutationCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { api, internal } from './_generated/api';
import { latest, request } from './aiChatFocus';
import { requireAuthenticatedUser, requireUserProfile } from './lib/auth';

vi.mock('./lib/auth', () => ({ requireAuthenticatedUser: vi.fn(), requireUserProfile: vi.fn() }));
function handler<F extends FunctionReference<'query' | 'mutation', 'public' | 'internal'>>(
  fn: unknown,
  _ref: F,
) {
  return (
    fn as { _handler: (ctx: MutationCtx, args: FunctionArgs<F>) => Promise<FunctionReturnType<F>> }
  )._handler;
}
const emit = handler(request, internal.aiChatFocus.request);
const get = handler(latest, api.aiChatFocus.latest);
const requestId = 'request' as Id<'workoutRequests'>;
const sessionId = 'session' as Id<'analysisSessions'>;
type Row = Record<string, unknown> & { _id: string; table: string };
let rows: Row[];
let ctx: MutationCtx;
beforeEach(() => {
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
    db: {
      get: async (id: string) => rows.find((row) => row._id === id) ?? null,
      insert: async (table: string, value: Record<string, unknown>) => {
        const id = `${table}-${rows.length}`;
        rows.push({ ...value, _id: id, table });
        return id;
      },
      patch: async (id: string, value: Record<string, unknown>) =>
        Object.assign(
          rows.find((row) => row._id === id)!,
          value,
        ),
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
          unique: async () => selected[0] ?? null,
        };
        return query;
      },
    },
  } as unknown as MutationCtx;
});

it('publishes ordered live commands for the authenticated user and keeps only the latest', async () => {
  expect(await get(ctx, {})).toBeNull();
  expect(await emit(ctx, { requestId, open: true })).toEqual({
    status: 'requested',
    open: true,
    version: 1,
  });
  expect(await get(ctx, {})).toMatchObject({
    mode: 'workout',
    draftId: 'draft',
    open: true,
    version: 1,
  });
  await emit(ctx, { requestId, open: false });
  expect(await get(ctx, {})).toMatchObject({ open: false, version: 2 });
  expect(rows.filter((row) => row.table === 'aiChatFocus')).toHaveLength(1);
});

it('scopes analysis commands to the owning session without writing workout or message data', async () => {
  const before = structuredClone(rows);
  await emit(ctx, { sessionId, open: true });
  expect(await get(ctx, {})).toMatchObject({ mode: 'analysis', sessionId, open: true });
  expect(rows.filter((row) => row.table !== 'aiChatFocus')).toEqual(before);
  await emit(ctx, { requestId, open: false });
  expect(await get(ctx, {})).toMatchObject({
    mode: 'workout',
    draftId: 'draft',
    sessionId: undefined,
    version: 2,
  });
});

it('rejects foreign scopes and hides other users’ commands', async () => {
  await emit(ctx, { requestId, open: true });
  vi.mocked(requireUserProfile).mockResolvedValue({ _id: 'other' } as Doc<'userProfiles'>);
  await expect(emit(ctx, { requestId, open: false })).rejects.toThrow('Request not found');
  await expect(emit(ctx, { sessionId, open: true })).rejects.toThrow('Analysis not found');
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ _id: 'other-auth' } as never);
  expect(await get(ctx, {})).toBeNull();
});

it('rejects expired/completed workout actions and invalid context combinations', async () => {
  const row = rows.find((row) => row._id === requestId)!;
  row.status = 'completed';
  await expect(emit(ctx, { requestId, open: true })).rejects.toThrow('no longer active');
  row.status = 'running';
  row.expiresAt = Date.now() - 1;
  await expect(emit(ctx, { requestId, open: true })).rejects.toThrow('no longer active');
  await expect(emit(ctx, { requestId, sessionId, open: true })).rejects.toThrow('Choose one');
  await expect(emit(ctx, { open: true })).rejects.toThrow('Choose one');
  expect(rows.filter((row) => row.table === 'aiChatFocus')).toHaveLength(0);
});
