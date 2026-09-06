import { Text, View } from 'react-native';
export function ErrorNotice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="mx-5 my-2 rounded-xl border border-danger p-3 dark:border-danger-dark"
    >
      <Text className="text-sm leading-5 text-danger dark:text-danger-dark">{message}</Text>
    </View>
  );
}
