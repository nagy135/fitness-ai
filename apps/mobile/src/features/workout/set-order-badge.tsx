import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Text } from 'react-native';

export function SetOrderBadge({ version, number }: { version: number; number: number }) {
  const [pulse] = useState(() => new Animated.Value(0));
  const [completedVersion, setCompletedVersion] = useState(0);
  useEffect(() => {
    if (!version) return;
    let cancelled = false;
    let animation: Animated.CompositeAnimation | undefined;
    pulse.setValue(0);
    const timeout = setTimeout(() => {
      animation?.stop();
      pulse.setValue(0);
      setCompletedVersion(version);
    }, 5000);
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      if (reduceMotion) return;
      animation = Animated.sequence(
        Array.from({ length: 5 }, () => [
          Animated.timing(pulse, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
            isInteraction: false,
          }),
        ]).flat(),
      );
      animation.start(({ finished }) => {
        if (finished && !cancelled) setCompletedVersion(version);
      });
    });
    return () => {
      cancelled = true;
      animation?.stop();
      clearTimeout(timeout);
    };
  }, [version, pulse]);
  const active = !!version && completedVersion !== version;
  return (
    <Animated.View
      accessibilityLabel={active ? 'New or updated set' : undefined}
      className="h-8 w-8 items-center justify-center rounded-full bg-soft dark:bg-soft-dark"
      style={{
        borderWidth: 2,
        borderColor: active ? '#facc15' : 'transparent',
        opacity: active ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }) : 1,
        transform: [
          { scale: active ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) : 1 },
        ],
      }}
    >
      <Text className="text-sm font-semibold text-muted dark:text-muted-dark">{number}</Text>
    </Animated.View>
  );
}
