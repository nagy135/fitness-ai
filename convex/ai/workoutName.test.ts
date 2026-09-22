import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateText } from 'ai';
import { createFitnessModel } from '@fitness/ai';
import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { suggest } from './workoutName';

vi.mock('ai', () => ({ generateText: vi.fn(), Output: { object: vi.fn() } }));
vi.mock('@fitness/ai', async (original) => ({
  ...(await original<typeof import('@fitness/ai')>()),
  createFitnessModel: vi.fn(() => 'test-model'),
}));
const handler = (
  suggest as unknown as {
    _handler: (ctx: ActionCtx, args: { draftId: Id<'workoutDrafts'> }) => Promise<string>;
  }
)._handler;
const runQuery = vi.fn();
const ctx = { runQuery } as unknown as ActionCtx;
const args = { draftId: 'draft-1' as Id<'workoutDrafts'> };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  vi.stubEnv('AI_PROVIDER', 'openrouter');
});

describe('workout name suggestions', () => {
  afterEach(() => vi.unstubAllEnvs());
  it.each([{ previousWorkouts: [] }, { previousWorkouts: [{ name: '', exercises: ['Squat'] }] }])(
    'skips the model without named history: %j',
    async ({ previousWorkouts }) => {
      runQuery.mockResolvedValue({ exercises: ['Squat'], previousWorkouts });
      expect(await handler(ctx, args)).toBe('');
      expect(generateText).not.toHaveBeenCalled();
    },
  );

  it('uses the authenticated context and returns only a validated suggested name', async () => {
    const context = {
      exercises: ['Squat'],
      previousWorkouts: [{ name: 'Legs A', exercises: ['Squat', 'Lunge'] }],
    };
    runQuery.mockResolvedValue(context);
    vi.mocked(generateText).mockResolvedValue({ output: { name: ' Legs A ' } } as never);
    expect(await handler(ctx, args)).toBe('Legs A');
    expect(runQuery).toHaveBeenCalledWith(expect.anything(), args);
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: JSON.stringify(context) }),
    );
    expect(vi.mocked(generateText).mock.calls[0][0]).not.toHaveProperty('tools');
  });

  it('accepts no match and rejects invalid model output', async () => {
    runQuery.mockResolvedValue({
      exercises: ['Run'],
      previousWorkouts: [{ name: 'Legs A', exercises: ['Squat'] }],
    });
    vi.mocked(generateText).mockResolvedValueOnce({ output: { name: '' } } as never);
    expect(await handler(ctx, args)).toBe('');
    vi.mocked(generateText).mockResolvedValueOnce({ output: { name: 'x'.repeat(101) } } as never);
    await expect(handler(ctx, args)).rejects.toThrow();
  });

  it('uses account model preferences without including them in the naming prompt', async () => {
    const aiSettings = { model: 'openai/gpt-5.6-sol', reasoningEffort: 'high' };
    const context = {
      exercises: ['Squat'],
      previousWorkouts: [{ name: 'Legs', exercises: ['Squat'] }],
    };
    runQuery.mockResolvedValue({ ...context, aiSettings });
    vi.mocked(generateText).mockResolvedValue({ output: { name: 'Legs' } } as never);
    await handler(ctx, args);
    expect(createFitnessModel).toHaveBeenCalledWith(expect.objectContaining(aiSettings));
    expect(vi.mocked(generateText).mock.calls[0][0].prompt).toBe(JSON.stringify(context));
  });

  it('does not call the model when the authenticated context rejects access', async () => {
    runQuery.mockRejectedValue(new Error('Workout draft not found'));
    await expect(handler(ctx, args)).rejects.toThrow('Workout draft not found');
    expect(generateText).not.toHaveBeenCalled();
  });
});
