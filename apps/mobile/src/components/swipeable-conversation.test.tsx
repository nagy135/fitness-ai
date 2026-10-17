import { createElement, useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SwipeableConversation } from './swipeable-conversation';

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  close: vi.fn(),
  dismiss: vi.fn(),
  remove: vi.fn(),
  back: vi.fn(),
}));
vi.mock('react-native', () => ({
  Keyboard: { dismiss: mocks.dismiss },
  BackHandler: { addEventListener: mocks.back },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));
vi.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: 'Root' }));
vi.mock('react-native-gesture-handler/ReanimatedDrawerLayout', async () => {
  const { createElement, useImperativeHandle } = await import('react');
  return {
    DrawerPosition: { RIGHT: 'right' },
    DrawerType: { SLIDE: 'slide' },
    DrawerLockMode: { UNLOCKED: 'unlocked', LOCKED_CLOSED: 'locked' },
    DrawerKeyboardDismissMode: { ON_DRAG: 'on-drag' },
    DrawerState: { DRAGGING: 'dragging', IDLE: 'idle' },
    default: function MockDrawer({ ref, ...props }: { ref: React.Ref<unknown> }) {
      useImperativeHandle(ref, () => ({ openDrawer: mocks.open, closeDrawer: mocks.close }), []);
      return createElement('DrawerLayout', props);
    },
  };
});
vi.mock('./theme-provider', () => ({ useAppTheme: () => ({ colors: { canvas: '#111' } }) }));

let renderer: ReactTestRenderer;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  mocks.back.mockReturnValue({ remove: mocks.remove });
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});

it('opens the full right-hand page from the button and consumes Android back to close it', async () => {
  const change = vi.fn();
  const props = { open: false, onOpenChange: change, panel: null };
  await act(() => {
    renderer = create(createElement(SwipeableConversation, props));
  });
  expect(renderer.root.findByType('DrawerLayout' as never).props).toMatchObject({
    drawerPosition: 'right',
    drawerType: 'slide',
    drawerWidth: 390,
    edgeWidth: 390,
    minSwipeDistance: 24,
    keyboardDismissMode: 'on-drag',
  });
  await act(() => renderer.update(createElement(SwipeableConversation, { ...props, open: true })));
  expect(mocks.open).toHaveBeenCalledOnce();
  expect(mocks.dismiss).toHaveBeenCalledOnce();
  expect(mocks.back.mock.lastCall?.[0]).toBe('hardwareBackPress');
  expect(mocks.back.mock.lastCall?.[1]()).toBe(true);
  expect(change).toHaveBeenLastCalledWith(false);
  await act(() => renderer.update(createElement(SwipeableConversation, props)));
  expect(mocks.close).toHaveBeenCalledTimes(2);
  expect(mocks.remove).toHaveBeenCalledOnce();
});

it('loads the panel during a swipe without interrupting the gesture and restores state after cancellation', async () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return createElement(SwipeableConversation, { open, onOpenChange: setOpen, panel: null });
  }
  await act(() => {
    renderer = create(createElement(Harness));
  });
  const drawer = () => renderer.root.findByType('DrawerLayout' as never);
  await act(() => drawer().props.onDrawerStateChanged('dragging', true));
  expect(mocks.back).toHaveBeenCalledOnce();
  expect(mocks.open).not.toHaveBeenCalled();
  await act(() => {
    drawer().props.onDrawerStateChanged('idle', false);
    drawer().props.onDrawerClose();
  });
  expect(mocks.remove).toHaveBeenCalledOnce();
});
