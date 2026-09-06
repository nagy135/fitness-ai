import { ActivityIndicator, Text, View } from 'react-native';
import { useAppTheme } from './theme-provider';

export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  const { colors } = useAppTheme();
  return (
    <View className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
      <ActivityIndicator color={colors.accent} />
      <Text className="mt-3 text-sm text-muted dark:text-muted-dark">{label}</Text>
    </View>
  );
}
