import type { WorkoutSet } from './types';

export function calculateVolume(sets: readonly WorkoutSet[]): number {
  return sets.reduce((total, set) => total + (set.weightKg ?? 0) * (set.reps ?? 0), 0);
}

/** Epley estimate. A one-rep set returns the lifted weight exactly. */
export function estimate1RM(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0 || !Number.isInteger(reps) || reps <= 0) {
    throw new RangeError('weightKg and reps must be positive; reps must be an integer');
  }
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

export function normalizeWeight(value: number, from: 'kg' | 'lb', to: 'kg' | 'lb'): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('weight must be non-negative');
  if (from === to) return value;
  const converted = from === 'lb' ? value / 2.2046226218 : value * 2.2046226218;
  return Math.round(converted * 100) / 100;
}

export function compareSets(left: WorkoutSet, right: WorkoutSet): number {
  const left1RM = left.weightKg && left.reps ? estimate1RM(left.weightKg, left.reps) : 0;
  const right1RM = right.weightKg && right.reps ? estimate1RM(right.weightKg, right.reps) : 0;
  return left1RM - right1RM;
}
