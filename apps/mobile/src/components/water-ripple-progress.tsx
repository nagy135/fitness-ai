import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import { useAppTheme } from './theme-provider';

/** Small concentric waves on a water surface, inside the Send button. */
export function WaterRippleProgress() {
  const { colors } = useAppTheme();
  const [reduceMotion, setReduceMotion] = useState(true);
  const [waves] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));

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
    const animations = waves.map((wave, index) =>
      Animated.sequence([
        Animated.delay(index * 600),
        Animated.loop(
          Animated.timing(wave, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
            isInteraction: false,
          }),
        ),
      ]),
    );
    animations.forEach((animation) => animation.start());
    return () => {
      animations.forEach((animation) => animation.stop());
      waves.forEach((wave) => wave.setValue(0));
    };
  }, [reduceMotion, waves]);

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
      >
        {waves.map((wave, index) => (
          <Animated.View
            key={index}
            style={{
              position: 'absolute',
              width: 34,
              height: 34,
              borderRadius: 17,
              borderWidth: 1.5,
              borderColor: colors.accentInk,
              opacity: reduceMotion
                ? 0.6 - index * 0.15
                : wave.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.75, 0] }),
              transform: [{
                scale: reduceMotion
                  ? 0.3 + index * 0.3
                  : wave.interpolate({ inputRange: [0, 1], outputRange: [0.12, 1] }),
              }],
            }}
          />
        ))}
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accentInk }} />
      </View>
    </View>
  );
}
