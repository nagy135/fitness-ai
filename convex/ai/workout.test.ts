import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { generateText } from 'ai';
import { createFitnessModel, workoutToolNames } from '@fitness/ai';
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
const draft = {
  exercises: [
    {
      rowId: 'row-1',
      exerciseId: 'exercise-1',
      name: 'Push-ups',
      sets: [{ setId: 'set-1', reps: 10 }],
    },
  ],
};
let currentDraft: typeof draft;
let conversation: { role: 'user' | 'assistant'; content: string }[];
let ctx: ActionCtx;
const mutate = vi.fn();
type TestTools = Record<string, { execute: (input: unknown) => Promise<unknown> }>;
function generatedTools(options: unknown): TestTools {
  return (options as { tools: TestTools }).tools;
}
const additions = { exercises: [{ exerciseId: 'exercise-1', sets: [{ reps: 10 }] }] };
beforeEach(() => {
  vi.clearAllMocks();
  conversation = [];
  currentDraft = structuredClone(draft);
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  mutate.mockImplementation(async (ref) =>
    getFunctionName(ref) === 'aiMessages:beginWorkoutRequest'
      ? { execute: true, request: { prompt } }
      : null,
  );
  ctx = {
    runMutation: mutate,
    runQuery: vi.fn(async (ref: Parameters<typeof getFunctionName>[0]) => {
      switch (getFunctionName(ref)) {
        case 'userProfiles:current':
          return { units: 'metric' };
        case 'exercises:list':
          return [];
        case 'workoutDrafts:current':
          return currentDraft;
        case 'aiMessages:workoutContext':
          return conversation;
        default:
          throw new Error('Unexpected query');
      }
    }),
  } as unknown as ActionCtx;
  vi.mocked(generateText).mockResolvedValue({ text: 'Corrected.', steps: [] } as never);
});

