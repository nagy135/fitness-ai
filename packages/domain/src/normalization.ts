import type { TrackingType, WorkoutSet } from './types';

const punctuation = /[^a-z0-9]+/g;

function definedSetFields(set: WorkoutSet, fields: Array<keyof WorkoutSet>): WorkoutSet {
  return Object.fromEntries(
    fields.flatMap((field) => (set[field] === undefined ? [] : [[field, set[field]]])),
  ) as WorkoutSet;
}

export function normalizeSetForTrackingType(
  set: WorkoutSet,
  trackingType: TrackingType,
): WorkoutSet {
  const commonFields: Array<keyof WorkoutSet> = ['rir', 'rpe', 'notes'];

  switch (trackingType) {
    case 'weight_reps':
      return definedSetFields(set, ['weightKg', 'reps', ...commonFields]);
    case 'reps':
      return definedSetFields(set, ['reps', ...commonFields]);
    case 'duration':
      return definedSetFields(set, ['durationSeconds', ...commonFields]);
    case 'distance':
      return definedSetFields(set, ['distanceMeters', 'durationSeconds', ...commonFields]);
    case 'weight_duration':
      return definedSetFields(set, ['weightKg', 'durationSeconds', ...commonFields]);
    case 'custom':
      return definedSetFields(set, [
        'weightKg',
        'reps',
        'durationSeconds',
        'distanceMeters',
        ...commonFields,
      ]);
  }
}

export function normalizeExerciseName(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase('en-US')
    .replace(punctuation, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b(deadlifts|presses|raises|rows|squats)\b/g, (word) => word.slice(0, -1));
}

export function exerciseMatchScore(
  query: string,
  exercise: { name: string; aliases: readonly string[] },
): number {
  const raw = query.trim().toLocaleLowerCase('en-US');
  const normalized = normalizeExerciseName(query);
  if (exercise.name.trim().toLocaleLowerCase('en-US') === raw) return 100;
  if (exercise.aliases.some((alias) => alias.trim().toLocaleLowerCase('en-US') === raw)) return 90;
  if (normalizeExerciseName(exercise.name) === normalized) return 80;
  if (exercise.aliases.some((alias) => normalizeExerciseName(alias) === normalized)) return 70;

  const queryTokens = new Set(normalized.split(' ').filter(Boolean));
  const candidates = [exercise.name, ...exercise.aliases].map(normalizeExerciseName);
  const overlap = candidates.reduce((best, candidate) => {
    const tokens = candidate.split(' ').filter(Boolean);
    if (tokens.length === 0 || queryTokens.size === 0) return best;
    const matches = tokens.filter((token) => queryTokens.has(token)).length;
    return Math.max(best, matches / Math.max(tokens.length, queryTokens.size));
  }, 0);
  return Math.round(overlap * 60);
}
