import type { WorkoutSet } from './types';

export type SetMeasurementField = 'weightKg' | 'reps' | 'durationSeconds' | 'distanceMeters';

export function adjustSetMeasurement(
  set: WorkoutSet,
  field: SetMeasurementField,
  delta: number,
): number | undefined {
  const current = set[field];
  if (current === undefined || !Number.isFinite(delta) || delta === 0) return undefined;
  const next = Number((current + delta).toFixed(2));
  if (!Number.isFinite(next) || next <= 0 || (field === 'reps' && !Number.isInteger(next)))
    return undefined;
  return next;
}
