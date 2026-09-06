import { describe, expect, it } from 'vitest';
import { validateExerciseOrder, validateTrackedSet } from './draftValidation';

describe('draft validation', () => {
  it('accepts a permutation and empty orders', () => {
    expect(() => validateExerciseOrder(['a', 'b'], ['b', 'a'])).not.toThrow();
    expect(() => validateExerciseOrder([], [])).not.toThrow();
  });
  it('rejects an order containing every row plus a duplicate', () => {
    expect(() => validateExerciseOrder(['a', 'b'], ['a', 'b', 'a'])).toThrow('every row once');
  });
  it('rejects missing, repeated, and unknown rows', () => {
    for (const order of [['a'], ['a', 'a'], ['a', 'c']]) {
      expect(() => validateExerciseOrder(['a', 'b'], order)).toThrow();
    }
  });
  it('rejects non-finite effort values', () => {
    for (const field of ['rir', 'rpe']) {
      for (const value of [NaN, Infinity, -Infinity]) {
        expect(() => validateTrackedSet({ reps: 8, [field]: value })).toThrow();
      }
    }
  });
  it('retains positive measurement validation and valid effort bounds', () => {
    expect(() => validateTrackedSet({ reps: 8, rir: 0, rpe: 10 })).not.toThrow();
    expect(() => validateTrackedSet({ durationSeconds: 45 })).not.toThrow();
    for (const set of [
      {},
      { reps: 1.5 },
      { weightKg: 0 },
      { distanceMeters: -1 },
      { durationSeconds: NaN },
    ]) {
      expect(() => validateTrackedSet(set)).toThrow();
    }
  });
});
