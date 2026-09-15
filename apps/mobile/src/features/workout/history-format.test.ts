import { describe, expect, it } from 'vitest';
import { formatSet, formatSetSummary } from './history-format';

describe('workout measurement summaries', () => {
  it('keeps reps visible for weighted sets', () => {
    expect(formatSet({ weightKg: 80, reps: 8 })).toBe('80 kg × 8 reps');
    expect(
      formatSetSummary([
        { weightKg: 80, reps: 8 },
        { weightKg: 80, reps: 6 },
      ]),
    ).toBe('8x80kg, 6x80kg');
  });
  it('preserves duration and distance together', () => {
    expect(formatSet({ durationSeconds: 300, distanceMeters: 1000 })).toBe('300 sec × 1000 m');
    expect(formatSet({ weightKg: 12.5, durationSeconds: 45 })).toBe('12.5 kg × 45 sec');
  });
  it('lists every set in training order, including repeated sets', () => {
    expect(formatSetSummary([{ reps: 8 }, { reps: 8 }, { reps: 6 }, { reps: 8 }])).toBe(
      '8 reps, 8 reps, 6 reps, 8 reps',
    );
  });
  it('handles empty and fractional values without hiding measurements', () => {
    expect(formatSetSummary([])).toBe('');
    expect(formatSet({ weightKg: 2.345, reps: 10 })).toBe('2.35 kg × 10 reps');
    expect(formatSet({})).toBe('No measurements');
  });
});
