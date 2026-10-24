import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { createAskUser } from './askUser';

let status: string;
let ctx: ActionCtx;
const runMutation = vi.fn();
const runQuery = vi.fn();
const input = { question: 'Which exercise?', options: ['Push-ups', 'Squats'] };
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-24T12:00:00Z'));
  vi.clearAllMocks();
  status = 'pending';
  runMutation.mockImplementation(async (ref) => {
    if (getFunctionName(ref) === 'aiQuestions:create') return 'question';
    if (status === 'pending') status = 'expired';
    return null;
  });
  runQuery.mockImplementation(async () => ({
    ...input,
    status,
    ...(status === 'answered' ? { answer: 'Push-ups' } : {}),
  }));
  ctx = { runMutation, runQuery } as unknown as ActionCtx;
});
afterEach(() => vi.useRealTimers());

function setup() {
  const questions = createAskUser(ctx, {
    mode: 'workout',
    requestId: 'request' as Id<'workoutRequests'>,
  });
  const execute = (value = input) =>
    questions.tool.execute!(value, {
      toolCallId: 'ask',
      messages: [],
      context: {},
    }) as unknown as Promise<{ status: string; answer?: string }>;
  return { questions, execute };
}

it('waits for the real answer and returns it to the tool loop with its question', async () => {
  const { execute, questions } = setup();
  let settled = false;
  const result = execute().then((answer) => {
    settled = true;
    return answer;
  });
  await vi.advanceTimersByTimeAsync(2_000);
  expect(settled).toBe(false);
  status = 'answered';
  await vi.advanceTimersByTimeAsync(1_000);
  expect(await result).toEqual({
    question: input.question,
    status: 'answered',
    answer: 'Push-ups',
  });
  expect(questions.stopped()).toBe(false);
  expect(runMutation.mock.calls.map(([ref]) => getFunctionName(ref))).toEqual([
    'aiQuestions:create',
    'aiQuestions:close',
  ]);
});

it.each(['dismissed', 'expired'])('stops the model loop after a question is %s', async (value) => {
  const { execute, questions } = setup();
  const result = execute();
  await vi.advanceTimersByTimeAsync(0);
  status = value;
  await vi.advanceTimersByTimeAsync(1_000);
  expect(await result).toEqual({ question: input.question, status: value });
  expect(questions.stopped()).toBe(true);
  expect(questions.stopText()).toBeTruthy();
  await execute();
  expect(
    runMutation.mock.calls.filter(([ref]) => getFunctionName(ref) === 'aiQuestions:create'),
  ).toHaveLength(1);
});

it('expires an abandoned question instead of keeping the AI action alive indefinitely', async () => {
  const { execute, questions } = setup();
  const result = execute();
  await vi.advanceTimersByTimeAsync(3 * 60_000);
  expect(await result).toMatchObject({ status: 'expired' });
  expect(questions.stopped()).toBe(true);
  expect(status).toBe('expired');
});

it('rejects parallel questions without replacing the first one', async () => {
  const { execute } = setup();
  const first = execute();
  await expect(execute({ question: 'How many?', options: [] })).rejects.toThrow('one question');
  status = 'answered';
  await vi.advanceTimersByTimeAsync(1_000);
  expect(await first).toHaveProperty('answer', 'Push-ups');
});
