import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import { requireUserProfile } from './lib/auth';

const mode = v.union(v.literal('workout'), v.literal('analysis'));
const role = v.union(v.literal('user'), v.literal('assistant'));
const legacyChart = v.object({
  type: v.literal('line'),
  title: v.string(),
  metric: v.string(),
  unit: v.string(),
  points: v.array(v.object({ x: v.number(), y: v.number() })),
});
const chart = v.union(
  legacyChart,
  v.object({
    type: v.union(v.literal('line'), v.literal('bar'), v.literal('scatter')),
    title: v.string(),
    xAxis: v.object({
      label: v.string(),
      scale: v.union(v.literal('category'), v.literal('linear'), v.literal('time')),
    }),
    yAxis: v.object({ label: v.string(), unit: v.optional(v.string()) }),
    series: v.array(
      v.object({
        name: v.string(),
        points: v.array(v.object({ x: v.union(v.string(), v.number()), y: v.number() })),
      }),
    ),
  }),
);

export const append = mutation({
  args: { mode, role, text: v.string(), chart: v.optional(chart) },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    return ctx.db.insert('aiMessages', { userId: user._id, ...args, createdAt: Date.now() });
  },
});

export const recent = query({
  args: { mode, limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    return ctx.db
      .query('aiMessages')
      .withIndex('by_user_mode', (q) => q.eq('userId', user._id).eq('mode', args.mode))
      .order('desc')
      .take(Math.min(args.limit ?? 20, 50));
  },
});

// Model context is intentionally separate from the paginated conversation drawer.
export const conversation = query({
  args: { mode },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const messages = await ctx.db
      .query('aiMessages')
      .withIndex('by_user_mode', (q) => q.eq('userId', user._id).eq('mode', args.mode))
      .order('asc')
      .collect();
    return messages.map(({ role, text, chart }) => ({
      role,
      content: chart ? `${text}\n\nCHART: ${JSON.stringify(chart)}` : text,
    }));
  },
});

// Reuse an unacknowledged submission even after an app restart or lost response.
// Acknowledging the outcome allows a later, intentional identical prompt.
export const prepareWorkoutRequest = mutation({
  args: { prompt: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const prompt = args.prompt.trim();
    if (!prompt) throw new Error('Prompt is required');
    const requests = await ctx.db
      .query('workoutRequests')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();
    const existing = requests.find((request) => !request.acknowledged && request.prompt === prompt);
    if (existing) return existing._id;
    if (requests.some((request) => request.status === 'running' && request.expiresAt > Date.now()))
      throw new Error('A workout request is still running. Try again when it finishes.');
    const drafts = await ctx.db
      .query('workoutDrafts')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();
    const draft = drafts.find((item) => item.status === 'active');
    if (!draft) throw new Error('No active workout draft');
    return ctx.db.insert('workoutRequests', {
      userId: user._id,
      draftId: draft._id,
      prompt,
      status: 'queued',
      acknowledged: false,
      expiresAt: 0,
      createdAt: Date.now(),
    });
  },
});

export const acknowledgeWorkoutRequest = mutation({
  args: { requestId: v.id('workoutRequests') },
  handler: async (ctx, { requestId }) => {
    const user = await requireUserProfile(ctx);
    const request = await ctx.db.get(requestId);
    if (!request || request.userId !== user._id) throw new Error('Request not found');
    if (request.status !== 'completed' && request.status !== 'failed')
      throw new Error('Request has not finished');
    await ctx.db.patch(requestId, { acknowledged: true });
  },
});

export const beginWorkoutRequest = internalMutation({
  args: { requestId: v.id('workoutRequests') },
  handler: async (ctx, { requestId }) => {
    const user = await requireUserProfile(ctx);
    const request = await ctx.db.get(requestId);
    if (!request || request.userId !== user._id) throw new Error('Request not found');
    if (request.status === 'completed' || request.status === 'failed')
      return { execute: false, request };
    if (request.status === 'running') {
      if (request.expiresAt > Date.now()) throw new Error('This request is still running');
      const text =
        'This request timed out. Changes already saved are shown in your draft; this submission will not run again.';
      await ctx.db.patch(requestId, { status: 'failed', text });
      await ctx.db.insert('aiMessages', {
        userId: user._id,
        mode: 'workout',
        role: 'assistant',
        text,
        createdAt: Date.now(),
      });
      return { execute: false, request: { ...request, text } };
    }
    const requests = await ctx.db
      .query('workoutRequests')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();
    if (requests.some((item) => item.status === 'running' && item.expiresAt > Date.now()))
      throw new Error('Another workout request is still running');
    const draft = await ctx.db.get(request.draftId);
    if (!draft || draft.userId !== user._id) throw new Error('Workout draft no longer exists');
    await ctx.db.patch(requestId, { status: 'running', expiresAt: Date.now() + 10 * 60 * 1000 });
    await ctx.db.insert('aiMessages', {
      userId: user._id,
      mode: 'workout',
      role: 'user',
      text: request.prompt,
      createdAt: Date.now(),
    });
    return { execute: true, request };
  },
});

export const finishWorkoutRequest = internalMutation({
  args: { requestId: v.id('workoutRequests'), text: v.string(), failed: v.boolean() },
  handler: async (ctx, { requestId, text, failed }) => {
    const user = await requireUserProfile(ctx);
    const request = await ctx.db.get(requestId);
    if (!request || request.userId !== user._id) throw new Error('Request not found');
    if (request.status !== 'running' || request.expiresAt <= Date.now())
      throw new Error('Request is no longer running');
    await ctx.db.patch(requestId, { status: failed ? 'failed' : 'completed', text });
    await ctx.db.insert('aiMessages', {
      userId: user._id,
      mode: 'workout',
      role: 'assistant',
      text,
      createdAt: Date.now(),
    });
  },
});
