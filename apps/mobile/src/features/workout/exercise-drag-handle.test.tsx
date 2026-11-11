import { createElement, type ComponentProps } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PanResponderCallbacks } from 'react-native';
import { ExerciseDragHandle } from './exercise-drag-handle';

let handlers: PanResponderCallbacks;
vi.mock('react-native', () => ({
  View: 'View',
  PanResponder: {
    create: (callbacks: PanResponderCallbacks) => {
      handlers = callbacks;
      return { panHandlers: {} };
    },
  },
}));
vi.mock('lucide-react-native', () => ({ GripVertical: 'GripVertical' }));
vi.mock('@/components/theme-provider', () => ({ useAppTheme: () => ({ colors: {} }) }));
let renderer: ReactTestRenderer;
let props: ComponentProps<typeof ExerciseDragHandle>;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  props = {
    name: 'Bench',
    disabled: false,
    canMoveUp: false,
    canMoveDown: true,
    onStart: vi.fn(),
    onMove: vi.fn(),
    onEnd: vi.fn(),
    onCancel: vi.fn(),
    onStep: vi.fn(),
  };
  await act(() => {
    renderer = create(createElement(ExerciseDragHandle, props));
  });
});
afterEach(async () => {
  await act(() => renderer.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const event = { nativeEvent: { pageY: 100 } } as never;
const gesture = (dy: number) => ({ dy, dx: 0, moveY: 100 + dy }) as never;
it('requires a hold before dragging and commits only on release', async () => {
  await act(() => handlers.onPanResponderGrant?.(event, gesture(0)));
  await act(() => {
    vi.advanceTimersByTime(349);
  });
  expect(props.onStart).not.toHaveBeenCalled();
  await act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(props.onStart).toHaveBeenCalledWith(100);
  await act(() => handlers.onPanResponderMove?.(event, gesture(60)));
  expect(props.onMove).toHaveBeenCalledWith(60, 160);
  expect(props.onEnd).not.toHaveBeenCalled();
  await act(() => handlers.onPanResponderRelease?.(event, gesture(60)));
  expect(props.onEnd).toHaveBeenCalledOnce();
});
it('cancels early movement and interrupted gestures', async () => {
  await act(() => handlers.onPanResponderGrant?.(event, gesture(0)));
  await act(() => handlers.onPanResponderMove?.(event, gesture(15)));
  await act(() => {
    vi.advanceTimersByTime(400);
  });
  await act(() => handlers.onPanResponderRelease?.(event, gesture(15)));
  expect(props.onStart).not.toHaveBeenCalled();
  expect(props.onEnd).not.toHaveBeenCalled();
  await act(() => handlers.onPanResponderGrant?.(event, gesture(0)));
  await act(() => {
    vi.advanceTimersByTime(350);
  });
  await act(() => handlers.onPanResponderTerminate?.(event, gesture(0)));
  expect(props.onCancel).toHaveBeenCalledOnce();
  expect(props.onEnd).not.toHaveBeenCalled();
});
