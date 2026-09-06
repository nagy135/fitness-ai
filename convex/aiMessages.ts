import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
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
