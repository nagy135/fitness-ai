import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ChevronRight, Dumbbell, Moon, Sun } from 'lucide-react-native';
import { Button, IconButton } from '@fitness/ui';
import { authClient } from '@/auth/client';
import { Screen } from '@/components/screen';
import { ErrorNotice } from '@/components/error-notice';
import { useAppTheme } from '@/components/theme-provider';

export default function AccountScreen() {
  const { colors, isDark, toggleTheme } = useAppTheme();
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
    <Screen>
      <ScrollView contentContainerClassName="grow px-5 pb-6 pt-4">
        <IconButton
          accessibilityLabel="Back to workout"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        >
          <ArrowLeft color={colors.text} size={22} />
        </IconButton>
        <Text className="mb-2 mt-6 text-[32px] font-bold tracking-tight text-ink dark:text-ink-dark">
          Settings
        </Text>
        <Text className="mb-8 text-base text-muted dark:text-muted-dark">
          Make this space yours.
        </Text>
        <View className="overflow-hidden rounded-2xl border border-line bg-panel dark:border-line-dark dark:bg-panel-dark">
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
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Dark mode"
            accessibilityState={{ checked: isDark }}
            onPress={toggleTheme}
            className="min-h-20 flex-row items-center gap-4 border-t border-line px-4 py-5 dark:border-line-dark"
          >
            {isDark ? (
              <Moon color={colors.accent} size={23} />
            ) : (
              <Sun color={colors.accent} size={23} />
            )}
            <View className="flex-1">
              <Text className="text-base font-semibold text-ink dark:text-ink-dark">
                Appearance
              </Text>
              <Text className="mt-1 text-sm text-muted dark:text-muted-dark">
                {isDark ? 'Dark mode' : 'Light mode'}
              </Text>
            </View>
            <Text className="text-sm font-semibold text-accent dark:text-accent-dark">Change</Text>
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
