import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { generateText } from 'ai';
import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { respond } from './workout';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  stepCountIs: vi.fn(),
  tool: (definition: unknown) => definition,
}));
vi.mock('@fitness/ai', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createFitnessModel: () => 'test-model',
}));
const run = (
  respond as unknown as {
    _handler: (
      ctx: ActionCtx,
      args: { requestId: Id<'workoutRequests'> },
    ) => Promise<{ text: string }>;
  }
)._handler;
const requestId = 'request-1' as Id<'workoutRequests'>;
const messages = [
  { role: 'user', content: 'Log two sets of ten push-ups' },
  { role: 'assistant', content: 'Added two sets.' },
  { role: 'user', content: 'Change the last one to twelve reps' },
];
const draft = { exercises: [{ rowId: 'row-1', sets: [{ setId: 'set-1', reps: 10 }] }] };
let ctx: ActionCtx;
const mutate = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  mutate.mockImplementation(async (ref) =>
    getFunctionName(ref) === 'aiMessages:beginWorkoutRequest'
      ? { execute: true, request: { prompt: messages[2].content } }
      : null,
  );
  ctx = {
    runMutation: mutate,
    runQuery: async (ref: Parameters<typeof getFunctionName>[0]) => {
      switch (getFunctionName(ref)) {
        case 'userProfiles:current':
          return { units: 'metric' };
        case 'exercises:list':
          return [];
        case 'workoutDrafts:current':
          return draft;
        case 'aiMessages:conversation':
          return messages;
        default:
          throw new Error('Unexpected query');
      }
    },
  } as unknown as ActionCtx;
  vi.mocked(generateText).mockResolvedValue({ text: 'Corrected.', steps: [] } as never);
});

describe('workout AI request orchestration', () => {
  it('sends all conversation messages and fresh draft state to the model', async () => {
    await run(ctx, { requestId });
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages,
        system: expect.stringContaining(JSON.stringify(draft)),
      }),
    );
    expect(vi.mocked(generateText).mock.calls[0][0]).not.toHaveProperty('prompt');
  });

  it('returns a persisted result without invoking the model again', async () => {
    mutate.mockResolvedValue({ execute: false, request: { text: 'Already completed.' } });
    expect(await run(ctx, { requestId })).toMatchObject({ text: 'Already completed.' });
    expect(generateText).not.toHaveBeenCalled();
  });

  it('records a terminal outcome when generation fails, without retrying the model action', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('Connection lost after tool execution'));
    expect(await run(ctx, { requestId })).toMatchObject({
      text: expect.stringContaining('will not run again'),
    });
    expect(mutate.mock.calls.map(([ref, args]) => [getFunctionName(ref), args])).toContainEqual([
      'aiMessages:finishWorkoutRequest',
      expect.objectContaining({ requestId, failed: true }),
    ]);
    expect(generateText).toHaveBeenCalledTimes(1);
  });
});
