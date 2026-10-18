import { useCallback, useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, BackHandler, Keyboard, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

/** Keeps both pages mounted and slides between them only when a button is pressed. */
export function ChatPages({
  children,
  panel,
  open,
  onOpenChange,
}: PropsWithChildren<{
  panel: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const [width, setWidth] = useState(0);
  const [progress] = useState(() => new Animated.Value(open ? 1 : 0));

  useEffect(() => {
    let cancelled = false;
    let animation: Animated.CompositeAnimation | undefined;
    if (open) Keyboard.dismiss();
    function animate(reduceMotion: boolean) {
      if (cancelled) return;
      animation = Animated.timing(progress, {
        toValue: open ? 1 : 0,
        duration: reduceMotion ? 0 : 240,
        useNativeDriver: true,
        isInteraction: false,
      });
      animation.start();
    }
    void AccessibilityInfo.isReduceMotionEnabled().then(animate, () => animate(false));
    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [open, progress]);

  useFocusEffect(
    useCallback(() => {
      if (!open) return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        onOpenChange(false);
        return true;
      });
      return () => subscription.remove();
    }, [onOpenChange, open]),
  );

  return (
    <View
      style={{ flex: 1, overflow: 'hidden' }}
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
    >
      <Animated.View
        style={{
          flex: 1,
          flexDirection: 'row',
          width: width * 2,
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -width] }) },
          ],
        }}
      >
        <View
          style={{ width, flexShrink: 0 }}
          pointerEvents={open ? 'none' : 'auto'}
          accessibilityElementsHidden={open}
          importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </View>
        <View
          style={{ width, flexShrink: 0 }}
          pointerEvents={open ? 'auto' : 'none'}
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        >
          {panel}
        </View>
      </Animated.View>
    </View>
  );
}
