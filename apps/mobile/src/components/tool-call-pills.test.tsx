import { createElement, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ToolCallPills } from './tool-call-pills';

vi.mock('react-native', () => ({ Pressable: 'Pressable', Text: 'Text', View: 'View' }));
vi.mock('lucide-react-native', () => ({ X: 'X' }));
vi.mock('@fitness/ui', () => ({
  Dialog: ({
    children,
    headerAction,
    ...props
  }: {
    children: ReactNode;
    headerAction: ReactNode;
  }) => createElement('Dialog', props, headerAction, children),
  IconButton: 'IconButton',
}));
vi.mock('./theme-provider', () => ({
  useAppTheme: () => ({ colors: { text: '#fff', muted: '#aaa' } }),
}));

let renderer: ReactTestRenderer;
beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));
afterEach(async () => {
  await act(() => renderer.unmount());
  vi.unstubAllGlobals();
});

it('opens each repeated call with its complete payload and supports both close actions', async () => {
  const output = Array.from({ length: 50 }, (_, reps) => ({ reps, weightKg: 80 }));
  const calls = [
    {
      toolCallId: 'first',
      toolName: 'getExerciseHistory',
      input: '{"exerciseId":"squat"}',
      output: JSON.stringify(output),
    },
    {
      toolCallId: 'second',
      toolName: 'getExerciseHistory',
      input: '{"exerciseId":"bench"}',
      error: '{"message":"Exercise not found"}',
    },
  ];
  await act(() => {
    renderer = create(createElement(ToolCallPills, { calls }));
  });
  expect(renderer.root.findAllByType('Dialog' as never)).toHaveLength(0);
  const pills = renderer.root.findAllByType('Pressable' as never);
  expect(pills).toHaveLength(2);
  await act(() => pills[0].props.onPress());
  const payload = () => renderer.root.findByProps({ selectable: true }).props.children;
  expect(JSON.parse(payload())).toEqual({
    toolCallId: 'first',
    toolName: 'getExerciseHistory',
    input: { exerciseId: 'squat' },
    output,
  });
  await act(() =>
    renderer.root.findByProps({ accessibilityLabel: 'Close tool call' }).props.onPress(),
  );
  expect(renderer.root.findAllByType('Dialog' as never)).toHaveLength(0);
  await act(() => pills[1].props.onPress());
  expect(JSON.parse(payload())).toEqual({
    toolCallId: 'second',
    toolName: 'getExerciseHistory',
    input: { exerciseId: 'bench' },
    error: { message: 'Exercise not found' },
  });
  await act(() => renderer.root.findByType('Dialog' as never).props.onRequestClose());
  expect(renderer.root.findAllByType('Dialog' as never)).toHaveLength(0);
});

it('renders legacy replies and replies with no tool calls without empty controls', async () => {
  await act(() => {
    renderer = create(createElement(ToolCallPills));
  });
  expect(renderer.toJSON()).toBeNull();
  await act(() => renderer.update(createElement(ToolCallPills, { calls: [] })));
  expect(renderer.toJSON()).toBeNull();
});
