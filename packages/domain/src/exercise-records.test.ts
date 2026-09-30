import { describe, expect, it } from 'vitest';
import { summarizeExerciseRecords } from './exercise-records';

describe('exercise records', () => {
  const sessions = [
    {
      workoutId: 'latest',
      performedAt: 30,
      sets: [
        { weightKg: 80, reps: 8 },
        { weightKg: 70, reps: 12 },
      ],
    },
    { workoutId: 'old', performedAt: 10, sets: [{ weightKg: 100, reps: 3 }] },
    { workoutId: 'empty', performedAt: 40, sets: [] },
  ];
  it('returns every previous set in order and maximums with their actual reps and date', () => {
    const result = summarizeExerciseRecords(sessions, 'weight_reps');
    expect(result.previous).toEqual(sessions[0]);
    expect(result.maximums).toEqual([
      { metric: 'weightKg', workoutId: 'old', performedAt: 10, set: { weightKg: 100, reps: 3 } },
      { metric: 'reps', workoutId: 'latest', performedAt: 30, set: { weightKg: 70, reps: 12 } },
    ]);
  });
  it('does not invent records for missing measurements or no history', () => {
    expect(summarizeExerciseRecords([], 'reps')).toEqual({ previous: null, maximums: [] });
    expect(summarizeExerciseRecords(sessions, 'duration').maximums).toEqual([]);
  });
  it('normalizes tracking types and retains the latest tied maximum', () => {
    const result = summarizeExerciseRecords(
      [{ workoutId: 'old', performedAt: 10, sets: [{ reps: 12, weightKg: 200 }] }, ...sessions],
      'reps',
    );
    expect(result.maximums).toEqual([
      { metric: 'reps', workoutId: 'latest', performedAt: 30, set: { reps: 12 } },
    ]);
    expect(result.previous?.sets).toEqual([{ reps: 8 }, { reps: 12 }]);
  });
  it('supports duration and distance records without strength measurements', () => {
    const result = summarizeExerciseRecords(
      [
        {
          workoutId: 'run',
          performedAt: 10,
          sets: [{ durationSeconds: 600, distanceMeters: 2000 }],
        },
      ],
      'distance',
    );
    expect(result.maximums.map((record) => record.metric)).toEqual([
      'durationSeconds',
      'distanceMeters',
    ]);
  });
});
