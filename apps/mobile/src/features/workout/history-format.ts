export interface WorkoutHistorySet {
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function formatSetMeasure(set: WorkoutHistorySet) {
  if (set.weightKg !== undefined) return `${formatNumber(set.weightKg)}kg`;
  if (set.reps !== undefined) return `${formatNumber(set.reps)} reps`;
  if (set.durationSeconds !== undefined) return `${formatNumber(set.durationSeconds)} sec`;
  if (set.distanceMeters !== undefined) return `${formatNumber(set.distanceMeters)}m`;
  return 'set';
}

export function formatSetSummary(sets: WorkoutHistorySet[]) {
  const counts = new Map<string, number>();
  for (const set of sets) {
    const measure = formatSetMeasure(set);
    counts.set(measure, (counts.get(measure) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([measure, count]) => (measure === 'set' ? `${count} sets` : `${count}×${measure}`))
    .join(', ');
}
