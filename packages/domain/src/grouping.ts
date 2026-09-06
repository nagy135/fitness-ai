const DAY_MS = 86_400_000;

function utcDateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function startOfIsoWeek(timestamp: number): string {
  const date = new Date(timestamp);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return utcDateKey(date.getTime());
}

export function groupWorkoutsByWeek<T extends { performedAt: number }>(workouts: readonly T[]) {
  return groupBy(workouts, (workout) => startOfIsoWeek(workout.performedAt));
}

export function groupWorkoutsByMonth<T extends { performedAt: number }>(workouts: readonly T[]) {
  return groupBy(workouts, (workout) => utcDateKey(workout.performedAt).slice(0, 7));
}

function groupBy<T>(items: readonly T[], keyFor: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

export function calculateTrainingFrequency(
  workouts: readonly { performedAt: number }[],
  from: number,
  to: number,
): number {
  if (to < from) throw new RangeError('to must be on or after from');
  const weeks = Math.max(1, (to - from + DAY_MS) / (7 * DAY_MS));
  const uniqueDays = new Set(
    workouts
      .filter(({ performedAt }) => performedAt >= from && performedAt <= to)
      .map(({ performedAt }) => utcDateKey(performedAt)),
  );
  return Math.round((uniqueDays.size / weeks) * 100) / 100;
}
