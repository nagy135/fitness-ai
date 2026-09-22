import { v } from 'convex/values';
import { AI_MODELS, AI_REASONING_OPTIONS } from '@fitness/ai/settings';

export const aiSettingsValidator = v.object({
  model: v.union(...AI_MODELS.map(({ id }) => v.literal(id))),
  reasoningEffort: v.union(...AI_REASONING_OPTIONS.map(({ id }) => v.literal(id))),
});

export const trackingTypeValidator = v.union(
  v.literal('weight_reps'),
  v.literal('reps'),
  v.literal('duration'),
  v.literal('distance'),
  v.literal('weight_duration'),
  v.literal('custom'),
);

export const setFields = {
  weightKg: v.optional(v.number()),
  reps: v.optional(v.number()),
  durationSeconds: v.optional(v.number()),
  distanceMeters: v.optional(v.number()),
  rir: v.optional(v.number()),
  rpe: v.optional(v.number()),
  notes: v.optional(v.string()),
};

export const draftSetValidator = v.object({ setId: v.string(), ...setFields });
export const draftExerciseValidator = v.object({
  rowId: v.string(),
  exerciseId: v.optional(v.id('exercises')),
  name: v.string(),
  notes: v.optional(v.string()),
  sets: v.array(draftSetValidator),
});

export const draftSnapshotValidator = v.object({
  date: v.string(),
  status: v.union(v.literal('active'), v.literal('confirming')),
  exercises: v.array(draftExerciseValidator),
  notes: v.optional(v.string()),
});

export const draftEventTypeValidator = v.union(
  v.literal('add_exercises'),
  v.literal('add_set'),
  v.literal('update_set'),
  v.literal('remove_set'),
  v.literal('add_exercise'),
  v.literal('remove_exercise'),
  v.literal('update_notes'),
  v.literal('reorder_exercises'),
  v.literal('undo'),
);

export const eventSourceValidator = v.union(v.literal('user_ui'), v.literal('ai'));
