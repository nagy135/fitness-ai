import { ActivityIndicator, Text, View } from 'react-native';
import { useAppTheme } from './theme-provider';
import { Screen } from './screen';

export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  const { colors } = useAppTheme();
  return (
    <Screen>
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.accent} />
        <Text className="mt-3 text-sm text-muted dark:text-muted-dark">{label}</Text>
      </View>
    </Screen>
  );
}
