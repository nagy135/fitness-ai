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
  const groups: { measure: string; count: number }[] = [];
  for (const set of sets) {
    const measure = formatSet(set);
    const previous = groups.at(-1);
    if (previous?.measure === measure) previous.count += 1;
    else groups.push({ measure, count: 1 });
  }
  return groups
    .map(({ measure, count }) => `${count} ${count === 1 ? 'set' : 'sets'} of ${measure}`)
    .join(', ');
}
