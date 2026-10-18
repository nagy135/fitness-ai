import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatPages } from './chat-pages';

const mocks = vi.hoisted(() => ({
  timing: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  dismiss: vi.fn(),
  remove: vi.fn(),
  back: vi.fn(),
  reduced: vi.fn(async () => false),
  focused: true,
}));
vi.mock('react-native', () => ({
  View: 'View',
  Animated: {
    View: 'AnimatedView',
    Value: class {
      interpolate(config: unknown) {
        return config;
      }
    },
    timing: mocks.timing,
  },
  AccessibilityInfo: { isReduceMotionEnabled: mocks.reduced },
  Keyboard: { dismiss: mocks.dismiss },
  BackHandler: { addEventListener: mocks.back },
}));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: function useMockFocusEffect(effect: () => void | (() => void)) {
      const focused = mocks.focused;
      useEffect(() => (focused ? effect() : undefined), [effect, focused]);
    },
  };
});

let renderer: ReactTestRenderer;
const change = vi.fn();
const props = {
  panel: createElement('Chat'),
  children: createElement('Workout'),
  open: false,
  onOpenChange: change,
};
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  mocks.focused = true;
  mocks.reduced.mockResolvedValue(false);
  mocks.timing.mockReturnValue({ start: mocks.start, stop: mocks.stop });
  mocks.back.mockReturnValue({ remove: mocks.remove });
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});

it('slides to chat on request, preserves both pages, and consumes Android Back to return', async () => {
  await act(() => {
    renderer = create(createElement(ChatPages, props));
  });
  const workout = renderer.root.findByType('Workout' as never);
  const chat = renderer.root.findByType('Chat' as never);
  expect(chat.parent?.props.pointerEvents).toBe('none');
  await act(() => renderer.update(createElement(ChatPages, { ...props, open: true })));
  expect(renderer.root.findByType('Workout' as never)).toBe(workout);
  expect(renderer.root.findByType('Chat' as never)).toBe(chat);
  expect(workout.parent?.props.accessibilityElementsHidden).toBe(true);
  expect(chat.parent?.props.pointerEvents).toBe('auto');
  expect(mocks.timing.mock.lastCall?.[1]).toMatchObject({ toValue: 1, useNativeDriver: true });
  expect(mocks.dismiss).toHaveBeenCalledOnce();
  expect(mocks.back.mock.lastCall?.[1]()).toBe(true);
  expect(change).toHaveBeenLastCalledWith(false);
  await act(() => renderer.update(createElement(ChatPages, props)));
  expect(mocks.timing.mock.lastCall?.[1].toValue).toBe(0);
  expect(workout.parent?.props.pointerEvents).toBe('auto');
  expect(chat.parent?.props.accessibilityElementsHidden).toBe(true);
  expect(mocks.remove).toHaveBeenCalledOnce();
});

it('keeps the slide clipped and adapts both mounted pages when the content width changes', async () => {
  await act(() => {
    renderer = create(createElement(ChatPages, { ...props, open: true }));
  });
  const root = renderer.root.findAllByType('View' as never)[0];
  for (const width of [390, 288]) {
    await act(() => root.props.onLayout({ nativeEvent: { layout: { width } } }));
    expect(renderer.root.findByType('Workout' as never).parent?.props.style.width).toBe(width);
    expect(renderer.root.findByType('Chat' as never).parent?.props.style.width).toBe(width);
    expect(renderer.root.findByType('AnimatedView' as never).props.style.transform[0]).toEqual({
      translateX: { inputRange: [0, 1], outputRange: [0, -width] },
    });
  }
  expect(root.props.style.overflow).toBe('hidden');
});

it('respects reduced motion and releases Android Back while another route is focused', async () => {
  mocks.reduced.mockResolvedValue(true);
  await act(() => {
    renderer = create(createElement(ChatPages, { ...props, open: true }));
  });
  expect(mocks.timing.mock.lastCall?.[1].duration).toBe(0);
  mocks.focused = false;
  await act(() => renderer.update(createElement(ChatPages, { ...props, open: true })));
  expect(mocks.remove).toHaveBeenCalledOnce();
  mocks.focused = true;
  await act(() => renderer.update(createElement(ChatPages, { ...props, open: true })));
  expect(mocks.back).toHaveBeenCalledTimes(2);
});
