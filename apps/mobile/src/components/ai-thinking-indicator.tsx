import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';

const cycleMs = 1400;

export function AiThinkingIndicator({ color, size = 22 }: { color: string; size?: number }) {
  const [progress] = useState(() => new Animated.Value(0));
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: cycleMs,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      progress.setValue(0);
    };
  }, [progress, reduceMotion]);

  const halo = size * 1.6;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ width: halo, height: halo, alignItems: 'center', justifyContent: 'center' }}
    >
      {reduceMotion ? null : (
        <Animated.View
          style={{
            position: 'absolute',
            width: halo,
            height: halo,
            borderRadius: halo / 2,
            borderWidth: 1.5,
            borderColor: color,
            opacity: progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.5, 0] }),
            transform: [
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
            ],
          }}
        />
      )}
      <Animated.View
        style={
          reduceMotion
            ? undefined
            : {
                opacity: progress.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.75, 1, 0.75],
                }),
                transform: [
                  {
                    scale: progress.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.88, 1.08, 0.88],
                    }),
                  },
                  {
                    rotate: progress.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: ['-8deg', '8deg', '-8deg'],
                    }),
                  },
                ],
              }
        }
      >
        <Sparkles color={color} size={size} />
      </Animated.View>
    </View>
  );
}

function useReducedMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);
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
  return reduceMotion;
}
