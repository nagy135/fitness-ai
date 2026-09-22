import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import {
  aiSettingsValidator,
  draftEventTypeValidator,
  draftExerciseValidator,
  draftSnapshotValidator,
  eventSourceValidator,
  setFields,
  trackingTypeValidator,
} from './model';

const legacyAnalysisChartValidator = v.object({
  type: v.literal('line'),
  title: v.string(),
  metric: v.string(),
  unit: v.string(),
  points: v.array(v.object({ x: v.number(), y: v.number() })),
});
const analysisChartValidator = v.union(
  legacyAnalysisChartValidator,
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

export default defineSchema({
  userProfiles: defineTable({
    authUserId: v.string(),
    displayName: v.optional(v.string()),
    units: v.union(v.literal('metric'), v.literal('imperial')),
    aiSettings: v.optional(aiSettingsValidator),
    createdAt: v.number(),
  }).index('by_auth_user', ['authUserId']),

  exercises: defineTable({
    userId: v.id('userProfiles'),
    name: v.string(),
    normalizedName: v.string(),
    aliases: v.array(v.string()),
    normalizedAliases: v.array(v.string()),
    description: v.optional(v.string()),
    muscleGroups: v.optional(v.array(v.string())),
    equipment: v.optional(v.array(v.string())),
    trackingType: trackingTypeValidator,
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_name', ['userId', 'normalizedName']),

  workoutDrafts: defineTable({
    userId: v.id('userProfiles'),
    name: v.optional(v.string()),
    editingWorkoutId: v.optional(v.id('workouts')),
    date: v.string(),
    status: v.union(v.literal('active'), v.literal('confirming')),
    exercises: v.array(draftExerciseValidator),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_status', ['userId', 'status']),

  workouts: defineTable({
    userId: v.id('userProfiles'),
    name: v.optional(v.string()),
    sourceDraftId: v.id('workoutDrafts'),
    performedAt: v.number(),
    exercises: v.array(
      v.object({
        exerciseId: v.id('exercises'),
        nameSnapshot: v.string(),
        notes: v.optional(v.string()),
        sets: v.array(v.object(setFields)),
      }),
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_performed', ['userId', 'performedAt'])
    .index('by_source_draft', ['sourceDraftId']),

  workoutConfirmations: defineTable({
    userId: v.id('userProfiles'),
    draftId: v.string(),
    workoutId: v.id('workouts'),
    createdAt: v.number(),
  }).index('by_user_draft', ['userId', 'draftId']),

  draftEvents: defineTable({
    userId: v.id('userProfiles'),
    draftId: v.id('workoutDrafts'),
    type: draftEventTypeValidator,
    source: eventSourceValidator,
    payload: v.any(),
    beforeSnapshot: v.optional(draftSnapshotValidator),
    revertedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_draft', ['draftId'])
    .index('by_draft_created', ['draftId', 'createdAt']),

  workoutRequests: defineTable({
    userId: v.id('userProfiles'),
    draftId: v.id('workoutDrafts'),
    prompt: v.string(),
    status: v.union(
      v.literal('queued'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed'),
    ),
    acknowledged: v.boolean(),
    addedRowIds: v.optional(v.array(v.string())),
    expiresAt: v.number(),
    text: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_user', ['userId']),

  aiMessages: defineTable({
    userId: v.id('userProfiles'),
    mode: v.union(v.literal('workout'), v.literal('analysis')),
    role: v.union(v.literal('user'), v.literal('assistant')),
    text: v.string(),
    chart: v.optional(analysisChartValidator),
    createdAt: v.number(),
  }).index('by_user_mode', ['userId', 'mode', 'createdAt']),
});
