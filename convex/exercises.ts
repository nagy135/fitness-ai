import { ConvexError, v } from 'convex/values';
import { exerciseMatchScore, normalizeExerciseName } from '@fitness/domain';
import { mutation, query } from './_generated/server';
import { requireUserProfile } from './lib/auth';
import { trackingTypeValidator } from './model';

export const list = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const exercises = await ctx.db
      .query('exercises')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();
    return exercises
      .filter((exercise) => args.includeArchived || exercise.archivedAt === undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const search = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const exercises = await ctx.db
      .query('exercises')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();
    return exercises
      .filter((exercise) => exercise.archivedAt === undefined)
      .map((exercise) => ({ exercise, score: exerciseMatchScore(args.query, exercise) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(args.limit ?? 5, 10));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    aliases: v.array(v.string()),
    description: v.optional(v.string()),
    muscleGroups: v.optional(v.array(v.string())),
    equipment: v.optional(v.array(v.string())),
    trackingType: trackingTypeValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const name = args.name.trim();
    if (!name) throw new ConvexError('Exercise name is required');
    const normalizedName = normalizeExerciseName(name);
    const existing = await ctx.db
      .query('exercises')
      .withIndex('by_user_name', (q) => q.eq('userId', user._id).eq('normalizedName', normalizedName))
      .unique();
    if (existing && existing.archivedAt === undefined) return existing._id;

    const aliases = [...new Set(args.aliases.map((alias) => alias.trim()).filter(Boolean))];
    const now = Date.now();
    return ctx.db.insert('exercises', {
      userId: user._id,
      name,
      normalizedName,
      aliases,
      normalizedAliases: aliases.map(normalizeExerciseName),
      description: args.description?.trim() || undefined,
      muscleGroups: args.muscleGroups,
      equipment: args.equipment,
      trackingType: args.trackingType,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    exerciseId: v.id('exercises'),
    name: v.optional(v.string()),
    aliases: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    muscleGroups: v.optional(v.array(v.string())),
    equipment: v.optional(v.array(v.string())),
    trackingType: v.optional(trackingTypeValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const exercise = await ctx.db.get(args.exerciseId);
    if (!exercise || exercise.userId !== user._id) throw new ConvexError('Exercise not found');
    const { exerciseId: _, ...patch } = args;
    const name = patch.name?.trim();
    const aliases = patch.aliases?.map((alias) => alias.trim()).filter(Boolean);
    await ctx.db.patch(exercise._id, {
      ...patch,
      name,
      normalizedName: name ? normalizeExerciseName(name) : exercise.normalizedName,
      aliases,
      normalizedAliases: aliases?.map(normalizeExerciseName),
      updatedAt: Date.now(),
    });
  },
});

export const archive = mutation({
  args: { exerciseId: v.id('exercises') },
  handler: async (ctx, args) => {
    const user = await requireUserProfile(ctx);
    const exercise = await ctx.db.get(args.exerciseId);
    if (!exercise || exercise.userId !== user._id) throw new ConvexError('Exercise not found');
    await ctx.db.patch(exercise._id, { archivedAt: Date.now(), updatedAt: Date.now() });
  },
});
