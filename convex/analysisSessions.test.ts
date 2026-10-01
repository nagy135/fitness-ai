import { beforeEach, expect, it, vi } from 'vitest';
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';
import type { MutationCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { api } from './_generated/api';
import * as messages from './aiMessages';
import { requireUserProfile } from './lib/auth';

vi.mock('./lib/auth', () => ({ requireUserProfile: vi.fn() }));
function handler<F extends FunctionReference<'query' | 'mutation'>>(fn: unknown, _ref: F) {
  return (
    fn as { _handler: (ctx: MutationCtx, args: FunctionArgs<F>) => Promise<FunctionReturnType<F>> }
  )._handler;
}
const create = handler(messages.createAnalysisSession, api.aiMessages.createAnalysisSession);
const rename = handler(messages.renameAnalysisSession, api.aiMessages.renameAnalysisSession);
const get = handler(messages.analysisSession, api.aiMessages.analysisSession);
const list = handler(messages.analysisHistory, api.aiMessages.analysisHistory);
const conversation = handler(messages.analysisConversation, api.aiMessages.analysisConversation);
const context = handler(messages.analysisContext, api.aiMessages.analysisContext);
const append = handler(messages.append, api.aiMessages.append);
type Row = Record<string, unknown> & { _id: string; table: string };
let rows: Row[];
let ctx: MutationCtx;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireUserProfile).mockResolvedValue({ _id: 'user-1' } as Doc<'userProfiles'>);
  rows = [];
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
        let sortField = 'createdAt';
        const query = {
          withIndex: (name: string, build: (q: unknown) => unknown) => {
            sortField = name === 'by_user_updated' ? 'updatedAt' : 'createdAt';
            const index = {
              eq: (key: string, value: unknown) => {
                selected = selected.filter((row) => row[key] === value);
                return index;
              },
            };
            build(index);
            return query;
          },
          filter: (build: (q: unknown) => (row: Row) => boolean) => {
            selected = selected.filter(
              build({
                field: (name: string) => name,
                eq: (name: string, value: unknown) => (row: Row) => row[name] === value,
              }),
            );
            return query;
          },
          order: (direction: string) => {
            selected.sort(
              (a, b) =>
                (Number(a[sortField]) - Number(b[sortField])) * (direction === 'asc' ? 1 : -1),
            );
            return query;
          },
          collect: async () => selected,
          first: async () => selected[0] ?? null,
          paginate: async ({ cursor, numItems }: { cursor: string | null; numItems: number }) => {
            const offset = Number(cursor ?? 0);
            return {
              page: selected.slice(offset, offset + numItems),
              isDone: offset + numItems >= selected.length,
              continueCursor: String(offset + numItems),
            };
          },
        };
        return query;
      },
    },
  } as unknown as MutationCtx;
});
const page = { numItems: 20, cursor: null };
const chart = {
  type: 'line' as const,
  title: 'Squat',
  metric: 'weight',
  unit: 'kg',
  points: [{ x: 1, y: 80 }],
};

it('restores a named analysis and chart from storage, keeping other sessions separate', async () => {
  const first = await create(ctx, { title: '  Squat progress  ' });
  await append(ctx, { mode: 'analysis', role: 'user', text: 'Graph squat', sessionId: first });
  await append(ctx, {
    mode: 'analysis',
    role: 'assistant',
    text: 'Progress',
    chart,
    sessionId: first,
  });
  const second = await create(ctx, { title: 'Volume' });
  await append(ctx, {
    mode: 'analysis',
    role: 'assistant',
    text: 'Volume summary',
    sessionId: second,
  });
  await rename(ctx, { sessionId: first, title: '  My squat  ' });
  expect(await get(ctx, { sessionId: first })).toMatchObject({
    title: 'My squat',
    response: { text: 'Progress', chart },
  });
  expect((await conversation(ctx, { sessionId: first, paginationOpts: page })).page).toHaveLength(
    2,
  );
  expect(
    (await conversation(ctx, { sessionId: second, paginationOpts: page })).page.map((m) => m.text),
  ).toEqual(['Volume summary']);
});

