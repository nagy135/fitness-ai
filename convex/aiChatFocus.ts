import { v } from 'convex/values';
import { internalMutation, query } from './_generated/server';
import { requireAuthenticatedUser, requireUserProfile } from './lib/auth';
import { assertWorkoutRequest } from './lib/workoutRequest';

export const latest = query({
  args: {},
  handler: async (ctx) => {
    const auth = await requireAuthenticatedUser(ctx);
    const user = await ctx.db
      .query('userProfiles')
      .withIndex('by_auth_user', (q) => q.eq('authUserId', String(auth._id)))
      .unique();
    if (!user) return null;
    return ctx.db
      .query('aiChatFocus')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
  },
});

export const request = internalMutation({
  args: {
    open: v.boolean(),
    requestId: v.optional(v.id('workoutRequests')),
    sessionId: v.optional(v.id('analysisSessions')),
  },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    let scope;
    if (args.requestId && !args.sessionId) {
      const request = await ctx.db.get(args.requestId);
      if (!request || request.userId !== user._id) throw new Error('Request not found');
      await assertWorkoutRequest(ctx, user._id, request.draftId, {
        source: 'ai',
        requestId: request._id,
      });
      scope = { mode: 'workout' as const, draftId: request.draftId, sessionId: undefined };
    } else if (args.sessionId && !args.requestId) {
      const session = await ctx.db.get(args.sessionId);
      if (!session || session.userId !== user._id) throw new Error('Analysis not found');
      scope = { mode: 'analysis' as const, sessionId: session._id, draftId: undefined };
    } else {
      throw new Error('Choose one workout request or analysis session');
    }
    const previous = await ctx.db
      .query('aiChatFocus')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    const version = (previous?.version ?? 0) + 1;
    const command = { ...scope, open: args.open, version };
    // Keep only the latest UI command, separate from training data and history.
    if (previous) await ctx.db.patch(previous._id, command);
    else await ctx.db.insert('aiChatFocus', { ...command, userId: user._id });
    return { status: 'requested' as const, open: args.open, version };
  },
});
