import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex, crossDomain } from '@convex-dev/better-auth/plugins';
import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth/minimal';
import { components } from './_generated/api';
import type { DataModel } from './_generated/dataModel';
import { query } from './_generated/server';
import authConfig from './auth.config';

export const authComponent = createClient<DataModel>(components.betterAuth);

export function getTrustedOrigins(siteUrl?: string) {
  const isLocalDeployment = Boolean(
    siteUrl && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(siteUrl),
  );
  const configuredOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [
    'fitai://',
    'fitai://*',
    'exp://**',
    ...configuredOrigins,
    ...(isLocalDeployment
      ? [
          'http://localhost:8081',
          'http://127.0.0.1:8081',
          'http://localhost:19006',
          'http://127.0.0.1:19006',
        ]
      : []),
  ];
}

export function createAuth(ctx: GenericCtx<DataModel>) {
  const siteUrl = process.env.CONVEX_SITE_URL ?? process.env.SITE_URL;
  if (!siteUrl) throw new Error('CONVEX_SITE_URL or SITE_URL must be configured');
  const webAppUrl = process.env.SITE_URL;

  return betterAuth({
    baseURL: siteUrl,
    trustedOrigins: getTrustedOrigins(siteUrl),
    database: authComponent.adapter(ctx),
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    plugins: [
      expo(),
      convex({ authConfig }),
      ...(webAppUrl ? [crossDomain({ siteUrl: webAppUrl })] : []),
    ],
  });
}

export const current = query({
  args: {},
  handler: (ctx) => authComponent.safeGetAuthUser(ctx),
});
