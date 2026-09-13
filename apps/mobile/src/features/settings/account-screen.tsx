import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ChevronRight, Dumbbell } from 'lucide-react-native';
import { Button, IconButton } from '@fitness/ui';
import { authClient } from '@/auth/client';
import { Screen } from '@/components/screen';
import { DisplayText } from '@/components/display-text';
import { ErrorNotice } from '@/components/error-notice';
import { useAppTheme } from '@/components/theme-provider';

export default function AccountScreen() {
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const locked = useRef(false);
  async function logOut() {
    if (locked.current) return;
    locked.current = true;
    setLoading(true);
    setError(undefined);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error();
      router.replace('/login');
    } catch {
      setError('Could not log out. Check your connection and try again.');
    } finally {
      locked.current = false;
      setLoading(false);
    }
  }
  return (
    <Screen
      headerLeft={
        <IconButton
          accessibilityLabel="Back to workout"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        >
          <ArrowLeft color={colors.text} size={22} />
        </IconButton>
      }
    >
      <ScrollView contentContainerClassName="grow px-5 pb-6 pt-2">
        <DisplayText className="mb-2 text-[56px] leading-[64px]">Your space.</DisplayText>
        <Text className="mb-8 text-base text-muted dark:text-muted-dark">
          Your exercises. Your way of training.
        </Text>
        <View className="overflow-hidden rounded-[24px] bg-soft dark:bg-soft-dark">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings/exercises')}
            className="min-h-20 flex-row items-center gap-4 px-4 py-5"
          >
            <Dumbbell color={colors.accent} size={23} />
            <View className="flex-1">
              <Text className="text-base font-semibold text-ink dark:text-ink-dark">
                Exercise library
              </Text>
              <Text className="mt-1 text-sm text-muted dark:text-muted-dark">
                Names and shortcuts for your lifts
              </Text>
            </View>
            <ChevronRight color={colors.muted} size={20} />
          </Pressable>
        </View>
        <View className="mt-10">
          <Text className="mb-3 text-lg font-semibold text-ink dark:text-ink-dark">Account</Text>
          <Text className="mb-4 text-sm leading-5 text-muted dark:text-muted-dark">
            Your saved workouts will be here when you log back in.
          </Text>
          <ErrorNotice message={error} />
          <Button variant="secondary" loading={loading} onPress={() => void logOut()}>
            Log out
          </Button>
        </View>
      </ScrollView>
    </Screen>
  );
}
