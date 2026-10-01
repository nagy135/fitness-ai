import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import { useAppTheme } from './theme-provider';
import { plateOffset, plateWindow, plates } from './prompt-status';

const collarInset = 30;
const cycleMs = 2600;

function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);
  return reduceMotion;
}

/**
 * The prompt bar's top edge. Idle it is a hairline divider; while the AI works it
 * becomes a barbell whose sleeves are loaded plate by plate, then cleared.
 */
export function BarbellProgress({ active }: { active: boolean }) {
  const { colors } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const [cycle] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!active || reduceMotion) return;
    const animation = Animated.loop(
      Animated.timing(cycle, {
        toValue: 1,
        duration: cycleMs,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    animation.start();
    return () => {
      animation.stop();
      cycle.setValue(0);
    };
  }, [active, cycle, reduceMotion]);

  const animate = active && !reduceMotion;
  const setOpacity = cycle.interpolate({
    inputRange: [0, 0.78, 0.92, 1],
    outputRange: [1, 1, 0, 0],
  });

  const sleeve = (side: 'left' | 'right') =>
    plates.map((plate, index) => {
      const edge = collarInset - plateOffset(index) - plate.width;
      const travel = edge + plate.width + 2;
      const [start, end] = plateWindow(index);
      const slide = cycle.interpolate({
        inputRange: [start, end],
        outputRange: [side === 'left' ? -travel : travel, 0],
        easing: Easing.out(Easing.cubic),
        extrapolate: 'clamp',
      });
      const appear = cycle.interpolate({
        inputRange: [start, start + 0.04],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      });
      return (
        <Animated.View
          key={`${side}-${index}`}
          className="absolute rounded-[1.5px]"
          style={{
            [side]: edge,
            top: (16 - plate.height) / 2,
            width: plate.width,
            height: plate.height,
            backgroundColor: colors.highlight,
            opacity: animate ? appear : 1,
            transform: [{ translateX: animate ? slide : 0 }],
          }}
        />
      );
    });

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      className="absolute -top-2 left-0 right-0 h-4 overflow-hidden"
    >
      {active ? (
        <>
          <View
            className="absolute left-0 right-0 top-[7px] h-0.5"
            style={{ backgroundColor: colors.muted }}
          />
          {(['left', 'right'] as const).map((side) => (
            <View
              key={side}
              className="absolute top-[3px] h-2.5 w-0.5 rounded-full"
              style={{ [side]: collarInset, backgroundColor: colors.text }}
            />
          ))}
          <Animated.View className="absolute inset-0" style={{ opacity: animate ? setOpacity : 1 }}>
            {sleeve('left')}
            {sleeve('right')}
          </Animated.View>
        </>
      ) : (
        <View className="absolute left-0 right-0 top-2 h-px bg-line dark:bg-line-dark" />
      )}
    </View>
  );
}
