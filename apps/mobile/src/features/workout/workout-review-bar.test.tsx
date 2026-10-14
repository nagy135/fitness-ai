import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WorkoutReviewBar } from './workout-review-bar';
import type { WorkoutExchange } from './latest-workout-exchange';
import type { ToolCallRecord } from '@fitness/ai';
vi.mock('react-native', () => ({ ScrollView: 'ScrollView', Text: 'Text', View: 'View' }));
vi.mock('@fitness/ui', () => ({ Button: 'Button' }));
vi.mock('@/components/tool-call-pills', () => ({ ToolCallPills: 'ToolCallPills' }));
vi.mock('@/components/analysis-markdown', () => ({ AnalysisMarkdown: 'AnalysisMarkdown' }));
let renderer: ReactTestRenderer;
const props = { busy: false, hasSets: true, editing: false, onReview: vi.fn() };
const toggle = () => renderer.root.findByProps({ accessibilityLabel: 'Show reply history' });
const shown = () => toggle().props.accessibilityState.checked;
const markdown = () => renderer.root.findByType('AnalysisMarkdown' as never);
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
  await act(() => {
    renderer = create(createElement(WorkoutReviewBar, props));
  });
});
afterEach(async () => {
  await act(() => renderer.unmount());
  vi.unstubAllGlobals();
});
it('opens a new reply without tools and preserves manual dismissal on refresh', async () => {
  expect(() => toggle()).toThrow();
  const response = { id: 'reply-1', prompt: 'Which exercise?', text: 'Do you mean bench press?' };
  await render(response);
  expect(shown()).toBe(true);
  await act(() => toggle().props.onPress());
  expect(shown()).toBe(false);
  await render({ ...response });
  expect(shown()).toBe(false);
  await render({ id: 'reply-2', prompt: 'Yes', text: 'How many reps?' });
  expect(shown()).toBe(true);
});

it.each([
  'getCurrentDraft',
  'getRecentWorkouts',
  'getWorkout',
  'searchWorkouts',
  'getExerciseRecords',
  'getExerciseHistory',
  'searchUserExercises',
])('opens replies that use the read-only %s tool', async (toolName) => {
  await render({
    id: 'read',
    prompt: 'Show my records',
    text: 'Your records',
    toolCalls: [call(toolName)],
  });
  expect(shown()).toBe(true);
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
])('keeps replies using %s closed and allows manual opening', async (toolName) => {
  await render({
    id: 'write',
    prompt: 'Change my exercises',
    text: 'Updated',
    toolCalls: [call(toolName)],
  });
  expect(shown()).toBe(false);
  expect(renderer.root.findAllByType('ScrollView' as never)).toHaveLength(0);
  await act(() => toggle().props.onPress());
  expect(shown()).toBe(true);
  await render({
    id: 'write',
    prompt: 'Change my exercises',
    text: 'Updated',
    toolCalls: [call(toolName)],
  });
  expect(shown()).toBe(true);
});

it.each([false, true])(
  'collapses a new mixed reply regardless of write position (%s)',
  async (writeFirst) => {
    await render({
      id: 'read',
      prompt: 'Last bench session?',
      text: 'Your previous session',
      toolCalls: [call('getExerciseRecords')],
    });
    expect(shown()).toBe(true);
    const reads = [call('getExerciseRecords'), call('getCurrentDraft')];
    const write = call('addExercisesToDraft');
    const calls = writeFirst ? [write, ...reads] : [...reads, write];
    await render({ id: 'mixed', prompt: 'Repeat that session', text: 'Added', toolCalls: calls });
    expect(shown()).toBe(false);
    await render({
      id: 'next-read',
      prompt: 'What changed?',
      text: 'Here is the current draft',
      toolCalls: [call('getCurrentDraft')],
    });
    expect(shown()).toBe(true);
  },
);

it('keeps failed write attempts and unknown tools closed', async () => {
  await render({
    id: 'failed',
    prompt: 'Update bench',
    text: 'Could not update',
    toolCalls: [{ ...call('updateSet'), error: 'Failed' }],
  });
  expect(shown()).toBe(false);
  await render({
    id: 'unknown',
    prompt: 'Change bench',
    text: 'Done',
    toolCalls: [call('futureExerciseWrite')],
  });
  expect(shown()).toBe(false);
});

it.each([undefined, []])('opens a mounted read-only reply with tools %s', async (toolCalls) => {
  await act(() => renderer.unmount());
  await act(() => {
    renderer = create(
      createElement(WorkoutReviewBar, {
        ...props,
        response: { id: 'saved-read', prompt: 'Bench press?', text: 'Which set?', toolCalls },
      }),
    );
  });
  expect(shown()).toBe(true);
});

it('starts collapsed when mounted with an existing write reply', async () => {
  await act(() => renderer.unmount());
  await act(() => {
    renderer = create(
      createElement(WorkoutReviewBar, {
        ...props,
        response: {
          id: 'saved-write',
          prompt: 'Bench press',
          text: 'Added a set',
          toolCalls: [call('addExercisesToDraft')],
        },
      }),
    );
  });
  expect(shown()).toBe(false);
});

it('shows the prompt and Markdown reply in the expanded history panel', async () => {
  const response = {
    id: 'reply',
    prompt: 'Bench 80 kg for 8',
    text: '**Logged** `bench`',
    toolCalls: [call('addExercisesToDraft')],
  };
  await render(response);
  await act(() => toggle().props.onPress());
  expect(toggle().props.style.height).toBe(48);
  expect(toggle().props.className).not.toContain('h-full');
  expect(renderer.root.findByType('ScrollView' as never).props.style.maxHeight).toBe(240);
  expect(renderer.root.findByProps({ children: response.prompt })).toBeDefined();
  expect(markdown().props).toMatchObject({ text: response.text, compact: true });
  await act(() => toggle().props.onPress());
  await render({ ...response });
  expect(shown()).toBe(false);
  expect(toggle().props.disabled).toBe(false);
});

it('passes the latest reply tools into history when manually opened', async () => {
  const toolCalls = [
    { toolCallId: 'call-1', toolName: 'updateSet', input: '{"reps":12}', output: 'null' },
  ];
  await render({ id: 'reply', prompt: 'Twelve reps', text: 'Updated', toolCalls });
  await act(() => toggle().props.onPress());
  const pills = renderer.root.findByType('ToolCallPills' as never);
  expect(pills.props.calls).toEqual(toolCalls);
  expect(shown()).toBe(true);
});

it('removes history when the exchange is cleared', async () => {
  await render({ id: 'reply', prompt: 'Which bench set?', text: 'Which exercise?' });
  expect(shown()).toBe(true);
  await render();
  expect(() => toggle()).toThrow();
  expect(renderer.root.findAllByType('ScrollView' as never)).toHaveLength(0);
});
