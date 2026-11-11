import { useEffect, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { GripVertical } from 'lucide-react-native';
import { useAppTheme } from '@/components/theme-provider';

export function ExerciseDragHandle(props: {
  name: string;
  disabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onStart: (pageY: number) => void;
  onMove: (dy: number, pageY: number) => void;
  onEnd: () => void;
  onCancel: () => void;
  onStep: (delta: number) => void;
}) {
  const { colors } = useAppTheme();
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = useRef(false);
  const clear = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };
  useEffect(
    () => () => {
      clear();
    },
    [],
  );
  // PanResponder stores these callbacks; it does not invoke them during creation.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.disabled,
      onPanResponderGrant: (event) => {
        const pageY = event.nativeEvent.pageY;
        clear();
        timer.current = setTimeout(() => {
          if (latest.current.disabled) return;
          active.current = true;
          latest.current.onStart(pageY);
        }, 350);
      },
      onPanResponderMove: (_event, gesture) => {
        if (active.current) latest.current.onMove(gesture.dy, gesture.moveY);
        else if (Math.abs(gesture.dy) > 10 || Math.abs(gesture.dx) > 10) clear();
      },
      onPanResponderRelease: () => {
        clear();
        if (active.current) latest.current.onEnd();
        active.current = false;
      },
      onPanResponderTerminationRequest: () => !active.current,
      onPanResponderTerminate: () => {
        clear();
        if (active.current) latest.current.onCancel();
        active.current = false;
      },
    }),
  );
  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Reorder ${props.name}`}
      accessibilityHint="Hold and drag to move this exercise"
      accessibilityState={{ disabled: props.disabled }}
      accessibilityActions={
        props.disabled
          ? []
          : [
              ...(props.canMoveUp ? [{ name: 'increment', label: 'Move up' }] : []),
              ...(props.canMoveDown ? [{ name: 'decrement', label: 'Move down' }] : []),
            ]
      }
      onAccessibilityAction={({ nativeEvent }) => {
        if (props.disabled) return;
        if (nativeEvent.actionName === 'increment' && props.canMoveUp) props.onStep(-1);
        if (nativeEvent.actionName === 'decrement' && props.canMoveDown) props.onStep(1);
      }}
      className={`h-11 w-11 items-center justify-center rounded-lg ${props.disabled ? 'opacity-40' : ''}`}
    >
      <GripVertical size={20} color={colors.muted} />
    </View>
  );
}
