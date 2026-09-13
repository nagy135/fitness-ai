import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { cn } from './cn';
import { useThemeColors } from './theme-context';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  const colors = useThemeColors();
  return (
    <View className="gap-2">
      {label ? (
        <Text className="text-sm font-semibold text-ink dark:text-ink-dark">{label}</Text>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        className={cn(
          'min-h-12 py-3 rounded-xl border border-line bg-panel px-4 text-base text-ink dark:border-line-dark dark:bg-panel-dark dark:text-ink-dark',
          error && 'border-danger',
          className,
        )}
        placeholderTextColor={colors.muted}
        {...props}
      />
      {error ? <Text className="text-xs text-danger">{error}</Text> : null}
    </View>
  );
}