describe('workout AI request orchestration', () => {
  it('exposes every declared workout tool, including read-only previous records', async () => {
    await run(ctx, { requestId });
    expect(Object.keys(generatedTools(vi.mocked(generateText).mock.calls[0][0])).sort()).toEqual(
      [...workoutToolNames].sort(),
    );
  });

  it('uses model preferences from the authenticated profile', async () => {
    const aiSettings = { model: 'openai/gpt-6-astra', reasoningEffort: 'high' };
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
      if (
        [
          'workouts:recent',
          'workouts:get',
          'analysis:searchWorkouts',
          'analysis:getExerciseHistory',
        ].includes(name)
      )
        return query(name, args);
      return originalQuery(ref as never, args as never);
    }) as ActionCtx['runQuery'];
    vi.mocked(generateText).mockImplementation(async (options) => {
      const tools = generatedTools(options);
      expect(query).not.toHaveBeenCalled();
      await tools.getRecentWorkouts.execute({ limit: 3 });
      await tools.getWorkout.execute({ workoutId: 'workout-1' });
      await tools.searchWorkouts.execute({
        query: 'Push-ups',
        from: '2026-01-01',
        to: '2026-01-31',
        limit: 5,
      });
      await tools.getExerciseHistory.execute({ exerciseId: 'exercise-1' });
      await tools.getExerciseHistory.execute({ exerciseId: 'exercise-1', from: '2026-09-01' });
      return { text: 'Found saved training.', steps: [] } as never;
    });
    expect(await run(ctx, { requestId })).toMatchObject({ text: 'Found saved training.' });
    expect(query.mock.calls).toEqual([
      ['workouts:recent', { limit: 3 }],
      ['workouts:get', { workoutId: 'workout-1' }],
      [
        'analysis:searchWorkouts',
        { query: 'Push-ups', from: '2026-01-01', to: '2026-01-31', limit: 5 },
      ],
      ['analysis:getExerciseHistory', { exerciseId: 'exercise-1' }],
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

  it('sends the full conversation and latest prompt with the fresh draft', async () => {
    conversation = [
      { role: 'user', content: 'Log two sets of ten push-ups' },
      { role: 'assistant', content: 'Added two sets.' },
    ];
    await run(ctx, { requestId });
    const options = vi.mocked(generateText).mock.calls[0][0];
    expect(options.messages).toEqual([...conversation, { role: 'user', content: prompt }]);
    expect(options.system).toContain(JSON.stringify(draft));
    expect(options).not.toHaveProperty('prompt');
    expect(ctx.runQuery).toHaveBeenCalledWith(expect.anything(), { requestId });
    expect(vi.mocked(ctx.runQuery).mock.calls.map(([ref]) => getFunctionName(ref))).toEqual([
      'userProfiles:current',
      'exercises:list',
      'workoutDrafts:current',
      'aiMessages:workoutContext',
    ]);
  });

  it.each([
    ['10 reps', 'Which exercise?', 'Push-ups'],
    ['Log push-ups', 'How many reps?', '10 reps'],
    ['Repeat the previous record', 'Which exercise?', 'Push-ups'],
  ])(
    'retains the pending exchange %s / %s when the user answers %s',
    async (first, question, answer) => {
      conversation = [
        { role: 'user', content: first },
        { role: 'assistant', content: question },
      ];
      mutate.mockImplementation(async (ref) =>
        getFunctionName(ref) === 'aiMessages:beginWorkoutRequest'
          ? { execute: true, request: { prompt: answer } }
          : null,
      );
      await run(ctx, { requestId });
      expect(vi.mocked(generateText).mock.calls[0][0].messages).toEqual([
        ...conversation,
        { role: 'user', content: answer },
      ]);
    },
  );

  it('keeps the full conversation beyond the UI history limit', async () => {
    conversation = Array.from({ length: 120 }, (_, index) => ({
      role: index % 2 ? 'assistant' : 'user',
      content: `Turn ${index}`,
    }));
    await run(ctx, { requestId });
    const options = vi.mocked(generateText).mock.calls[0][0];
    expect(options.messages).toEqual([...conversation, { role: 'user', content: prompt }]);
  });

  it('reloads all currently logged exercises and edited sets alongside earlier conversation', async () => {
    await run(ctx, { requestId });
    conversation = [
      { role: 'user', content: 'Log 10 push-ups' },
      { role: 'assistant', content: 'Added 10 push-ups.' },
    ];
    currentDraft = {
      exercises: [
        { ...draft.exercises[0], sets: [{ setId: 'set-1', reps: 12 }] },
        {
          rowId: 'row-2',
          exerciseId: 'exercise-2',
          name: 'Squats',
          sets: [
            { setId: 'set-2', reps: 15 },
            { setId: 'set-3', reps: 10 },
          ],
        },
      ],
    };
    await run(ctx, { requestId: 'request-2' as Id<'workoutRequests'> });
    const options = vi.mocked(generateText).mock.calls[1][0];
    expect(options.system).toContain(`CURRENT DRAFT: ${JSON.stringify(currentDraft)}`);
    expect(options.messages).toEqual([...conversation, { role: 'user', content: prompt }]);
  });

  it('does not invoke the model with incomplete conversation context', async () => {
    ctx.runQuery = vi.fn().mockRejectedValue(new Error('Context could not be loaded'));
    expect(await run(ctx, { requestId })).toMatchObject({
      text: expect.stringContaining('did not finish'),
    });
    expect(generateText).not.toHaveBeenCalled();
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

it('answers a last-time question through the previous-record tool without modifying the draft', async () => {
  const prompt = 'What did I log last time on this exercise?';
  conversation = [
    { role: 'user', content: 'Log 10 push-ups' },
    { role: 'assistant', content: 'Added 10 push-ups.' },
  ];
  const previous = {
    workoutId: 'saved',
    performedAt: Date.parse('2026-09-30T08:00:00Z'),
    sets: [{ reps: 8 }, { reps: 6 }],
  };
  const lookup = vi.fn(async () => ({ previous, maximums: [] }));
  const originalQuery = ctx.runQuery;
  ctx.runQuery = ((ref: Parameters<typeof getFunctionName>[0], args: unknown) =>
    getFunctionName(ref) === 'analysis:getExerciseRecords'
      ? lookup()
      : originalQuery(ref as never, args as never)) as ActionCtx['runQuery'];
  mutate.mockImplementation(async (ref) =>
    getFunctionName(ref) === 'aiMessages:beginWorkoutRequest'
      ? { execute: true, request: { prompt } }
      : null,
  );
  vi.mocked(generateText).mockImplementation(async (options) => {
    expect(lookup).not.toHaveBeenCalled();
    expect(options.messages).toEqual([...conversation, { role: 'user', content: prompt }]);
    expect(options.system).toContain(`CURRENT DRAFT: ${JSON.stringify(currentDraft)}`);
    const records = await generatedTools(options).getExerciseRecords.execute({
      exerciseId: 'exercise-1',
    });
    expect(records).toEqual({ previous, maximums: [] });
    return {
      text: 'On September 30 you logged 2 push-up sets: 8 reps, then 6 reps.',
      steps: [],
    } as never;
  });
  const before = structuredClone(currentDraft);
  expect(await run(ctx, { requestId })).toMatchObject({
    text: expect.stringContaining('8 reps, then 6 reps'),
  });
  expect(lookup).toHaveBeenCalledOnce();
  expect(currentDraft).toEqual(before);
  expect(mutate.mock.calls.map(([ref]) => getFunctionName(ref))).toEqual([
    'aiMessages:beginWorkoutRequest',
    'aiMessages:finishWorkoutRequest',
  ]);
});

it('copies all retrieved previous sets through the fenced draft addition tool', async () => {
  const sets = [
    { weightKg: 80, reps: 8 },
    { weightKg: 75, reps: 10 },
  ];
  const originalQuery = ctx.runQuery;
  ctx.runQuery = ((ref: Parameters<typeof getFunctionName>[0], args: unknown) =>
    getFunctionName(ref) === 'analysis:getExerciseRecords'
      ? Promise.resolve({ previous: { workoutId: 'saved', performedAt: 20, sets }, maximums: [] })
      : originalQuery(ref as never, args as never)) as ActionCtx['runQuery'];
  vi.mocked(generateText).mockImplementation(async (options) => {
    const tools = generatedTools(options);
    const records = (await tools.getExerciseRecords.execute({ exerciseId: 'exercise-1' })) as {
      previous: { sets: typeof sets };
    };
    await tools.addExercisesToDraft.execute({
      exercises: [{ exerciseId: 'exercise-1', sets: records.previous.sets }],
    });
    return { text: 'Appended both previous sets to your draft.', steps: [] } as never;
  });
  await run(ctx, { requestId });
  const additions = mutate.mock.calls.filter(
    ([ref]) => getFunctionName(ref) === 'workoutDrafts:addExercises',
  );
  expect(additions).toHaveLength(1);
  expect(additions[0][1]).toEqual({
    exercises: [{ exerciseId: 'exercise-1', sets }],
    source: 'ai',
    requestId,
  });
  expect(mutate.mock.calls.some(([ref]) => getFunctionName(ref).startsWith('workouts:'))).toBe(
    false,
  );
});