it('lists and restores only the authenticated account’s sessions, newest first, across pages', async () => {
  const first = await create(ctx, { title: 'First' });
  const second = await create(ctx, { title: 'Second' });
  rows.find((row) => row._id === first)!.updatedAt = 1;
  rows.find((row) => row._id === second)!.updatedAt = 2;
  rows.push({
    _id: 'foreign',
    table: 'analysisSessions',
    title: 'Secret',
    userId: 'other',
    updatedAt: 3,
  });
  const result = await list(ctx, { paginationOpts: { numItems: 1, cursor: null } });
  expect(result.page.map((s) => s._id)).toEqual([second]);
  expect(result.isDone).toBe(false);
  const next = await list(ctx, { paginationOpts: { numItems: 1, cursor: result.continueCursor } });
  expect(next.page.map((s) => s._id)).toEqual([first]);
  expect(next.isDone).toBe(true);
  expect((await get(ctx, {}))?._id).toBe(second);
});

it('rejects foreign sessions for reading, renaming, and appending messages without changing storage', async () => {
  const id = await create(ctx, { title: 'Private' });
  rows[0].userId = 'other';
  const original = structuredClone(rows);
  await expect(context(ctx, { sessionId: id })).rejects.toThrow('Analysis not found');
  await expect(get(ctx, { sessionId: id })).rejects.toThrow('Analysis not found');
  await expect(conversation(ctx, { sessionId: id, paginationOpts: page })).rejects.toThrow(
    'Analysis not found',
  );
  await expect(rename(ctx, { sessionId: id, title: 'Changed' })).rejects.toThrow(
    'Analysis not found',
  );
  await expect(
    append(ctx, { mode: 'analysis', role: 'user', text: 'Hello', sessionId: id }),
  ).rejects.toThrow('Analysis not found');
  expect(rows).toEqual(original);
});

it('retains legacy analysis messages without mixing workout, foreign, or session messages', async () => {
  await append(ctx, { mode: 'analysis', role: 'assistant', text: 'Old analysis', chart });
  await append(ctx, { mode: 'workout', role: 'assistant', text: 'Workout' });
  const id = await create(ctx, { title: 'New analysis' });
  await append(ctx, { mode: 'analysis', role: 'assistant', text: 'New result', sessionId: id });
  rows.push({
    _id: 'foreign',
    table: 'aiMessages',
    userId: 'other',
    mode: 'analysis',
    text: 'Secret',
  });
  const legacy = await conversation(ctx, { paginationOpts: page });
  expect(legacy.page).toHaveLength(1);
  expect(legacy.page[0]).toMatchObject({ text: 'Old analysis', chart });
});

it('validates titles and prevents workout messages from entering analysis sessions', async () => {
  await expect(create(ctx, { title: '   ' })).rejects.toThrow('required');
  const id = await create(ctx, { title: 'x'.repeat(120) });
  expect((await get(ctx, { sessionId: id }))?.title).toHaveLength(100);
  await expect(rename(ctx, { sessionId: id, title: ' ' })).rejects.toThrow('between 1 and 100');
  await expect(rename(ctx, { sessionId: id, title: 'x'.repeat(101) })).rejects.toThrow(
    'between 1 and 100',
  );
  await expect(
    append(ctx, { mode: 'workout', role: 'user', text: 'Hello', sessionId: id }),
  ).rejects.toThrow('Only analysis');
});

it('loads the whole session in order with charts and excludes all other conversations', async () => {
  const id = await create(ctx, { title: 'Full conversation' });
  for (let i = 0; i < 60; i++) {
    await append(ctx, {
      mode: 'analysis',
      role: i % 2 ? 'assistant' : 'user',
      text: `Turn ${i}`,
      sessionId: id,
      ...(i === 59 ? { chart } : {}),
    });
  }
  const other = await create(ctx, { title: 'Other' });
  await append(ctx, { mode: 'analysis', role: 'user', text: 'Other session', sessionId: other });
  await append(ctx, { mode: 'analysis', role: 'user', text: 'Legacy' });
  await append(ctx, { mode: 'workout', role: 'user', text: 'Workout' });
  expect(await context(ctx, { sessionId: id })).toEqual(
    Array.from({ length: 60 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user',
      content: i === 59 ? `Turn ${i}\n\nSAVED CHART: ${JSON.stringify(chart)}` : `Turn ${i}`,
    })),
  );
  const empty = await create(ctx, { title: 'New' });
  expect(await context(ctx, { sessionId: empty })).toEqual([]);
});
