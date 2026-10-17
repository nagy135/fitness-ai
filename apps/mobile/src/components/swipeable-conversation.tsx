import { useEffect, useRef, type PropsWithChildren, type ReactNode } from 'react';
import { BackHandler, Keyboard, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedDrawerLayout, {
  DrawerKeyboardDismissMode,
  DrawerLockMode,
  DrawerPosition,
  DrawerState,
  DrawerType,
  type DrawerLayoutMethods,
} from 'react-native-gesture-handler/ReanimatedDrawerLayout';
import { useAppTheme } from './theme-provider';

/** A second, full-width page attached to the right of either chat mode. */
export function SwipeableConversation({
  children,
  panel,
  open,
  enabled = true,
  onOpenChange,
}: PropsWithChildren<{
  panel: ReactNode;
  open: boolean;
  enabled?: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const drawer = useRef<DrawerLayoutMethods>(null);
  const dragging = useRef(false);
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();

  useEffect(() => {
    if (dragging.current) return;
    if (open) {
      Keyboard.dismiss();
      drawer.current?.openDrawer();
    } else {
      drawer.current?.closeDrawer();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onOpenChange(false);
      return true;
    });
    return () => subscription.remove();
  }, [onOpenChange, open]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ReanimatedDrawerLayout
        ref={drawer}
        drawerPosition={DrawerPosition.RIGHT}
        drawerType={DrawerType.SLIDE}
        drawerWidth={width}
        edgeWidth={width}
        minSwipeDistance={24}
        drawerLockMode={enabled ? DrawerLockMode.UNLOCKED : DrawerLockMode.LOCKED_CLOSED}
        drawerBackgroundColor={colors.canvas}
        overlayColor="transparent"
        keyboardDismissMode={DrawerKeyboardDismissMode.ON_DRAG}
        renderNavigationView={() => panel}
        onDrawerStateChanged={(state, willOpen) => {
          if (state === DrawerState.DRAGGING) {
            dragging.current = true;
            if (willOpen) onOpenChange(true);
          } else if (state === DrawerState.IDLE) {
            dragging.current = false;
          }
        }}
        onDrawerOpen={() => onOpenChange(true)}
        onDrawerClose={() => onOpenChange(false)}
      >
        {children}
      </ReanimatedDrawerLayout>
    </GestureHandlerRootView>
  );
}
