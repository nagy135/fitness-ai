import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { PanResponder, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';

export function ExerciseReorderCard(
  props: PropsWithChildren<{
    name: string;
    reordering: boolean;
    disabled: boolean;
    canMoveUp: boolean;
    canMoveDown: boolean;
    style: ViewStyle;
    onLayout: (event: LayoutChangeEvent) => void;
    onEnter: () => void;
    onStart: (pageY: number) => void;
    onMove: (dy: number, pageY: number) => void;
    onEnd: () => void;
    onCancel: () => void;
    onStep: (delta: number) => void;
  }>,
) {
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const origin = useRef({ x: 0, y: 0 });
  const active = useRef(false);
  const entering = useRef(false);
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
  // PanResponder registers these callbacks; it never invokes them while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (event) => {
        clear();
        entering.current = false;
        if (latest.current.disabled) return false;
        if (latest.current.reordering) return true;
        origin.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
        timer.current = setTimeout(() => {
          if (latest.current.disabled) return;
          entering.current = true;
          latest.current.onEnter();
        }, 450);
        // Leave ordinary taps, scrolling and set controls with their own responders.
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_event, gesture) => {
        if (Math.abs(gesture.dx) > 10 || Math.abs(gesture.dy) > 10) clear();
        return !entering.current && !latest.current.disabled && latest.current.reordering;
      },
      onPanResponderGrant: (event) => {
        clear();
        active.current = true;
        latest.current.onStart(event.nativeEvent.pageY);
      },
      onPanResponderMove: (_event, gesture) => {
        if (active.current) latest.current.onMove(gesture.dy, gesture.moveY);
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
      collapsable={false}
      style={props.style}
      onLayout={props.onLayout}
      onTouchMove={(event) => {
        if (
          Math.abs(event.nativeEvent.pageX - origin.current.x) > 10 ||
          Math.abs(event.nativeEvent.pageY - origin.current.y) > 10
        )
          clear();
      }}
      onTouchEnd={clear}
      onTouchCancel={clear}
      accessible={props.reordering}
      accessibilityRole={props.reordering ? 'button' : undefined}
      accessibilityLabel={props.reordering ? `Move ${props.name}` : undefined}
      accessibilityHint={
        props.reordering
          ? 'Drag this exercise to change its position, then choose Done or Cancel'
          : undefined
      }
      accessibilityState={props.reordering ? { disabled: props.disabled } : undefined}
      accessibilityActions={
        !props.reordering || props.disabled
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
    >
      {props.children}
    </View>
  );
}
