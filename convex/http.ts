import { httpRouter } from 'convex/server';
import { authComponent, createAuth, getTrustedOrigins } from './auth';

const http = httpRouter();

authComponent.registerRoutesLazy(http, createAuth, {
  basePath: '/api/auth',
  cors: true,
  trustedOrigins: getTrustedOrigins(process.env.CONVEX_SITE_URL ?? process.env.SITE_URL),
});

export default http;
