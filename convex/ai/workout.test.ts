import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { generateText } from 'ai';
import { createFitnessModel } from '@fitness/ai';
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
  createFitnessModel: vi.fn(() => 'test-model'),
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
const prompt = 'Change the last one to twelve reps';
const draft = { exercises: [{ rowId: 'row-1', sets: [{ setId: 'set-1', reps: 10 }] }] };
let ctx: ActionCtx;
const mutate = vi.fn();
type TestTools = Record<string, { execute: (input: unknown) => Promise<unknown> }>;
function generatedTools(options: unknown): TestTools {
  return (options as { tools: TestTools }).tools;
}
const additions = { exercises: [{ exerciseId: 'exercise-1', sets: [{ reps: 10 }] }] };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  mutate.mockImplementation(async (ref) =>
    getFunctionName(ref) === 'aiMessages:beginWorkoutRequest'
      ? { execute: true, request: { prompt } }
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
        default:
          throw new Error('Unexpected query');
      }
    },
  } as unknown as ActionCtx;
  vi.mocked(generateText).mockResolvedValue({ text: 'Corrected.', steps: [] } as never);
});

describe('workout AI request orchestration', () => {
  it('uses model preferences from the authenticated profile', async () => {
    const aiSettings = { model: 'openai/gpt-5.6-sol', reasoningEffort: 'high' };
    const originalQuery = ctx.runQuery;
    ctx.runQuery = ((ref: Parameters<typeof getFunctionName>[0], args: unknown) =>
      getFunctionName(ref) === 'userProfiles:current'
        ? Promise.resolve({ units: 'metric', aiSettings })
        : originalQuery(ref as never, args as never)) as ActionCtx['runQuery'];
    await run(ctx, { requestId });
    expect(createFitnessModel).toHaveBeenCalledWith(expect.objectContaining(aiSettings));
  });
  it('retrieves saved workout and exercise data on demand through read-only tools', async () => {
    const query = vi.fn<(name: string, args: unknown) => Promise<unknown>>(async () => [
      { sets: [{ reps: 8 }] },
    ]);
    const originalQuery = ctx.runQuery;
    ctx.runQuery = ((ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
      const name = getFunctionName(ref);
      if (['workouts:recent', 'workouts:get', 'analysis:getExerciseHistory'].includes(name))
        return query(name, args);
      return originalQuery(ref as never, args as never);
    }) as ActionCtx['runQuery'];
    vi.mocked(generateText).mockImplementation(async (options) => {
      const tools = generatedTools(options);
      expect(query).not.toHaveBeenCalled();
      await tools.getRecentWorkouts.execute({ limit: 3 });
      await tools.getWorkout.execute({ workoutId: 'workout-1' });
      await tools.getExerciseHistory.execute({ exerciseId: 'exercise-1', from: '2026-09-01' });
      return { text: 'Found saved training.', steps: [] } as never;
    });
    expect(await run(ctx, { requestId })).toMatchObject({ text: 'Found saved training.' });
    expect(query.mock.calls).toEqual([
      ['workouts:recent', { limit: 3 }],
      ['workouts:get', { workoutId: 'workout-1' }],
      ['analysis:getExerciseHistory', { exerciseId: 'exercise-1', from: '2026-09-01' }],
    ]);
  });

  it('exposes targeted deletion and fresh draft reads without snapshot undo', async () => {
    vi.mocked(generateText).mockImplementation(async (options) => {
      const tools = generatedTools(options);
      expect(tools).not.toHaveProperty('undoLastDraftAction');
      expect(await tools.getCurrentDraft.execute({})).toEqual(draft);
      await tools.removeExerciseFromDraft.execute({ rowId: 'row-1' });
      await tools.removeSet.execute({ rowId: 'row-2', setId: 'set-2' });
      return { text: 'Removed the requested items.', steps: [] } as never;
    });
    await run(ctx, { requestId });
    expect(mutate.mock.calls.map(([ref, args]) => [getFunctionName(ref), args])).toEqual([
      ['aiMessages:beginWorkoutRequest', { requestId }],
      ['workoutDrafts:removeExercise', { rowId: 'row-1', source: 'ai', requestId }],
      ['workoutDrafts:removeSet', { rowId: 'row-2', setId: 'set-2', source: 'ai', requestId }],
      ['aiMessages:finishWorkoutRequest', expect.objectContaining({ failed: false })],
    ]);
  });

  it('shares the result of identical parallel and later addition retries', async () => {
    mutate.mockImplementation(async (ref) =>
      getFunctionName(ref) === 'aiMessages:beginWorkoutRequest'
        ? { execute: true, request: { prompt } }
        : ['saved-row'],
    );
    vi.mocked(generateText).mockImplementation(async (options) => {
      const add = generatedTools(options).addExercisesToDraft.execute;
      expect(await Promise.all([add(additions), add(structuredClone(additions))])).toEqual([
        ['saved-row'],
        ['saved-row'],
      ]);
      expect(await add(additions)).toEqual(['saved-row']);
      return { text: 'Added.', steps: [] } as never;
    });
    expect(await run(ctx, { requestId })).toMatchObject({ text: 'Added.' });
    expect(
      mutate.mock.calls.filter(([ref]) => getFunctionName(ref) === 'workoutDrafts:addExercises'),
    ).toHaveLength(1);
  });

  it('rejects a different second batch without undoing the successful first batch', async () => {
    let secondBatchError: unknown;
    vi.mocked(generateText).mockImplementation(async (options) => {
      const tools = generatedTools(options);
      await tools.addExercisesToDraft.execute(additions);
      try {
        await tools.addExercisesToDraft.execute({
          exercises: [{ exerciseId: 'exercise-2', sets: [{ reps: 8 }] }],
        });
      } catch (error) {
        secondBatchError = error;
      }
      throw new Error('Response failed after saving the first batch');
    });
    expect(await run(ctx, { requestId })).toMatchObject({
      text: expect.stringContaining('Any changes already saved'),
    });
    expect(secondBatchError).toMatchObject({
      message: expect.stringContaining('This different batch was not applied'),
    });
    expect(mutate.mock.calls.map(([ref]) => getFunctionName(ref))).toEqual([
      'aiMessages:beginWorkoutRequest',
      'workoutDrafts:addExercises',
      'aiMessages:finishWorkoutRequest',
    ]);
  });

  it('allows a corrected batch after a rejected addition', async () => {
    let attempts = 0;
    mutate.mockImplementation(async (ref) => {
      if (getFunctionName(ref) === 'aiMessages:beginWorkoutRequest')
        return { execute: true, request: { prompt } };
      if (getFunctionName(ref) === 'workoutDrafts:addExercises') {
        if (++attempts === 1) throw new Error('Exercise not found');
        return ['saved-row'];
      }
      return null;
    });
    vi.mocked(generateText).mockImplementation(async (options) => {
      const add = generatedTools(options).addExercisesToDraft.execute;
      await expect(add(additions)).rejects.toThrow('Exercise not found');
      expect(
        await add({ exercises: [{ exerciseId: 'correct-id', sets: [{ reps: 10 }] }] }),
      ).toEqual(['saved-row']);
      return { text: 'Added.', steps: [] } as never;
    });
    expect(await run(ctx, { requestId })).toMatchObject({ text: 'Added.' });
    expect(attempts).toBe(2);
  });

  it('uses only the persisted latest request and fresh draft, with no conversation query', async () => {
    await run(ctx, { requestId });
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt,
        system: expect.stringContaining(JSON.stringify(draft)),
      }),
    );
    expect(vi.mocked(generateText).mock.calls[0][0]).not.toHaveProperty('messages');
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
