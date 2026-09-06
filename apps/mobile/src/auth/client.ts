import { convexClient, crossDomainClient } from '@convex-dev/better-auth/client/plugins';
import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import type { BetterAuthClientPlugin } from 'better-auth/client';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const siteUrl = process.env.EXPO_PUBLIC_CONVEX_SITE_URL;
if (!siteUrl) throw new Error('EXPO_PUBLIC_CONVEX_SITE_URL is required');

const configuredScheme = Constants.expoConfig?.scheme;
const scheme = Array.isArray(configuredScheme) ? configuredScheme[0] : configuredScheme;

const sessionRefreshClient = () =>
  ({
    id: 'session-refresh',
    getActions: (_fetch, store) => ({
      refreshSession: () => store.notify('$sessionSignal'),
    }),
  }) satisfies BetterAuthClientPlugin;

export const authClient = createAuthClient({
  baseURL: siteUrl,
  plugins: [
    convexClient(),
    sessionRefreshClient(),
    ...(Platform.OS === 'web'
      ? [crossDomainClient()]
      : [
          expoClient({
            scheme: scheme ?? 'fitai',
            storagePrefix: 'fitai',
            storage: SecureStore,
          }),
        ]),
  ],
});
