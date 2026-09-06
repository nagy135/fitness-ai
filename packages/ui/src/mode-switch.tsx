import { Pressable, Text, View } from 'react-native';
import { cn } from './cn';

export type FitnessMode = 'workout' | 'analysis';

export function ModeSwitch({
  mode,
  onChange,
  disabled = false,
}: {
  mode: FitnessMode;
  disabled?: boolean;
  onChange: (mode: FitnessMode) => void;
}) {
  return (
    <View className="flex-row rounded-2xl border border-line bg-panel p-1 dark:border-line-dark dark:bg-panel-dark">
      {(['workout', 'analysis'] as const).map((option) => {
        const selected = option === mode;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            className={cn(
              'flex-1 items-center rounded-xl py-3',
              selected && 'bg-accent dark:bg-accent-dark',
            )}
            onPress={() => onChange(option)}
          >
            <Text
              className={cn(
                'text-sm font-semibold',
                selected
                  ? 'text-accent-ink dark:text-accent-ink-dark'
                  : 'text-muted dark:text-muted-dark',
              )}
            >
              {option === 'workout' ? 'Workout' : 'Analysis'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
