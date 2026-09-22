import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { generateText } from 'ai';
import { createFitnessModel } from '@fitness/ai';
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
    _handler: (ctx: ActionCtx, args: { prompt: string }) => Promise<unknown>;
  }
)._handler;
const catalog = [{ _id: 'exercise-1', name: 'Squat' }];
const runQuery = vi.fn(async (ref: Parameters<typeof getFunctionName>[0]) => {
  switch (getFunctionName(ref)) {
    case 'userProfiles:current':
      return { units: 'metric' };
    case 'exercises:list':
      return catalog;
    default:
      throw new Error('Unexpected query: old conversation must not be loaded');
  }
});
const runMutation = vi.fn();
const ctx = { runQuery, runMutation } as unknown as ActionCtx;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  vi.mocked(generateText).mockResolvedValue({ text: 'Analysis.', steps: [] } as never);
});
afterEach(() => vi.unstubAllEnvs());

describe('analysis model context', () => {
  it('uses the authenticated profile preferences for both analysis and chart correction', async () => {
    const aiSettings = { model: 'openai/gpt-5.6-luna', reasoningEffort: 'none' };
    runQuery.mockResolvedValueOnce({ units: 'metric', aiSettings } as never);
    await run(ctx, { prompt: 'Plot my squat reps' });
    expect(createFitnessModel).toHaveBeenCalledTimes(2);
    for (const [config] of vi.mocked(createFitnessModel).mock.calls)
      expect(config).toMatchObject(aiSettings);
  });
  it('sends only the latest message and catalog while preserving display history', async () => {
    await run(ctx, { prompt: '  How is my squat progressing?  ' });
    const options = vi.mocked(generateText).mock.calls[0][0];
    expect(options).toMatchObject({
      prompt: 'How is my squat progressing?',
      system: expect.stringContaining(JSON.stringify(catalog)),
    });
    expect(options).not.toHaveProperty('messages');
    expect(options.tools).toHaveProperty('getExerciseHistory');
    expect(options.tools).toHaveProperty('getRecentWorkouts');
    expect(runMutation.mock.calls.map(([, args]) => args)).toEqual([
      { mode: 'analysis', role: 'user', text: 'How is my squat progressing?' },
      { mode: 'analysis', role: 'assistant', text: 'Analysis.' },
    ]);
  });

  it('limits chart correction to the latest prompt and data retrieved in this request', async () => {
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
      { role: 'user', content: 'Plot my squat reps' },
      { role: 'user', content: `RETRIEVED DATA: ${JSON.stringify(retrieved)}` },
    ]);
  });
});
