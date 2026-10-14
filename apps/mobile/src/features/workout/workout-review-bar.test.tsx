import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WorkoutReviewBar } from './workout-review-bar';
import type { WorkoutExchange } from './latest-workout-exchange';
vi.mock('react-native', () => ({ ScrollView: 'ScrollView', Text: 'Text', View: 'View' }));
vi.mock('@fitness/ui', () => ({ Button: 'Button' }));
vi.mock('@/components/tool-call-pills', () => ({ ToolCallPills: 'ToolCallPills' }));
vi.mock('@/components/analysis-markdown', () => ({ AnalysisMarkdown: 'AnalysisMarkdown' }));
let renderer: ReactTestRenderer;
const props = { busy: false, hasSets: true, editing: false, onReview: vi.fn() };
const toggle = () => renderer.root.findByProps({ accessibilityLabel: 'Show reply history' });
const shown = () => toggle().props.accessibilityState.checked;
const markdown = () => renderer.root.findByType('AnalysisMarkdown' as never);
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
it('keeps history closed when replies arrive, including unchanged refreshes', async () => {
  expect(() => toggle()).toThrow();
  const response = { id: 'reply-1', prompt: 'Add bench press', text: 'Added a set' };
  await render(response);
  expect(shown()).toBe(false);
  await render({ ...response });
  expect(shown()).toBe(false);
  await render({ id: 'reply-2', prompt: 'Add another', text: 'Added a set' });
  expect(shown()).toBe(false);
  expect(renderer.root.findAllByType('ScrollView' as never)).toHaveLength(0);
});
it('preserves the manual toggle choice as the latest exchange changes', async () => {
  await render({ id: 'reply-1', prompt: 'First prompt', text: 'First' });
  await act(() => toggle().props.onPress());
  expect(shown()).toBe(true);
  await render({ id: 'reply-2', prompt: 'Second prompt', text: 'Second' });
  expect(shown()).toBe(true);
  expect(renderer.root.findAllByProps({ children: 'First prompt' })).toHaveLength(0);
  expect(renderer.root.findByProps({ children: 'Second prompt' })).toBeDefined();
  expect(markdown().props.text).toBe('Second');
  await act(() => toggle().props.onPress());
  expect(shown()).toBe(false);
  await render({ id: 'reply-3', prompt: 'Third prompt', text: 'Third' });
  expect(shown()).toBe(false);
  await act(() => toggle().props.onPress());
  expect(markdown().props.text).toBe('Third');
});

it('starts collapsed when mounted with an existing reply', async () => {
  await act(() => renderer.unmount());
  await act(() => {
    renderer = create(
      createElement(WorkoutReviewBar, {
        ...props,
        response: { id: 'saved', prompt: 'Bench press', text: 'Added a set' },
      }),
    );
  });
  expect(shown()).toBe(false);
});

it('shows the prompt and Markdown reply in the expanded history panel', async () => {
  const response = { id: 'reply', prompt: 'Bench 80 kg for 8', text: '**Logged** `bench`' };
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
  await render({ id: 'reply', prompt: 'Add bench press', text: 'Added a set' });
  await act(() => toggle().props.onPress());
  expect(shown()).toBe(true);
  await render();
  expect(() => toggle()).toThrow();
  expect(renderer.root.findAllByType('ScrollView' as never)).toHaveLength(0);
});
