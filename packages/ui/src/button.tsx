import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { useThemeColors } from './theme-context';

const buttonVariants = cva('min-h-12 py-3 flex-row items-center justify-center rounded-full px-5', {
  variants: {
    variant: {
      primary: 'bg-accent active:opacity-80 dark:bg-accent-dark',
      secondary:
        'border border-line bg-panel active:opacity-80 dark:border-line-dark dark:bg-panel-dark',
      destructive: 'bg-danger active:opacity-80 dark:bg-danger-dark',
      ghost: 'bg-transparent active:bg-panel dark:active:bg-panel-dark',
    },
  },
  defaultVariants: { variant: 'primary' },
});

export interface ButtonProps
  extends Omit<PressableProps, 'children'>, VariantProps<typeof buttonVariants> {
  children?: ReactNode;
  className?: string;
  textClassName?: string;
  loading?: boolean;
}

export function Button({
  children,
  className,
  textClassName,
  variant,
  loading,
  disabled,
  ...props
}: ButtonProps) {
  const lightText = variant === 'secondary' || variant === 'ghost';
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      className={cn(buttonVariants({ variant }), (disabled || loading) && 'opacity-50', className)}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={
            lightText ? colors.text : variant === 'destructive' ? colors.canvas : colors.accentInk
          }
        />
      ) : typeof children === 'string' ? (
        <Text
          className={cn(
            'text-[15px] font-bold',
            lightText
              ? 'text-ink dark:text-ink-dark'
              : variant === 'destructive'
                ? 'text-white dark:text-canvas-dark'
                : 'text-accent-ink dark:text-accent-ink-dark',
            textClassName,
          )}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
