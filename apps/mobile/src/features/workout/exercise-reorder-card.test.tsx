import { createElement, type ComponentProps } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PanResponderCallbacks } from 'react-native';
import { ExerciseReorderCard } from './exercise-reorder-card';

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
let renderer: ReactTestRenderer;
let props: ComponentProps<typeof ExerciseReorderCard>;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  props = {
    name: 'Bench',
    reordering: false,
    disabled: false,
    canMoveUp: false,
    canMoveDown: true,
    style: {},
    onLayout: vi.fn(),
    onEnter: vi.fn(),
    onStart: vi.fn(),
    onMove: vi.fn(),
    onEnd: vi.fn(),
    onCancel: vi.fn(),
    onStep: vi.fn(),
  };
  await act(() => {
    renderer = create(createElement(ExerciseReorderCard, props));
  });
});
afterEach(async () => {
  await act(() => renderer.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const event = { nativeEvent: { pageX: 20, pageY: 100 } } as never;
const gesture = (dy: number) => ({ dy, dx: 0, moveY: 100 + dy }) as never;
it('leaves taps to children, enters mode on hold, then drags from the whole card', async () => {
  expect(handlers.onStartShouldSetPanResponderCapture?.(event, gesture(0))).toBe(false);
  await act(() => {
    vi.advanceTimersByTime(449);
  });
  expect(props.onEnter).not.toHaveBeenCalled();
  await act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(props.onEnter).toHaveBeenCalledOnce();
  expect(props.onStart).not.toHaveBeenCalled();
  await act(() =>
    renderer.update(createElement(ExerciseReorderCard, { ...props, reordering: true })),
  );
  expect(handlers.onStartShouldSetPanResponderCapture?.(event, gesture(0))).toBe(true);
  await act(() => handlers.onPanResponderGrant?.(event, gesture(0)));
  await act(() => handlers.onPanResponderMove?.(event, gesture(60)));
  expect(props.onStart).toHaveBeenCalledWith(100);
  expect(props.onMove).toHaveBeenCalledWith(60, 160);
  await act(() => handlers.onPanResponderRelease?.(event, gesture(60)));
  expect(props.onEnd).toHaveBeenCalledOnce();
});
it('does not enter mode for scrolling or a short tap and cancels interrupted drags', async () => {
  handlers.onStartShouldSetPanResponderCapture?.(event, gesture(0));
  handlers.onMoveShouldSetPanResponderCapture?.(event, gesture(15));
  await act(() => {
    vi.advanceTimersByTime(500);
  });
  expect(props.onEnter).not.toHaveBeenCalled();
  handlers.onStartShouldSetPanResponderCapture?.(event, gesture(0));
  renderer.root.findByType('View' as never).props.onTouchEnd();
  await act(() => {
    vi.advanceTimersByTime(500);
  });
  expect(props.onEnter).not.toHaveBeenCalled();
  await act(() =>
    renderer.update(createElement(ExerciseReorderCard, { ...props, reordering: true })),
  );
  await act(() => handlers.onPanResponderGrant?.(event, gesture(0)));
  await act(() => handlers.onPanResponderTerminate?.(event, gesture(0)));
  expect(props.onCancel).toHaveBeenCalledOnce();
  expect(props.onEnd).not.toHaveBeenCalled();
});
