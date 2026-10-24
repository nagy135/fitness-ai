import { Pressable, Text, View } from 'react-native';
import { formatNumber } from './history-format';

/** The middle segments choose a step; only the two end buttons change the set. */
export function MeasurementStepper({
  label,
  unit,
  value,
  steps,
  step,
  busy,
  context,
  onStepChange,
  onAdjust,
}: {
  label: string;
  unit: string;
  value: number;
  steps: readonly number[];
  step: number;
  busy: boolean;
  context: string;
  onStepChange: (step: number) => void;
  onAdjust: (delta: number) => void;
}) {
  function adjustButton(direction: -1 | 1) {
    const delta = direction * step;
    const disabled = busy || value + delta <= 0;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${direction < 0 ? 'Decrease' : 'Increase'} ${context} by ${step} ${unit}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onAdjust(delta)}
        className={`h-11 w-11 items-center justify-center active:bg-soft dark:active:bg-soft-dark ${direction < 0 ? 'border-r' : 'border-l'} border-line dark:border-line-dark ${disabled ? 'opacity-35' : ''}`}
      >
        <Text className="text-xl font-medium text-ink dark:text-ink-dark">
          {direction < 0 ? '−' : '+'}
        </Text>
      </Pressable>
    );
  }
  return (
    <View className="flex-row items-center gap-2">
      <View className="w-16">
        <Text className="text-xs text-muted dark:text-muted-dark">{label}</Text>
        <Text
          className="text-sm font-semibold text-ink dark:text-ink-dark"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {formatNumber(value)} {unit}
        </Text>
      </View>
      <View className="flex-1 flex-row items-center overflow-hidden rounded-lg border border-line bg-canvas dark:border-line-dark dark:bg-canvas-dark">
        {adjustButton(-1)}
        {steps.length > 1 ? (
          <View className="flex-1 flex-row px-1">
            {steps.map((increment) => (
              <Pressable
                key={increment}
                accessibilityRole="button"
                accessibilityLabel={`Adjust ${context} in steps of ${increment} ${unit}`}
                accessibilityState={{ selected: increment === step, disabled: busy }}
                disabled={busy}
                onPress={() => onStepChange(increment)}
                className={`h-11 flex-1 items-center justify-center ${busy ? 'opacity-35' : ''}`}
              >
                <View
                  className={`self-stretch items-center rounded-md py-1.5 ${increment === step ? 'bg-soft dark:bg-soft-dark' : ''}`}
                >
                  <Text
                    className={`text-xs ${increment === step ? 'font-bold text-accent dark:text-accent-dark' : 'text-muted dark:text-muted-dark'}`}
                  >
                    {increment}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text className="flex-1 text-center text-xs text-muted dark:text-muted-dark">
            {step} {unit === 'reps' ? 'rep' : unit}
          </Text>
        )}
        {adjustButton(1)}
      </View>
    </View>
  );
}
