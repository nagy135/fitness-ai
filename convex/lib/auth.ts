import { ConvexError } from 'convex/values';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { authComponent } from '../auth';

type ReadCtx = QueryCtx | MutationCtx;

export async function requireAuthenticatedUser(ctx: ReadCtx) {
  const authUser = await authComponent.safeGetAuthUser(ctx);
  if (!authUser) throw new ConvexError('Unauthenticated');
  return authUser;
}

export async function requireUserProfile(ctx: ReadCtx) {
  const authUser = await requireAuthenticatedUser(ctx);
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_auth_user', (q) => q.eq('authUserId', String(authUser._id)))
    .unique();
  if (!profile) throw new ConvexError('User profile is not initialized');
  return profile;
}
