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
    <View className="flex-row gap-7 border-b border-line dark:border-line-dark">
      {(['workout', 'analysis'] as const).map((option) => {
        const selected = option === mode;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            className={cn(
              'min-h-12 flex-1 items-center border-b-[3px] py-3',
              selected ? 'border-accent dark:border-accent-dark' : 'border-transparent',
            )}
            onPress={() => onChange(option)}
          >
            <Text
              className={cn(
                'text-base font-bold',
                selected ? 'text-accent dark:text-accent-dark' : 'text-muted dark:text-muted-dark',
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
