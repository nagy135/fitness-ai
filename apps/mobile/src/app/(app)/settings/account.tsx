import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@fitness/ui';
import { authClient } from '@/auth/client';

export default function AccountScreen() {
  async function logOut() {
    await authClient.signOut();
    router.replace('/login');
  }
  return (
    <View className="flex-1 justify-center bg-canvas px-6 dark:bg-canvas-dark">
      <Text className="text-4xl font-black text-ink dark:text-ink-dark">Account</Text>
      <Text className="mb-8 mt-3 text-base text-muted dark:text-muted-dark">
        Your session is stored in the platform secure store.
      </Text>
      <Button variant="destructive" onPress={logOut}>
        Log out
      </Button>
    </View>
  );
}
