import { ConvexError } from 'convex/values';
import type { WorkoutSet } from '@fitness/domain';

export function validateTrackedSet(set: WorkoutSet) {
  const numbers = ['weightKg', 'durationSeconds', 'distanceMeters'] as const;
  for (const field of numbers) {
    const value = set[field];
    if (
      value !== undefined &&
      (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    ) {
      throw new ConvexError(`${field} must be positive`);
    }
  }
  if (set.reps !== undefined && (!Number.isInteger(set.reps) || (set.reps as number) <= 0)) {
    throw new ConvexError('reps must be a positive integer');
  }
  for (const field of ['rir', 'rpe'] as const) {
    const value = set[field];
    if (
      value !== undefined &&
      (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10)
    ) {
      throw new ConvexError(`${field} must be between 0 and 10`);
    }
  }
  if (
    !(['weightKg', 'reps', 'durationSeconds', 'distanceMeters'] as const).some(
      (field) => set[field] !== undefined,
    )
  ) {
    throw new ConvexError('A set needs at least one tracked value');
  }
}

export function validateExerciseOrder(
  currentRowIds: readonly string[],
  orderedRowIds: readonly string[],
) {
  if (
    orderedRowIds.length !== currentRowIds.length ||
    new Set(orderedRowIds).size !== currentRowIds.length
  ) {
    throw new ConvexError('Order must include every row once');
  }
  const current = new Set(currentRowIds);
  if (orderedRowIds.some((rowId) => !current.has(rowId)))
    throw new ConvexError('Unknown row in order');
}
