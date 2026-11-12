import { useEffect, useMemo, useRef, type PropsWithChildren } from 'react';
import { View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

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
  const active = useRef(false);
  const pending = useRef(false);
  const startTranslation = useRef(0);
  // The native recognizer owns the touch before collapsing unmounts any set controls.
  // Its callbacks read current props after the collapsed layout has rendered.
  /* eslint-disable react-hooks/refs -- Gesture only registers these deferred native event callbacks. */
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!props.disabled)
        .activateAfterLongPress(props.reordering ? 0 : 450)
        .shouldCancelWhenOutside(false)
        .runOnJS(true)
        .onStart((event) => {
          active.current = false;
          pending.current = true;
          startTranslation.current = event.translationY;
          if (!latest.current.reordering) latest.current.onEnter();
        })
        .onUpdate((event) => {
          if (!latest.current.reordering || latest.current.disabled) return;
          const dy = event.translationY - startTranslation.current;
          if (pending.current) {
            latest.current.onStart(event.absoluteY - dy);
            pending.current = false;
            active.current = true;
          }
          if (active.current) latest.current.onMove(dy, event.absoluteY);
        })
        .onEnd((_event, success) => {
          if (active.current && success) latest.current.onEnd();
          else if (active.current) latest.current.onCancel();
          active.current = false;
          pending.current = false;
        })
        .onFinalize(() => {
          if (active.current) latest.current.onCancel();
          active.current = false;
          pending.current = false;
        }),
    [props.disabled, props.reordering],
  );
  /* eslint-enable react-hooks/refs */
  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        style={props.style}
        onLayout={props.onLayout}
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
    </GestureDetector>
  );
}
