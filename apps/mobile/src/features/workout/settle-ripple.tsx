import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Check } from 'lucide-react-native';
import { useAppTheme } from '@/components/theme-provider';

export function SettleRipple({
  settled,
  name,
  children,
}: {
  settled: boolean;
  name: string;
  children: (feedback: {
    buttonRef: RefObject<View | null>;
    buttonScale: Animated.AnimatedInterpolation<number>;
  }) => ReactNode;
}) {
  const { colors, isDark } = useAppTheme();
  const green = isDark ? '#4ade80' : '#15803d';
  const cardRef = useRef<View>(null);
  const buttonRef = useRef<View>(null);
  const size = useRef({ width: 0, height: 0 });
  const reduceMotion = useRef(true);
  const motionEpoch = useRef(0);
  const [progress] = useState(() => new Animated.Value(1));
  const [wave, setWave] = useState({ x: 0, y: 0, radius: 1 });
  useEffect(() => {
    let mounted = true;
    let preferenceChanged = false;
    const update = (reduced: boolean) => {
      reduceMotion.current = reduced;
      if (reduced) {
        motionEpoch.current += 1;
        progress.stopAnimation();
        progress.setValue(1);
      }
    };
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduced) => {
      preferenceChanged = true;
      update(reduced);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (mounted && !preferenceChanged) update(reduced);
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [progress]);
  useEffect(() => {
    let cancelled = false;
    const epoch = motionEpoch.current;
    progress.stopAnimation();
    progress.setValue(1);
    if (!settled || reduceMotion.current) return;
    progress.setValue(0);
    const start = (x: number, y: number) => {
      if (cancelled || reduceMotion.current || epoch !== motionEpoch.current) return;
      const { width, height } = size.current;
      const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) / 0.63;
      setWave({ x, y, radius: Math.max(1, radius) });
      Animated.timing(progress, {
        toValue: 1,
        duration: 580,
        easing: Easing.bezier(0.2, 0.55, 0.35, 1),
        useNativeDriver: true,
        isInteraction: false,
      }).start();
    };
    const fallback = () =>
      start(Math.max(0, size.current.width - 65), Math.max(0, size.current.height - 31));
    if (buttonRef.current && cardRef.current) {
      buttonRef.current.measureLayout(
        cardRef.current,
        (x, y, width, height) => start(x + width / 2, y + height / 2),
        fallback,
      );
    } else fallback();
    return () => {
      cancelled = true;
      progress.stopAnimation();
      progress.setValue(1);
    };
  }, [settled, progress]);
  return (
    <View
      ref={cardRef}
      collapsable={false}
      onLayout={({ nativeEvent }) => {
        size.current = nativeEvent.layout;
      }}
    >
      {children({
        buttonRef,
        buttonScale: progress.interpolate({ inputRange: [0, 0.26, 1], outputRange: [0.96, 1, 1] }),
      })}
      {settled ? (
        <>
          <View
            pointerEvents="none"
            accessible={false}
            style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 12 }}
          >
            <Animated.View
              style={{
                position: 'absolute',
                left: wave.x - 64,
                top: wave.y - 64,
                width: 128,
                height: 128,
                opacity: progress.interpolate({
                  inputRange: [0, 0.32, 0.75, 1],
                  outputRange: [0.3, 1, 0.7, 0],
                }),
                transform: [
                  {
                    // Scale a small gradient layer rather than allocating a card-sized texture.
                    scale: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [(0.025 * wave.radius) / 64, (1.04 * wave.radius) / 64],
                    }),
                  },
                ],
              }}
            >
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <Defs>
                  <RadialGradient id="settle-wave" cx="50%" cy="50%" r="50%">
                    <Stop offset="42%" stopColor={green} stopOpacity={0} />
                    <Stop offset="52%" stopColor={green} stopOpacity={0.07} />
                    <Stop offset="63%" stopColor={green} stopOpacity={0.23} />
                    <Stop offset="74%" stopColor={green} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={50} cy={50} r={50} fill="url(#settle-wave)" />
              </Svg>
            </Animated.View>
            <Animated.View
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: green,
                opacity: progress.interpolate({
                  inputRange: [0, 0.27, 0.72, 1],
                  outputRange: [0, 0, 1, 1],
                }),
              }}
            />
          </View>
          <Animated.View
            pointerEvents="none"
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${name} settled`}
            style={{
              position: 'absolute',
              top: -7,
              left: -7,
              width: 19,
              height: 19,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: colors.canvas,
              backgroundColor: green,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: progress.interpolate({
                inputRange: [0, 0.5, 0.65, 1],
                outputRange: [0, 0, 1, 1],
              }),
              transform: [
                {
                  scale: progress.interpolate({
                    inputRange: [0, 0.5, 0.78, 1],
                    outputRange: [0.45, 0.45, 1.12, 1],
                  }),
                },
              ],
            }}
          >
            <Check size={12} strokeWidth={3} color={colors.canvas} />
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}
