import { z } from 'zod';

const WorkoutSetFieldsSchema = z
  .object({
    weightKg: z.number().positive().max(1_500).optional(),
    reps: z.number().int().positive().max(10_000).optional(),
    durationSeconds: z.number().positive().max(604_800).optional(),
    distanceMeters: z.number().positive().max(1_000_000).optional(),
    rir: z.number().min(0).max(10).optional(),
    rpe: z.number().min(0).max(10).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const WorkoutSetInputSchema = WorkoutSetFieldsSchema.refine(
  ({ weightKg, reps, durationSeconds, distanceMeters }) =>
    weightKg !== undefined ||
    reps !== undefined ||
    durationSeconds !== undefined ||
    distanceMeters !== undefined,
  'At least one tracked value is required',
);

export const SearchExercisesInputSchema = z
  .object({
    query: z.string().trim().min(1).max(120),
    limit: z.number().int().min(1).max(10).default(5),
  })
  .strict();

export const CreateExerciseInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    aliases: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
    description: z.string().trim().max(1_000).optional(),
    muscleGroups: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    equipment: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    trackingType: z.enum([
      'weight_reps',
      'reps',
      'duration',
      'distance',
      'weight_duration',
      'custom',
    ]),
  })
  .strict();

export const DraftRowInputSchema = z.object({ rowId: z.string().min(1) }).strict();
export const DraftSetInputSchema = z
  .object({ rowId: z.string().min(1), setId: z.string().min(1) })
  .strict();

const DraftExerciseInputSchema = z
  .object({
    exerciseId: z.string().min(1),
    notes: z.string().trim().max(1_000).optional(),
    sets: z.array(WorkoutSetInputSchema).max(100),
  })
  .strict();

export const AddExercisesToDraftInputSchema = z
  .object({ exercises: z.array(DraftExerciseInputSchema).min(1).max(100) })
  .strict()
  .refine(
    ({ exercises }) =>
      new Set(exercises.map(({ exerciseId }) => exerciseId)).size === exercises.length,
    'Each exercise may appear only once per batch',
  );

export const UpdateSetInputSchema = z
  .object({
    rowId: z.string().min(1),
    setId: z.string().min(1),
    patch: WorkoutSetFieldsSchema.partial().refine(
      (patch) => Object.keys(patch).length > 0,
      'Patch cannot be empty',
    ),
  })
  .strict();

export const UpdateExerciseNotesInputSchema = z
  .object({ rowId: z.string().min(1), notes: z.string().trim().max(1_000) })
  .strict();

export const UpdateExerciseInputSchema = z
  .object({
    exerciseId: z.string().min(1),
    name: z.string().trim().min(1).max(120).optional(),
    aliases: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    description: z.string().trim().max(1_000).optional(),
    trackingType: z
      .enum(['weight_reps', 'reps', 'duration', 'distance', 'weight_duration', 'custom'])
      .optional(),
  })
  .strict();

export const ReorderExercisesInputSchema = z
  .object({ orderedRowIds: z.array(z.string().min(1)).min(1).max(100) })
  .strict();

export const DateRangeSchema = z
  .object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  })
  .strict();

export const ExerciseRangeSchema = DateRangeSchema.extend({
  exerciseId: z.string().min(1),
}).strict();
export const RecentWorkoutsSchema = z
  .object({ limit: z.number().int().min(1).max(50).default(10) })
  .strict();
export const GetWorkoutSchema = z.object({ workoutId: z.string().min(1) }).strict();
export const SearchWorkoutsSchema = DateRangeSchema.extend({
  query: z.string().trim().min(1).max(120),
  limit: z.number().int().min(1).max(50).default(20),
}).strict();
export const CompareExercisesSchema = DateRangeSchema.extend({
  exerciseIds: z.array(z.string().min(1)).min(2).max(5),
}).strict();

const LegacyAnalysisChartSchema = z
  .object({
    type: z.literal('line'),
    title: z.string(),
    metric: z.string(),
    unit: z.string(),
    points: z.array(
      z.object({
        x: z.number(),
        y: z.number(),
      }),
    ),
  })
  .strict();

export const RenderChartSchema = z
  .object({
    type: z.enum(['line', 'bar', 'scatter']),
    title: z.string().trim().min(1).max(120),
    xAxis: z
      .object({
        label: z.string().trim().min(1).max(80),
        scale: z.enum(['category', 'linear', 'time']),
      })
      .strict(),
    yAxis: z
      .object({
        label: z.string().trim().min(1).max(80),
        unit: z.string().trim().max(30).optional(),
      })
      .strict(),
    series: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(80),
            points: z
              .array(
                z
                  .object({
                    x: z.union([z.string().max(120), z.number()]),
                    y: z.number().finite(),
                  })
                  .strict(),
              )
              .max(500),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict();

export const AnalysisChartSchema = z.union([LegacyAnalysisChartSchema, RenderChartSchema]);

export type AnalysisChart = z.infer<typeof AnalysisChartSchema>;

export type WorkoutSetInput = z.infer<typeof WorkoutSetInputSchema>;
