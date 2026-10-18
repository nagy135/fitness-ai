import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WorkoutReviewBar } from './workout-review-bar';
import type { WorkoutExchange } from './latest-workout-exchange';
import type { ToolCallRecord } from '@fitness/ai';

vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('@fitness/ui', () => ({ Button: 'Button' }));
let renderer: ReactTestRenderer;
const props = { busy: false, hasSets: true, editing: false, onChat: vi.fn(), onReview: vi.fn() };
const chat = () => renderer.root.findByProps({ accessibilityLabel: 'Open chat' });
const call = (toolName: string): ToolCallRecord => ({
  toolCallId: toolName,
  toolName,
  input: '{}',
});
async function render(response?: WorkoutExchange) {
  await act(() => renderer.update(createElement(WorkoutReviewBar, { ...props, response })));
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  await act(() => {
    renderer = create(createElement(WorkoutReviewBar, props));
  });
});
afterEach(async () => {
  await act(() => renderer.unmount());
  vi.unstubAllGlobals();
});

it('opens Chat from its button even before there are replies', async () => {
  expect(props.onChat).not.toHaveBeenCalled();
  expect(chat().props.children).toBe('Chat →');
  await act(() => chat().props.onPress());
  expect(props.onChat).toHaveBeenCalledOnce();
});

it('opens Chat once per qualifying reply and allows returning without reopening on refresh', async () => {
  const response = { id: 'reply-1', prompt: 'Which exercise?', text: 'Do you mean bench press?' };
  await render(response);
  expect(props.onChat).toHaveBeenCalledOnce();
  await render({ ...response });
  expect(props.onChat).toHaveBeenCalledOnce();
  const nextHandler = vi.fn();
  await act(() =>
    renderer.update(createElement(WorkoutReviewBar, { ...props, response, onChat: nextHandler })),
  );
  expect(nextHandler).not.toHaveBeenCalled();
  await render({ id: 'reply-2', prompt: 'Yes', text: 'How many reps?' });
  expect(props.onChat).toHaveBeenCalledTimes(2);
});

it.each([
  'getCurrentDraft',
  'getRecentWorkouts',
  'getWorkout',
  'searchWorkouts',
  'getExerciseRecords',
  'getExerciseHistory',
  'searchUserExercises',
])('opens Chat for replies using the read-only %s tool', async (toolName) => {
  await render({
    id: 'read',
    prompt: 'Show my records',
    text: 'Your records',
    toolCalls: [call(toolName)],
  });
  expect(props.onChat).toHaveBeenCalledOnce();
});

it.each([
  'createUserExercise',
  'updateUserExercise',
  'addExercisesToDraft',
  'removeExerciseFromDraft',
  'updateSet',
  'removeSet',
  'updateExerciseNotes',
  'reorderExercises',
  'futureExerciseWrite',
])('stays on exercises for %s replies while keeping Chat available', async (toolName) => {
  await render({
    id: 'write',
    prompt: 'Change my exercises',
    text: 'Updated',
    toolCalls: [call(toolName)],
  });
  expect(props.onChat).not.toHaveBeenCalled();
  await act(() => chat().props.onPress());
  expect(props.onChat).toHaveBeenCalledOnce();
});

it.each([false, true])(
  'stays on exercises for mixed replies regardless of write order (%s)',
  async (writeFirst) => {
    const reads = [call('getExerciseRecords'), call('getCurrentDraft')];
    const write = call('addExercisesToDraft');
    await render({
      id: 'mixed',
      prompt: 'Repeat that session',
      text: 'Added',
      toolCalls: writeFirst ? [write, ...reads] : [...reads, write],
    });
    expect(props.onChat).not.toHaveBeenCalled();
  },
);

it('stays on exercises for failed writes and opens a later read-only reply', async () => {
  await render({
    id: 'failed',
    prompt: 'Update bench',
    text: 'Failed',
    toolCalls: [{ ...call('updateSet'), error: 'Failed' }],
  });
  expect(props.onChat).not.toHaveBeenCalled();
  await render({
    id: 'read',
    prompt: 'Last bench session?',
    text: 'Your records',
    toolCalls: [call('getExerciseRecords')],
  });
  expect(props.onChat).toHaveBeenCalledOnce();
});

it.each([undefined, []])(
  'opens Chat for mounted replies with tools %s and resets when cleared',
  async (toolCalls) => {
    await act(() => renderer.unmount());
    const response = { id: 'saved', prompt: 'Bench?', text: 'Which set?', toolCalls };
    await act(() => {
      renderer = create(createElement(WorkoutReviewBar, { ...props, response }));
    });
    expect(props.onChat).toHaveBeenCalledOnce();
    await render();
    expect(props.onChat).toHaveBeenCalledOnce();
    await render(response);
    expect(props.onChat).toHaveBeenCalledTimes(2);
  },
);
