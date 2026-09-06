import '../global.css';
import { ConvexBetterAuthProvider, type AuthClient } from '@convex-dev/better-auth/react';
import { ConvexProvider, ConvexReactClient, useConvexAuth } from 'convex/react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { authClient } from '@/auth/client';
import { ThemeProvider, useAppTheme } from '@/components/theme-provider';
import { LoadingScreen } from '@/components/loading-screen';

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!convexUrl) throw new Error('EXPO_PUBLIC_CONVEX_URL is required');

const convex = new ConvexReactClient(convexUrl, {
  expectAuth: true,
  unsavedChangesWarning: false,
});

// @convex-dev/better-auth 0.12.5 has an open type-only incompatibility with the
// security-patched Better Auth >=1.6.22 named client type. Runtime structures match.
const providerAuthClient = authClient as unknown as AuthClient;

function AppNavigator() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { colors, isDark } = useAppTheme();

  if (isLoading) return <LoadingScreen label="Restoring secure session…" />;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.canvas },
          headerShown: false,
        }}
      >
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(app)" />
          <Stack.Screen name="workout/confirm" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

function AppProviders() {
  return (
    <ConvexProvider client={convex}>
      <ConvexBetterAuthProvider client={convex} authClient={providerAuthClient}>
        <AppNavigator />
      </ConvexBetterAuthProvider>
    </ConvexProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppProviders />
    </ThemeProvider>
  );
}
