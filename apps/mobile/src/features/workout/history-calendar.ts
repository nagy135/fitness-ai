// Use local dates, matching the dates displayed on workout history cards.
export function historyDayKey(value: Date | number) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function historyMonthWeeks(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const offset = (firstDay.getDay() + 6) % 7; // Monday first.
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: Math.ceil((offset + dayCount) / 7) }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const day = week * 7 + weekday - offset + 1;
      return day < 1 || day > dayCount ? null : new Date(year, monthIndex, day);
    }),
  );
}

export function groupWorkoutsByDay<T extends { performedAt: number }>(workouts: T[]) {
  const days = new Map<string, T[]>();
  for (const workout of workouts) {
    const key = historyDayKey(workout.performedAt);
    const existing = days.get(key);
    if (existing) existing.push(workout);
    else days.set(key, [workout]);
  }
  return days;
}
