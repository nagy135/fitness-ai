import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { useColorScheme } from 'nativewind';
import { cn } from './cn';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  const { colorScheme } = useColorScheme();
  return (
    <View className="gap-2">
      {label ? (
        <Text className="text-sm font-semibold text-ink dark:text-ink-dark">{label}</Text>
      ) : null}
      <TextInput
        className={cn(
          'h-12 rounded-2xl border border-line bg-panel px-4 text-base text-ink dark:border-line-dark dark:bg-panel-dark dark:text-ink-dark',
          error && 'border-danger',
          className,
        )}
        placeholderTextColor={colorScheme === 'dark' ? '#84908A' : '#69746D'}
        {...props}
      />
      {error ? <Text className="text-xs text-danger">{error}</Text> : null}
    </View>
  );
}
