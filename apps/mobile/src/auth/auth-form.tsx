import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { Button, Input } from '@fitness/ui';
import { authClient } from './client';
import { Screen } from '@/components/screen';
import { DisplayText } from '@/components/display-text';
import { WeightPlates } from '@/components/weight-plates';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const submitting = useRef(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());
  const scrollView = useRef<ScrollView>(null);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  function keepFocusedInputVisible() {
    if (!keyboardVisible || Platform.OS === 'web') return;
    const input = TextInput.State.currentlyFocusedInput();
    if (input) {
      scrollView.current?.scrollResponderScrollNativeHandleToKeyboard(input, 16, true);
    }
  }

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
        ref={scrollView}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onLayout={keepFocusedInputVisible}
        onContentSizeChange={keepFocusedInputVisible}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: keyboardVisible ? 'flex-start' : 'center',
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 16,
        }}
      >
        <View className="mx-auto w-full max-w-md">
          {!keyboardVisible ? (
            <View className="mb-6 flex-row items-center justify-between rounded-[24px] bg-highlight px-5 py-5">
              <DisplayText className="flex-1 text-[52px] leading-[54px] text-highlight-ink dark:text-highlight-ink">
                Every rep{'\n'}counts.
              </DisplayText>
              <WeightPlates size={112} />
            </View>
          ) : null}
          <DisplayText className="mb-4 text-[36px] leading-10">
            {registering ? 'Create your account' : 'Welcome back.'}
          </DisplayText>
          <View className="gap-3">
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
          <Text className="mt-4 text-center text-sm text-muted dark:text-muted-dark">
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
