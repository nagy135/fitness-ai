import { Pressable, type PressableProps } from 'react-native';
import { cn } from './cn';

export function IconButton({
  className,
  disabled,
  ...props
}: PressableProps & { accessibilityLabel: string; className?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      className={cn(
        'h-11 w-11 items-center justify-center rounded-xl active:bg-soft dark:active:bg-soft-dark',
        disabled && 'opacity-40',
        className,
      )}
      {...props}
    />
  );
}
