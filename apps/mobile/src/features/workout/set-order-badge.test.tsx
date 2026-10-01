import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SetOrderBadge } from './set-order-badge';
const mocks = vi.hoisted(() => ({
  timing: vi.fn(),
  start: vi.fn(),
  reduced: vi.fn(async () => false),
}));
vi.mock('react-native', () => ({
  Text: 'Text',
  AccessibilityInfo: { isReduceMotionEnabled: mocks.reduced },
  Animated: {
    View: 'AnimatedView',
    Value: class {
      setValue() {}
      interpolate() {
        return 1;
      }
    },
    timing: mocks.timing,
    sequence: () => ({ start: mocks.start, stop: vi.fn() }),
  },
}));
let renderer: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mocks.reduced.mockResolvedValue(false);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterEach(async () => {
  await act(() => renderer.unmount());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const badge = () => renderer.root.findByType('AnimatedView' as never);
it('pulses the numbered badge for five seconds then restores it without replaying', async () => {
  await act(() => {
    renderer = create(createElement(SetOrderBadge, { version: 1, number: 2 }));
  });
  expect(badge().props.style.borderColor).toBe('#facc15');
  expect(renderer.root.findByType('Text' as never).props.children).toBe(2);
  expect(mocks.timing.mock.calls.map((call) => call[1].toValue)).toEqual([
    1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
  ]);
  expect(mocks.timing.mock.calls.reduce((sum, call) => sum + call[1].duration, 0)).toBe(5000);
  await act(() => {
    vi.advanceTimersByTime(4999);
  });
  expect(badge().props.style.borderColor).toBe('#facc15');
  await act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(badge().props.style.borderColor).toBe('transparent');
  expect(badge().props.style.transform).toEqual([{ scale: 1 }]);
  expect(renderer.root.findByType('Text' as never).props.children).toBe(2);
  await act(() => renderer.update(createElement(SetOrderBadge, { version: 1, number: 2 })));
  expect(mocks.start).toHaveBeenCalledTimes(1);
  await act(() => renderer.update(createElement(SetOrderBadge, { version: 2, number: 2 })));
  expect(badge().props.style.borderColor).toBe('#facc15');
  expect(mocks.start).toHaveBeenCalledTimes(2);
});
it('shows a static yellow border for five seconds with reduced motion', async () => {
  mocks.reduced.mockResolvedValue(true);
  await act(() => {
    renderer = create(createElement(SetOrderBadge, { version: 1, number: 1 }));
  });
  expect(badge().props.style.borderColor).toBe('#facc15');
  expect(mocks.start).not.toHaveBeenCalled();
  await act(() => {
    vi.advanceTimersByTime(5000);
  });
  expect(badge().props.style.borderColor).toBe('transparent');
});
