import { describe, expect, it } from 'vitest';
import {
  AddExercisesToDraftInputSchema,
  RenderChartSchema,
  analysisToolNames,
  capabilityMatrix,
  workoutToolNames,
} from './index';

describe('AI capability boundary', () => {
  it('does not expose workout confirmation or arbitrary database access', () => {
    expect(workoutToolNames).not.toContain('confirmWorkout');
    expect([...workoutToolNames, ...analysisToolNames]).not.toContain('executeConvexQuery');
    expect(capabilityMatrix.workout.modifyConfirmedHistory).toBe(false);
    expect(capabilityMatrix.analysis.modifyCurrentDraft).toBe(false);
  });

  it('rejects user identity and invalid set values at the tool boundary', () => {
    expect(() =>
      AddExercisesToDraftInputSchema.parse({
        userId: 'attacker-selected-user',
        exercises: [{ exerciseId: 'exercise', sets: [{ weightKg: -10, reps: 0 }] }],
      }),
    ).toThrow();
  });

  it('accepts one ordered batch of complete exercises and rejects duplicates', () => {
    const input = {
      exercises: [
        { exerciseId: 'bench', sets: [{ weightKg: 80, reps: 8 }] },
        { exerciseId: 'squat', sets: [{ weightKg: 100, reps: 5 }] },
      ],
    };
    expect(AddExercisesToDraftInputSchema.parse(input)).toEqual(input);
    expect(() =>
      AddExercisesToDraftInputSchema.parse({
        exercises: [
          { exerciseId: 'bench', sets: [] },
          { exerciseId: 'bench', sets: [] },
        ],
      }),
    ).toThrow();
    expect(workoutToolNames).toContain('addExercisesToDraft');
    expect(workoutToolNames).not.toContain('addExerciseToDraft');
    expect(workoutToolNames).not.toContain('addSet');
  });

  it('accepts general multi-series 2D charts and rejects non-finite data', () => {
    expect(
      RenderChartSchema.parse({
        type: 'line',
        title: 'Bench press vs squat',
        xAxis: { label: 'Date', scale: 'time' },
        yAxis: { label: 'Estimated 1RM', unit: 'kg' },
        series: [
          { name: 'Bench press', points: [{ x: '2026-08-29', y: 160 }] },
          { name: 'Squat', points: [{ x: '2026-08-29', y: 200 }] },
        ],
      }).series,
    ).toHaveLength(2);
    expect(() =>
      RenderChartSchema.parse({
        type: 'scatter',
        title: 'Invalid chart',
        xAxis: { label: 'Reps', scale: 'linear' },
        yAxis: { label: 'Weight' },
        series: [{ name: 'Sets', points: [{ x: 5, y: Number.NaN }] }],
      }),
    ).toThrow();
  });
});
