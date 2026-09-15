import type { WorkoutSet } from '@fitness/domain';
export type WorkoutHistorySet = WorkoutSet;

export function formatNumber(value: number) {
  return String(Number(value.toFixed(2)));
}

export function formatSet(set: WorkoutHistorySet) {
  const parts: string[] = [];
  if (set.weightKg !== undefined) parts.push(`${formatNumber(set.weightKg)} kg`);
  if (set.reps !== undefined) parts.push(`${formatNumber(set.reps)} reps`);
  if (set.durationSeconds !== undefined) parts.push(`${formatNumber(set.durationSeconds)} sec`);
  if (set.distanceMeters !== undefined) parts.push(`${formatNumber(set.distanceMeters)} m`);
  return parts.join(' × ') || 'No measurements';
}

export function formatSetSummary(sets: WorkoutHistorySet[]) {
  return sets
    .map((set) => {
      const parts: string[] = [];
      if (set.reps !== undefined) {
        parts.push(`${formatNumber(set.reps)}${set.weightKg === undefined ? ' reps' : ''}`);
      }
      if (set.weightKg !== undefined) parts.push(`${formatNumber(set.weightKg)}kg`);
      if (set.durationSeconds !== undefined) parts.push(`${formatNumber(set.durationSeconds)}sec`);
      if (set.distanceMeters !== undefined) parts.push(`${formatNumber(set.distanceMeters)}m`);
      return parts.join('x') || 'No measurements';
    })
    .join(', ');
}
