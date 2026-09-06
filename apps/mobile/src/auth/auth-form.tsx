import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Button, Input } from '@fitness/ui';
import { authClient } from './client';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(undefined);
    const result =
      mode === 'register'
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
    if (result.error) {
      setLoading(false);
      setError(result.error.message ?? 'Authentication failed');
      return;
    }
    // The protected root navigator reacts to the Better Auth session and
    // switches route groups once Convex has received the access token.
    const session = await authClient.getSession();
    if (session.error || !session.data?.session) {
      setLoading(false);
      setError(session.error?.message ?? 'Login succeeded, but the session could not be restored.');
      return;
    }
    authClient.refreshSession();
    setLoading(false);
  }

  const registering = mode === 'register';
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-canvas dark:bg-canvas-dark"
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-xs font-black tracking-[3px] text-accent dark:text-accent-dark">
          FITNESS AI
        </Text>
        <Text className="mt-3 text-4xl font-black text-ink dark:text-ink-dark">
          {registering ? 'Create your account' : 'Welcome back'}
        </Text>
        <Text className="mb-8 mt-3 text-base leading-6 text-muted dark:text-muted-dark">
          Log workouts in plain language. Keep the data structured.
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
          {error ? <Text className="text-sm text-danger">{error}</Text> : null}
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
    </KeyboardAvoidingView>
  );
}
