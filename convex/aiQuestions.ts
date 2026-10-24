import { AskUserSchema } from '@fitness/ai';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { requireAuthenticatedUser, requireUserProfile } from './lib/auth';
import { assertWorkoutRequest } from './lib/workoutRequest';

async function isLive(ctx: QueryCtx, question: Doc<'aiQuestions'>) {
  if (question.expiresAt <= Date.now()) return false;
  if (question.requestId) {
    const request = await ctx.db.get(question.requestId);
    return request?.status === 'running' && request.expiresAt > Date.now();
  }
  return !!(question.sessionId && (await ctx.db.get(question.sessionId)));
}

export const pending = query({
  args: {},
  handler: async (ctx) => {
    // The overlay mounts before the home screen initializes a new account.
    const auth = await requireAuthenticatedUser(ctx);
    const user = await ctx.db
      .query('userProfiles')
      .withIndex('by_auth_user', (q) => q.eq('authUserId', String(auth._id)))
      .unique();
    if (!user) return [];
    const questions = await ctx.db
      .query('aiQuestions')
      .withIndex('by_user_status', (q) => q.eq('userId', user._id).eq('status', 'pending'))
      .collect();
    const live = await Promise.all(questions.map((question) => isLive(ctx, question)));
    return questions.filter((_question, index) => live[index]);
  },
});

export const create = internalMutation({
  args: {
    mode: v.union(v.literal('workout'), v.literal('analysis')),
    requestId: v.optional(v.id('workoutRequests')),
    sessionId: v.optional(v.id('analysisSessions')),
    question: v.string(),
    options: v.array(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args): Promise<Id<'aiQuestions'>> => {
    const user = await requireUserProfile(ctx);
    const input = AskUserSchema.parse({ question: args.question, options: args.options });
    const expiresAt = Math.min(args.expiresAt, Date.now() + 3 * 60_000);
    if (expiresAt <= Date.now()) throw new Error('The question has expired');
    if (args.mode === 'workout') {
      if (!args.requestId || args.sessionId) throw new Error('Workout request is required');
      const request = await ctx.db.get(args.requestId);
      if (!request || request.userId !== user._id) throw new Error('Request not found');
      await assertWorkoutRequest(ctx, user._id, request.draftId, {
        source: 'ai',
        requestId: args.requestId,
      });
    } else {
      if (!args.sessionId || args.requestId) throw new Error('Analysis session is required');
      const session = await ctx.db.get(args.sessionId);
      if (!session || session.userId !== user._id) throw new Error('Analysis not found');
      await ctx.db.insert('aiMessages', {
        userId: user._id,
        mode: 'analysis',
        role: 'assistant',
        sessionId: session._id,
        text: input.question,
        createdAt: Date.now(),
      });
    }
    const id = await ctx.db.insert('aiQuestions', {
      ...args,
      ...input,
      expiresAt,
      userId: user._id,
      status: 'pending',
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(Math.max(0, expiresAt - Date.now()), internal.aiQuestions.expire, {
      id,
    });
    return id;
  },
});

export const read = internalQuery({
  args: { id: v.id('aiQuestions') },
  handler: async (ctx, { id }) => {
    const user = await requireUserProfile(ctx);
    const question = await ctx.db.get(id);
    if (!question || question.userId !== user._id) throw new Error('Question not found');
    return question;
  },
});

export const respond = mutation({
  args: { id: v.id('aiQuestions'), answer: v.optional(v.string()) },
  handler: async (ctx, { id, answer }) => {
    const user = await requireUserProfile(ctx);
    const question = await ctx.db.get(id);
    if (!question || question.userId !== user._id) throw new Error('Question not found');
    // Repeated delivery never replaces an answer from this or another device.
    if (question.status !== 'pending') return;
    if (!(await isLive(ctx, question))) throw new Error('This question is no longer waiting');
    const text = answer?.trim();
    if (answer !== undefined && (!text || text.length > 2_000))
      throw new Error('Use an answer between 1 and 2000 characters');
    await ctx.db.patch(id, {
      status: text ? 'answered' : 'dismissed',
      ...(text ? { answer: text } : {}),
    });
    if (question.sessionId) {
      await ctx.db.insert('aiMessages', {
        userId: user._id,
        mode: 'analysis',
        role: 'user',
        sessionId: question.sessionId,
        text: text ?? 'Question dismissed.',
        createdAt: Date.now(),
      });
    }
  },
});

// Runs without caller identity, and can only expire a still-pending question.
export const expire = internalMutation({
  args: { id: v.id('aiQuestions') },
  handler: async (ctx, { id }) => {
    const question = await ctx.db.get(id);
    if (question?.status === 'pending' && question.expiresAt <= Date.now())
      await ctx.db.patch(id, { status: 'expired' });
  },
});

export const close = internalMutation({
  args: { id: v.id('aiQuestions') },
  handler: async (ctx, { id }) => {
    const user = await requireUserProfile(ctx);
    const question = await ctx.db.get(id);
    if (!question || question.userId !== user._id) throw new Error('Question not found');
    if (question.status === 'pending') await ctx.db.patch(id, { status: 'expired' });
  },
});
