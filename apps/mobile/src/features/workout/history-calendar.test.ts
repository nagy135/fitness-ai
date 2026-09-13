import { describe, expect, it } from 'vitest';
import { groupWorkoutsByDay, historyDayKey, historyMonthWeeks } from './history-calendar';

describe('workout history calendar', () => {
  it('aligns a Sunday-starting month to Monday-first weeks without losing the last day', () => {
    const weeks = historyMonthWeeks(new Date(2026, 2, 31));
    expect(weeks).toHaveLength(6);
    expect(weeks[0].slice(0, 6)).toEqual(Array(6).fill(null));
    expect(weeks[0][6]?.getDate()).toBe(1);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks[5].map((date) => date?.getDate() ?? null)).toEqual([
      30,
      31,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it('includes leap day and handles a February that fills exactly four weeks', () => {
    const leapDays = historyMonthWeeks(new Date(2024, 1, 1))
      .flat()
      .filter(Boolean);
    expect(leapDays).toHaveLength(29);
    expect(leapDays.at(-1)?.getDate()).toBe(29);
    const weeks = historyMonthWeeks(new Date(2021, 1, 1));
    expect(weeks).toHaveLength(4);
    expect(weeks.flat().every(Boolean)).toBe(true);
  });

  it('handles year transitions when navigating months', () => {
    const date = new Date(2026, 11, 31);
    const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    expect(historyDayKey(next)).toBe('2027-01-01');
    expect(historyMonthWeeks(next).flat().find(Boolean)?.getFullYear()).toBe(2027);
  });

  it('groups multiple workouts by local calendar day and preserves latest-first order', () => {
    const workouts = [
      { id: 'next-day', performedAt: new Date(2026, 8, 14, 0, 1).getTime() },
      { id: 'evening', performedAt: new Date(2026, 8, 13, 23, 59).getTime() },
      { id: 'morning', performedAt: new Date(2026, 8, 13, 0, 1).getTime() },
    ];
    const days = groupWorkoutsByDay(workouts);
    expect(days.get('2026-09-13')?.map((workout) => workout.id)).toEqual(['evening', 'morning']);
    expect(days.get('2026-09-14')).toEqual([workouts[0]]);
    expect(days.get('2026-09-12')).toBeUndefined();
    expect(groupWorkoutsByDay([]).size).toBe(0);
  });
});
