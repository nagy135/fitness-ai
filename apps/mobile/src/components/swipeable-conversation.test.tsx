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
  focused: true,
}));
vi.mock('react-native', () => ({
  Keyboard: { dismiss: mocks.dismiss },
  BackHandler: { addEventListener: mocks.back },
}));
vi.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: 'Root' }));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: function useMockFocusEffect(effect: () => void | (() => void)) {
      const focused = mocks.focused;
      useEffect(() => (focused ? effect() : undefined), [effect, focused]);
    },
  };
});
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
  mocks.focused = true;
  mocks.back.mockReturnValue({ remove: mocks.remove });
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});

async function layout(width = 390) {
  await act(() =>
    renderer.root.findByType('Root' as never).props.onLayout({
      nativeEvent: { layout: { width } },
    }),
  );
}

it('opens the right-hand content page from the button and consumes Android back to close it', async () => {
  const change = vi.fn();
  const props = { open: false, onOpenChange: change, panel: null };
  await act(() => {
    renderer = create(createElement(SwipeableConversation, props));
  });
  await layout();
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
  await layout();
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

it('sizes and clips the swipe to its own content bounds, including a resize while open', async () => {
  await act(() => {
    renderer = create(
      createElement(SwipeableConversation, {
        open: true,
        onOpenChange: vi.fn(),
        panel: null,
      }),
    );
  });
  expect(mocks.open).not.toHaveBeenCalled();
  await layout(320);
  const drawer = () => renderer.root.findByType('DrawerLayout' as never);
  expect(drawer().props.drawerWidth).toBe(320);
  expect(drawer().props.edgeWidth).toBe(320);
  expect(renderer.root.findByType('Root' as never).props.style.overflow).toBe('hidden');
  await layout(288);
  expect(drawer().props.drawerWidth).toBe(288);
  expect(mocks.open).toHaveBeenCalledTimes(2);
});

it('releases Android Back while another screen is open and restores it on return', async () => {
  const props = { open: true, onOpenChange: vi.fn(), panel: null };
  await act(() => {
    renderer = create(createElement(SwipeableConversation, props));
  });
  await layout();
  expect(mocks.back).toHaveBeenCalledOnce();
  mocks.focused = false;
  await act(() => renderer.update(createElement(SwipeableConversation, props)));
  expect(mocks.remove).toHaveBeenCalledOnce();
  expect(mocks.back).toHaveBeenCalledOnce();
  mocks.focused = true;
  await act(() => renderer.update(createElement(SwipeableConversation, props)));
  expect(mocks.back).toHaveBeenCalledTimes(2);
});
