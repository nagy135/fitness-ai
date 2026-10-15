import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useAppTheme } from './theme-provider';

// Quick Pulse (#59): matching nonzero end speeds keep each revolution moving.
const cycleMs = 1200;
const easing = Easing.bezier(0.4, 0.3, 0.6, 0.7);
const styles = StyleSheet.create({ frame: { width: 32, height: 32 } });

export function DumbbellProgress() {
  const { colors } = useAppTheme();
  const [reduceMotion, setReduceMotion] = useState(true);
  const [cycle] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const animation = Animated.loop(
      Animated.timing(cycle, {
        toValue: 1,
        duration: cycleMs,
        easing,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    animation.start();
    return () => {
      animation.stop();
      cycle.setValue(0);
    };
  }, [cycle, reduceMotion]);

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.frame}
    >
      <Animated.View
        style={[
          styles.frame,
          {
            transform: [
              {
                rotate: reduceMotion
                  ? '-35deg'
                  : cycle.interpolate({ inputRange: [0, 1], outputRange: ['-35deg', '325deg'] }),
              },
            ],
          },
        ]}
      >
        <Svg width={32} height={32} viewBox="0 0 32 32" fill={colors.accentInk}>
          <Rect x={3} y={11} width={3} height={10} rx={1} />
          <Rect x={6} y={8} width={4} height={16} rx={1.5} />
          <Rect x={10} y={14.5} width={12} height={3} rx={1} />
          <Rect x={22} y={8} width={4} height={16} rx={1.5} />
          <Rect x={26} y={11} width={3} height={10} rx={1} />
        </Svg>
      </Animated.View>
    </View>
  );
}
