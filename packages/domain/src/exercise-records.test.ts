import { describe, expect, it } from 'vitest';
import {
  exerciseRecordImprovements,
  summarizeExerciseRecordBaseline,
  summarizeExerciseRecords,
} from './exercise-records';

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

  it('shows the same all-time best set used by PR badges, breaking weight ties by reps', () => {
    const sessions = [
      { workoutId: 'recent', performedAt: 3, sets: [{ weightKg: 89, reps: 9 }] },
      { workoutId: 'best', performedAt: 2, sets: [{ weightKg: 89, reps: 11 }] },
      { workoutId: 'older-tie', performedAt: 1, sets: [{ weightKg: 89, reps: 11 }] },
    ];
    const records = summarizeExerciseRecords(sessions, 'weight_reps');
    const baseline = summarizeExerciseRecordBaseline(sessions, 'weight_reps');
    expect(records.previous).toEqual(sessions[0]);
    expect(records.maximums.find((record) => record.metric === 'weightKg')).toEqual({
      metric: 'weightKg',
      workoutId: 'best',
      performedAt: 2,
      set: baseline.maxSet,
    });
    expect(baseline.maxSet).toEqual({ weightKg: 89, reps: 11 });
    expect(
      exerciseRecordImprovements([{ weightKg: 89, reps: 10 }], 'weight_reps', baseline).maxSet,
    ).toBe(false);
    expect(
      exerciseRecordImprovements([{ weightKg: 89, reps: 12 }], 'weight_reps', baseline).maxSet,
    ).toBe(true);
    expect(
      exerciseRecordImprovements([{ weightKg: 90, reps: 1 }], 'weight_reps', baseline).maxSet,
    ).toBe(true);
    expect(
      exerciseRecordImprovements([{ weightKg: 88, reps: 30 }], 'weight_reps', baseline).maxSet,
    ).toBe(false);
  });

  it('breaks equal-weight ties within one workout by reps, while higher weights still win', () => {
    const session = {
      workoutId: 'saved',
      performedAt: 1,
      sets: [
        { weightKg: 89, reps: 9 },
        { weightKg: 89, reps: 11 },
        { weightKg: 88, reps: 30 },
      ],
    };
    expect(summarizeExerciseRecords([session], 'weight_reps').maximums[0].set).toEqual({
      weightKg: 89,
      reps: 11,
    });
    expect(
      summarizeExerciseRecords(
        [{ ...session, sets: [...session.sets, { weightKg: 90, reps: 1 }] }],
        'weight_reps',
      ).maximums[0].set,
    ).toEqual({ weightKg: 90, reps: 1 });
  });
});

