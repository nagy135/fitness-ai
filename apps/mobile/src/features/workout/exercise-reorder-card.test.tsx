import { createElement, type ComponentProps } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ExerciseReorderCard } from './exercise-reorder-card';

const native = vi.hoisted(() => ({
  callbacks: {} as Record<string, (...args: any[]) => void>,
  enabled: vi.fn(),
  delay: vi.fn(),
  outside: vi.fn(),
}));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('react-native-gesture-handler', () => ({
  GestureDetector: 'GestureDetector',
  Gesture: {
    Pan: () => {
      const pan = {
        enabled: (value: boolean) => {
          native.enabled(value);
          return pan;
        },
        activateAfterLongPress: (value: number) => {
          native.delay(value);
          return pan;
        },
        shouldCancelWhenOutside: (value: boolean) => {
          native.outside(value);
          return pan;
        },
        runOnJS: () => pan,
        onStart: (callback: (...args: any[]) => void) => {
          native.callbacks.start = callback;
          return pan;
        },
        onUpdate: (callback: (...args: any[]) => void) => {
          native.callbacks.update = callback;
          return pan;
        },
        onEnd: (callback: (...args: any[]) => void) => {
          native.callbacks.end = callback;
          return pan;
        },
        onFinalize: (callback: (...args: any[]) => void) => {
          native.callbacks.finalize = callback;
          return pan;
        },
      };
      return pan;
    },
  },
}));
let renderer: ReactTestRenderer;
let props: ComponentProps<typeof ExerciseReorderCard>;
beforeEach(async () => {
  vi.clearAllMocks();
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
  vi.unstubAllGlobals();
});
const event = (translationY: number) => ({ translationY, absoluteY: 100 + translationY });
it('keeps the original native gesture through collapse and moves without another touch', async () => {
  expect(native.delay).toHaveBeenCalledWith(450);
  expect(native.outside).toHaveBeenCalledWith(false);
  const heldGesture = { ...native.callbacks };
  await act(() => heldGesture.start(event(0)));
  expect(props.onEnter).toHaveBeenCalledOnce();
  await act(() =>
    renderer.update(createElement(ExerciseReorderCard, { ...props, reordering: true })),
  );
  // Same recognizer callbacks, with no new start, release, or touch-down.
  await act(() => heldGesture.update(event(30)));
  expect(props.onStart).toHaveBeenCalledExactlyOnceWith(100);
  expect(props.onMove).toHaveBeenCalledWith(30, 130);
  await act(() => heldGesture.update(event(70)));
  expect(props.onMove).toHaveBeenLastCalledWith(70, 170);
  await act(() => heldGesture.end(event(70), true));
  await act(() => heldGesture.finalize());
  expect(props.onEnd).toHaveBeenCalledOnce();
  expect(props.onCancel).not.toHaveBeenCalled();
});
it('cancels interruption and leaves unactivated taps and scroll gestures alone', async () => {
  await act(() => native.callbacks.finalize());
  expect(props.onEnter).not.toHaveBeenCalled();
  expect(props.onStart).not.toHaveBeenCalled();
  await act(() =>
    renderer.update(createElement(ExerciseReorderCard, { ...props, reordering: true })),
  );
  expect(native.delay).toHaveBeenLastCalledWith(0);
  await act(() => native.callbacks.start(event(0)));
  await act(() => native.callbacks.update(event(20)));
  await act(() => native.callbacks.finalize());
  expect(props.onCancel).toHaveBeenCalledOnce();
  expect(props.onEnd).not.toHaveBeenCalled();
});
