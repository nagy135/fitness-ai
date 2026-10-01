import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { generateText } from 'ai';
import { createFitnessModel } from '@fitness/ai';
import type { Id } from '../_generated/dataModel';
import type { ActionCtx } from '../_generated/server';
import { respond } from './analysis';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  stepCountIs: vi.fn(),
  tool: (definition: unknown) => definition,
}));
vi.mock('@fitness/ai', async (original) => ({
  ...(await original<typeof import('@fitness/ai')>()),
  createFitnessModel: vi.fn(() => 'test-model'),
}));
const run = (
  respond as unknown as {
    _handler: (
      ctx: ActionCtx,
      args: { prompt: string; sessionId?: Id<'analysisSessions'> },
    ) => Promise<unknown>;
  }
)._handler;
const catalog = [{ _id: 'exercise-1', name: 'Squat' }];
let history: { role: 'user' | 'assistant'; content: string }[] = [];
const runQuery = vi.fn(async (ref: Parameters<typeof getFunctionName>[0]) => {
  switch (getFunctionName(ref)) {
    case 'userProfiles:current':
      return { units: 'metric' };
    case 'exercises:list':
      return catalog;
    case 'aiMessages:analysisContext':
      return history;
    default:
      throw new Error('Unexpected query');
  }
});
const runMutation = vi.fn();
const ctx = { runQuery, runMutation } as unknown as ActionCtx;

beforeEach(() => {
  vi.clearAllMocks();
  history = [];
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  runMutation.mockResolvedValue('session-1');
  vi.mocked(generateText).mockResolvedValue({ text: 'Analysis.', steps: [] } as never);
});
afterEach(() => vi.unstubAllEnvs());

describe('analysis model context', () => {
  it('uses the authenticated profile preferences for both analysis and chart correction', async () => {
    const aiSettings = { model: 'openai/gpt-6-luna', reasoningEffort: 'none' };
    runQuery.mockResolvedValueOnce({ units: 'metric', aiSettings } as never);
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '',
      steps: [
        {
          toolCalls: [],
          toolResults: [{ toolName: 'getExerciseHistory', output: [{ reps: 10 }] }],
        },
      ],
    } as never);
    await run(ctx, { prompt: 'Plot my squat reps' });
    expect(createFitnessModel).toHaveBeenCalledTimes(2);
    for (const [config] of vi.mocked(createFitnessModel).mock.calls)
      expect(config).toMatchObject(aiSettings);
  });
  it('starts a new session with the latest message and catalog', async () => {
    await run(ctx, { prompt: '  How is my squat progressing?  ' });
    const options = vi.mocked(generateText).mock.calls[0][0];
    expect(options).toMatchObject({
      messages: [{ role: 'user', content: 'How is my squat progressing?' }],
      system: expect.stringContaining(JSON.stringify(catalog)),
    });
    expect(options).not.toHaveProperty('prompt');
    expect(options.tools).toHaveProperty('getExerciseHistory');
    expect(options.tools).toHaveProperty('getRecentWorkouts');
    expect(runMutation.mock.calls.map(([, args]) => args)).toEqual([
      { title: 'How is my squat progressing?' },
      {
        mode: 'analysis',
        role: 'user',
        text: 'How is my squat progressing?',
        sessionId: 'session-1',
      },
      { mode: 'analysis', role: 'assistant', text: 'Analysis.', sessionId: 'session-1' },
    ]);
  });

  it('preserves clarifications without forcing a chart with no data', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'Which exercise should I plot?',
      steps: [],
    } as never);
    expect(await run(ctx, { prompt: 'Draw a graph of it' })).toMatchObject({
      text: 'Which exercise should I plot?',
    });
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('includes conversation context and fresh retrieved data in chart correction', async () => {
    history = [{ role: 'user', content: 'Use pounds for my charts' }];
    const retrieved = [{ name: 'getExerciseHistory', output: [{ reps: 10 }] }];
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'A previous attempt at a chart',
      steps: [
        {
          toolCalls: [],
          toolResults: [{ toolName: retrieved[0].name, output: retrieved[0].output }],
        },
      ],
    } as never);
    await run(ctx, { prompt: 'Plot my squat reps' });
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(vi.mocked(generateText).mock.calls[1][0].messages).toEqual([
      ...history,
      { role: 'user', content: 'Plot my squat reps' },
      { role: 'user', content: `RETRIEVED DATA: ${JSON.stringify(retrieved)}` },
    ]);
  });
});

it('passes all previous turns when answering a clarification in the selected session', async () => {
  history = [
    { role: 'user', content: 'Graph my progress over the last year' },
    { role: 'assistant', content: 'Which exercise should I plot?' },
  ];
  await run(ctx, {
    prompt: 'Squat',
    sessionId: 'existing-session' as Id<'analysisSessions'>,
  });
  expect(vi.mocked(generateText).mock.calls[0][0].messages).toEqual([
    ...history,
    { role: 'user', content: 'Squat' },
  ]);
  expect(runQuery.mock.calls.map(([ref]) => getFunctionName(ref))).toContain(
    'aiMessages:analysisContext',
  );
  expect(runMutation.mock.calls.map(([ref]) => getFunctionName(ref))).toEqual([
    'aiMessages:append',
    'aiMessages:append',
  ]);
  for (const [, args] of runMutation.mock.calls) expect(args.sessionId).toBe('existing-session');
});

it('does not invoke the model when the selected session cannot be accessed', async () => {
  runMutation.mockRejectedValueOnce(new Error('Analysis not found'));
  await expect(
    run(ctx, { prompt: 'Squat progress', sessionId: 'foreign' as Id<'analysisSessions'> }),
  ).rejects.toThrow('Analysis not found');
  expect(generateText).not.toHaveBeenCalled();
});