describe('live exercise records', () => {
  const baseline = { volume: 1000, maxSet: { weightKg: 100, reps: 5 } };

  it('awards both badges for the screenshot example when 89 kg × 9 is the saved best', () => {
    const baseline = summarizeExerciseRecordBaseline(
      [
        {
          workoutId: 'saved',
          performedAt: 1,
          sets: [
            { weightKg: 54, reps: 10 },
            { weightKg: 89, reps: 9 },
            { weightKg: 75, reps: 7 },
          ],
        },
      ],
      'weight_reps',
    );
    expect(baseline).toEqual({ volume: 1866, maxSet: { weightKg: 89, reps: 9 } });
    expect(
      exerciseRecordImprovements([{ weightKg: 89, reps: 10 }], 'weight_reps', baseline),
    ).toEqual({ volume: false, maxSet: true });
    expect(
      exerciseRecordImprovements(
        [
          { weightKg: 47, reps: 10 },
          { weightKg: 89, reps: 10 },
          { weightKg: 75, reps: 10 },
        ],
        'weight_reps',
        baseline,
      ),
    ).toEqual({ volume: true, maxSet: true });
    expect(
      exerciseRecordImprovements([{ weightKg: 89, reps: 9 }], 'weight_reps', baseline).maxSet,
    ).toBe(false);
  });

  it('finds the best session volume and selects reps from the heaviest set', () => {
    expect(
      summarizeExerciseRecordBaseline(
        [
          { workoutId: 'older', performedAt: 1, sets: [{ weightKg: 100, reps: 5 }] },
          {
            workoutId: 'latest',
            performedAt: 2,
            sets: [
              { weightKg: 80, reps: 10 },
              { weightKg: 80, reps: 10 },
            ],
          },
          {
            workoutId: 'tie',
            performedAt: 0,
            sets: [
              { weightKg: 100, reps: 6 },
              { weightKg: 90, reps: 20 },
            ],
          },
        ],
        'weight_reps',
      ),
    ).toEqual({ volume: 2400, maxSet: { weightKg: 100, reps: 6 } });
  });

  it.each([
    [
      'heavier weight with fewer reps',
      [{ weightKg: 101, reps: 1 }],
      { volume: false, maxSet: true },
    ],
    ['more reps at the best weight', [{ weightKg: 100, reps: 6 }], { volume: false, maxSet: true }],
    ['more reps at a lower weight', [{ weightKg: 90, reps: 20 }], { volume: true, maxSet: false }],
    [
      'volume across all sets',
      [
        { weightKg: 80, reps: 7 },
        { weightKg: 80, reps: 7 },
      ],
      { volume: true, maxSet: false },
    ],
    ['both records', [{ weightKg: 110, reps: 10 }], { volume: true, maxSet: true }],
    [
      'exact ties',
      [
        { weightKg: 100, reps: 5 },
        { weightKg: 100, reps: 5 },
      ],
      { volume: false, maxSet: false },
    ],
    ['no logged sets', [], { volume: false, maxSet: false }],
  ])('%s', (_name, sets, expected) => {
    expect(exerciseRecordImprovements(sets, 'weight_reps', baseline)).toEqual(expected);
  });

  it('requires a previous weighted record and complete, valid measurements', () => {
    const noHistory = summarizeExerciseRecordBaseline([], 'weight_reps');
    expect(noHistory).toEqual({ volume: null, maxSet: null });
    expect(
      exerciseRecordImprovements([{ weightKg: 200, reps: 10 }], 'weight_reps', noHistory),
    ).toEqual({ volume: false, maxSet: false });
    const invalid = [
      { weightKg: 200 },
      { reps: 30 },
      { weightKg: Infinity, reps: 2 },
      { weightKg: 300, reps: -1 },
    ];
    expect(
      summarizeExerciseRecordBaseline(
        [{ workoutId: 'old', performedAt: 1, sets: invalid }],
        'weight_reps',
      ),
    ).toEqual(noHistory);
    expect(exerciseRecordImprovements(invalid, 'weight_reps', baseline)).toEqual({
      volume: false,
      maxSet: false,
    });
  });

  it.each(['reps', 'duration', 'distance', 'weight_duration'] as const)(
    'normalizes %s so leftover weighted measurements cannot produce strength badges',
    (trackingType) => {
      const sets = [{ weightKg: 200, reps: 30, durationSeconds: 60, distanceMeters: 100 }];
      expect(exerciseRecordImprovements(sets, trackingType, baseline)).toEqual({
        volume: false,
        maxSet: false,
      });
      expect(
        summarizeExerciseRecordBaseline([{ workoutId: 'old', performedAt: 1, sets }], trackingType),
      ).toEqual({ volume: null, maxSet: null });
    },
  );

  it('supports custom weighted exercises and avoids floating-point volume ties', () => {
    expect(exerciseRecordImprovements([{ weightKg: 101, reps: 10 }], 'custom', baseline)).toEqual({
      volume: true,
      maxSet: true,
    });
    expect(
      exerciseRecordImprovements(
        [
          { weightKg: 0.1, reps: 1 },
          { weightKg: 0.2, reps: 1 },
        ],
        'weight_reps',
        { volume: 0.3, maxSet: null },
      ).volume,
    ).toBe(false);
  });
});
