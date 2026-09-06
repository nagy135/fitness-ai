import { Pressable, Text, View } from 'react-native';
import { cn } from './cn';

export type FitnessMode = 'workout' | 'analysis';

export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: FitnessMode;
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
            accessibilityState={{ selected }}
            className={cn(
              'flex-1 items-center rounded-xl py-3',
              selected && 'bg-accent dark:bg-accent-dark',
            )}
            onPress={() => onChange(option)}
          >
            <Text
              className={cn(
                'text-xs font-black tracking-[2px]',
                selected ? 'text-accent-ink' : 'text-muted dark:text-muted-dark',
              )}
            >
              {option.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
