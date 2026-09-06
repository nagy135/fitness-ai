import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireAuthenticatedUser, requireUserProfile } from './lib/auth';

export const current = query({
  args: {},
  handler: (ctx) => requireUserProfile(ctx),
});

export const ensureCurrent = mutation({
  args: {
    displayName: v.optional(v.string()),
    units: v.optional(v.union(v.literal('metric'), v.literal('imperial'))),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuthenticatedUser(ctx);
    const authUserId = String(authUser._id);
    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_auth_user', (q) => q.eq('authUserId', authUserId))
      .unique();
    if (existing) return existing._id;
    return ctx.db.insert('userProfiles', {
      authUserId,
      displayName: args.displayName,
      units: args.units ?? 'metric',
      createdAt: Date.now(),
    });
  },
});
