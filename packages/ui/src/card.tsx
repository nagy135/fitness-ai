import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from './cn';

export function Card({ children, className, ...props }: PropsWithChildren<ViewProps>) {
  return (
    <View
      className={cn(
        'rounded-3xl border border-line bg-panel p-5 dark:border-line-dark dark:bg-panel-dark',
        className,
      )}
      {...props}
    >
      {children}
    </View>
  );
}
