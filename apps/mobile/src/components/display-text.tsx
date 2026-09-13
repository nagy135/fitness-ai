import { Text, type TextProps } from 'react-native';
import { isLoaded } from 'expo-font';
import { cn } from '@fitness/ui';

export function DisplayText({ className, style, ...props }: TextProps & { className?: string }) {
  const loaded = isLoaded('BarlowCondensed');
  return (
    <Text
      className={cn('text-ink dark:text-ink-dark', className)}
      style={[
        { fontFamily: loaded ? 'BarlowCondensed' : undefined, fontWeight: loaded ? '400' : '700' },
        style,
      ]}
      {...props}
    />
  );
}
