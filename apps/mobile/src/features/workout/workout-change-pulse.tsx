import { useEffect, useRef, useState, type RefObject, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  type LayoutChangeEvent,
  ScrollView,
  View,
} from 'react-native';

export function WorkoutChangePulse({
  children,
  pulseVersion,
  reveal = false,
  contentRef,
  scrollRef,
  onLayout,
  className,
}: {
  children: ReactNode;
  className: string;
  pulseVersion: number;
  reveal?: boolean;
  contentRef?: RefObject<View | null>;
  scrollRef?: RefObject<ScrollView | null>;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const cardRef = useRef<View>(null);
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!pulseVersion) return;
    let cancelled = false;
    let animation: Animated.CompositeAnimation | undefined;
    // Measure after expansion, even when editing values leaves the card's
    // dimensions unchanged (and therefore does not trigger onLayout).
    const frame = requestAnimationFrame(() => {
      if (reveal && contentRef?.current) {
        cardRef.current?.measureLayout(
          contentRef.current,
          (_x, y) => {
            if (!cancelled)
              scrollRef?.current?.scrollTo({ y: Math.max(0, y - 16), animated: false });
          },
          () => undefined,
        );
      }
      void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
        if (cancelled || reduceMotion) return;
        animation = Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.025,
            duration: 160,
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 240,
            useNativeDriver: true,
            isInteraction: false,
          }),
        ]);
        animation.start();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      animation?.stop();
      scale.setValue(1);
    };
  }, [pulseVersion, reveal, contentRef, scrollRef, scale]);
  return (
    <Animated.View
      ref={cardRef}
      collapsable={false}
      onLayout={onLayout}
      style={{ transform: [{ scale }] }}
      className={className}
    >
      {children}
    </Animated.View>
  );
}
