import { describe, expect, it } from 'vitest';
import {
  calculateTrainingFrequency,
  calculateVolume,
  estimate1RM,
  exerciseMatchScore,
  normalizeExerciseName,
  normalizeWeight,
} from './index';

describe('domain calculations', () => {
  it('calculates only weight/repetition volume', () => {
    expect(calculateVolume([{ weightKg: 80, reps: 8 }, { weightKg: 85, reps: 6 }, {}])).toBe(1150);
  });

  it('estimates one rep max with Epley', () => {
    expect(estimate1RM(100, 6)).toBeCloseTo(120);
    expect(estimate1RM(100, 1)).toBe(100);
  });

  it('converts weight without accumulating excessive precision', () => {
    expect(normalizeWeight(100, 'lb', 'kg')).toBe(45.36);
  });

  it('normalizes exercise variants', () => {
    expect(normalizeExerciseName(' Romanian-Deadlifts ')).toBe('romanian deadlift');
    expect(exerciseMatchScore('bench', { name: 'Barbell Bench Press', aliases: ['Bench'] })).toBe(90);
  });

  it('counts unique training days per week', () => {
    const from = Date.UTC(2026, 0, 1);
    const to = Date.UTC(2026, 0, 14);
    expect(calculateTrainingFrequency([{ performedAt: from }, { performedAt: from }], from, to)).toBe(0.5);
  });
});
