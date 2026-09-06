import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Button, Input } from '@fitness/ui';
import { authClient } from './client';
import { Screen } from '@/components/screen';
import { Dumbbell } from 'lucide-react-native';
import { useAppTheme } from '@/components/theme-provider';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { colors } = useAppTheme();
  const submitting = useRef(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (
      submitting.current ||
      !email.trim() ||
      password.length < 8 ||
      (mode === 'register' && !name.trim())
    )
      return;
    submitting.current = true;
    setLoading(true);
    setError(undefined);
    try {
      const result =
        mode === 'register'
          ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
          : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(result.error.message ?? 'Authentication failed');
        return;
      }
      // The protected root navigator reacts to the Better Auth session and
      // switches route groups once Convex has received the access token.
      const session = await authClient.getSession();
      if (session.error || !session.data?.session) {
        setError(
          session.error?.message ?? 'Login succeeded, but the session could not be restored.',
        );
        return;
      }
      authClient.refreshSession();
    } catch {
      setError('Could not connect. Check your connection and try again.');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  const registering = mode === 'register';
  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="grow justify-center px-6 py-10"
      >
        <View className="mx-auto w-full max-w-md">
          <View className="mb-10 flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-soft dark:bg-soft-dark">
              <Dumbbell size={26} color={colors.accent} />
            </View>
            <Text className="text-xl font-bold text-ink dark:text-ink-dark">Fitness AI</Text>
          </View>
          <Text className="mt-3 text-4xl font-black text-ink dark:text-ink-dark">
            {registering ? 'Create your account' : 'Welcome back'}
          </Text>
          <Text className="mb-8 mt-3 text-base leading-6 text-muted dark:text-muted-dark">
            A place for every set. Log your workouts and see how far you’ve come.
          </Text>
          <View className="gap-4">
            {registering ? (
              <Input autoCapitalize="words" label="Name" onChangeText={setName} value={name} />
            ) : null}
            <Input
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              label="Email"
              onChangeText={setEmail}
              value={email}
            />
            <Input
              autoComplete={registering ? 'new-password' : 'current-password'}
              label="Password"
              onChangeText={setPassword}
              onSubmitEditing={submit}
              secureTextEntry
              value={password}
            />
            {error ? (
              <Text accessibilityRole="alert" className="text-sm text-danger dark:text-danger-dark">
                {error}
              </Text>
            ) : null}
            <Button
              disabled={!email.trim() || password.length < 8 || (registering && !name.trim())}
              loading={loading}
              onPress={submit}
            >
              {registering ? 'Register' : 'Log in'}
            </Button>
          </View>
          <Text className="mt-6 text-center text-sm text-muted dark:text-muted-dark">
            {registering ? 'Already have an account? ' : 'New here? '}
            <Link
              className="font-bold text-accent dark:text-accent-dark"
              href={registering ? '/login' : '/register'}
            >
              {registering ? 'Log in' : 'Register'}
            </Link>
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
