import { expect, it } from 'vitest';
import { adjustSetMeasurement } from './set-adjustment';

it('accumulates decimal weights without floating point drift', () => {
  let weightKg = 20;
  for (let tap = 0; tap < 5; tap++) {
    weightKg = adjustSetMeasurement({ weightKg }, 'weightKg', 0.1)!;
  }
  expect(weightKg).toBe(20.5);
});

it('rejects missing measurements, nonpositive results, fractional reps and invalid increments', () => {
  expect(adjustSetMeasurement({}, 'weightKg', 1)).toBeUndefined();
  expect(adjustSetMeasurement({ reps: 1 }, 'reps', -1)).toBeUndefined();
  expect(adjustSetMeasurement({ reps: 8 }, 'reps', 0.5)).toBeUndefined();
  expect(adjustSetMeasurement({ weightKg: 5 }, 'weightKg', -10)).toBeUndefined();
  for (const delta of [NaN, Infinity, -Infinity, 0]) {
    expect(adjustSetMeasurement({ weightKg: 80 }, 'weightKg', delta)).toBeUndefined();
  }
});
