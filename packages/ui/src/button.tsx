import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { useColorScheme } from 'nativewind';
import { cn } from './cn';

const buttonVariants = cva('h-12 flex-row items-center justify-center rounded-2xl px-5', {
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
  const { colorScheme } = useColorScheme();
  const foregroundColor = colorScheme === 'dark' ? '#F5F7F5' : '#172019';
  return (
    <Pressable
      accessibilityRole="button"
      className={cn(buttonVariants({ variant }), (disabled || loading) && 'opacity-50', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={lightText ? foregroundColor : variant === 'destructive' ? '#FFFFFF' : '#0B0D0F'}
        />
      ) : typeof children === 'string' ? (
        <Text
          className={cn(
            'text-[15px] font-bold',
            lightText
              ? 'text-ink dark:text-ink-dark'
              : variant === 'destructive'
                ? 'text-white'
                : 'text-accent-ink',
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
