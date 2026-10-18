import { beforeEach, expect, it, vi } from 'vitest';
import type { QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { exerciseRecordImprovements, type ExerciseRecordBaseline } from '@fitness/domain';
import { requireUserProfile } from './lib/auth';
import { currentForUser } from './workoutDrafts';
import { getExerciseRecordBaselines, getExerciseRecords } from './analysis';

vi.mock('./lib/auth', () => ({ requireUserProfile: vi.fn() }));
vi.mock('./workoutDrafts', () => ({ currentForUser: vi.fn() }));
const run = (
  getExerciseRecords as unknown as {
    _handler: (
      ctx: QueryCtx,
      args: { exerciseId: Id<'exercises'> },
    ) => Promise<{
      previous: { workoutId: string; sets: unknown[] } | null;
      maximums: { metric: string; workoutId: string; set: { weightKg?: number; reps?: number } }[];
    }>;
  }
)._handler;
const runBaselines = (
  getExerciseRecordBaselines as unknown as {
    _handler: (
      ctx: QueryCtx,
      args: { exerciseIds: Id<'exercises'>[] },
    ) => Promise<Array<ExerciseRecordBaseline & { exerciseId: string }>>;
  }
)._handler;
const exerciseId = 'bench' as Id<'exercises'>;
const db = { get: vi.fn(), query: vi.fn() };
const ctx = { db } as unknown as QueryCtx;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireUserProfile).mockResolvedValue({ _id: 'owner' } as never);
  vi.mocked(currentForUser).mockResolvedValue({ editingWorkoutId: 'editing' } as never);
  db.get.mockResolvedValue({ _id: exerciseId, userId: 'owner', trackingType: 'weight_reps' });
});
it('scopes history to the owner, excludes the editing source from previous but includes it in maximums, and joins all matching rows', async () => {
  const eq = vi.fn().mockReturnThis();
  const chain = { eq, gte: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis() };
  db.query.mockReturnValue({
    withIndex: (_name: string, build: (q: unknown) => unknown) => {
      build(chain);
      return {
        collect: async () => [
          {
            _id: 'editing',
            performedAt: 30,
            exercises: [{ exerciseId, sets: [{ weightKg: 500, reps: 1 }] }],
          },
          {
            _id: 'saved',
            performedAt: 20,
            exercises: [
              { exerciseId, sets: [{ weightKg: 80, reps: 8 }] },
              { exerciseId: 'other', sets: [{ weightKg: 999, reps: 2 }] },
              { exerciseId, sets: [{ weightKg: 70, reps: 10 }] },
            ],
          },
        ],
      };
    },
  });
  const result = await run(ctx, { exerciseId });
  expect(eq).toHaveBeenCalledWith('userId', 'owner');
  expect(result.previous).toMatchObject({
    workoutId: 'saved',
    sets: [
      { weightKg: 80, reps: 8 },
      { weightKg: 70, reps: 10 },
    ],
  });
  expect(result.maximums[0].set.weightKg).toBe(500);
});
it('rejects foreign exercises before reading workouts', async () => {
  db.get.mockResolvedValue({ userId: 'someone-else' });
  await expect(run(ctx, { exerciseId })).rejects.toThrow('Exercise not found');
  expect(db.query).not.toHaveBeenCalled();
});

it('loads all-time baselines in one owner-scoped query, merges rows and excludes the editing source', async () => {
  const otherId = 'squat' as Id<'exercises'>;
  db.get.mockImplementation(async (id) => ({
    _id: id,
    userId: 'owner',
    trackingType: 'weight_reps',
  }));
  const chain = {
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
  };
  db.query.mockReturnValue({
    withIndex: (name: string, build: (q: unknown) => unknown) => {
      expect(name).toBe('by_user_performed');
      build(chain);
      return {
        collect: async () => [
          {
            _id: 'editing',
            performedAt: 30,
            exercises: [{ exerciseId, sets: [{ weightKg: 500, reps: 100 }] }],
          },
          // The record can be older than the 50 workouts shown in history.
          {
            _id: 'old',
            performedAt: 1,
            exercises: [
              { exerciseId, sets: [{ weightKg: 80, reps: 8 }] },
              { exerciseId: otherId, sets: [{ weightKg: 200, reps: 5 }] },
              { exerciseId, sets: [{ weightKg: 70, reps: 10 }] },
            ],
          },
          ...Array.from({ length: 51 }, (_, index) => ({
            _id: `newer-${index}`,
            performedAt: index + 2,
            exercises: [{ exerciseId, sets: [{ weightKg: 80, reps: 6 }] }],
          })),
        ],
      };
    },
  });
  const result = await runBaselines(ctx, { exerciseIds: [exerciseId, otherId, exerciseId] });
  expect(chain.eq).toHaveBeenCalledWith('userId', 'owner');
  expect(db.get).toHaveBeenCalledTimes(2);
  expect(db.query).toHaveBeenCalledTimes(1);
  expect(result).toEqual([
    { exerciseId, trackingType: 'weight_reps', volume: 1340, maxSet: { weightKg: 80, reps: 8 } },
    {
      exerciseId: otherId,
      trackingType: 'weight_reps',
      volume: 1000,
      maxSet: { weightKg: 200, reps: 5 },
    },
  ]);
});

it('returns no baseline for a first session and rejects foreign exercises before loading history', async () => {
  db.query.mockReturnValue({ withIndex: () => ({ collect: async () => [] }) });
  expect(await runBaselines(ctx, { exerciseIds: [exerciseId] })).toEqual([
    { exerciseId, trackingType: 'weight_reps', volume: null, maxSet: null },
  ]);
  db.query.mockClear();
  db.get.mockResolvedValue({ userId: 'someone-else' });
  await expect(runBaselines(ctx, { exerciseIds: [exerciseId] })).rejects.toThrow(
    'Exercise not found',
  );
  expect(db.query).not.toHaveBeenCalled();
});

it('uses the same best set for displayed records and badges, and sums every matching row per workout for volume', async () => {
  const workouts = [
    {
      _id: 'recent',
      performedAt: 3,
      exercises: [
        {
          exerciseId,
          sets: [
            { weightKg: 54, reps: 10 },
            { weightKg: 89, reps: 9 },
          ],
        },
        { exerciseId: 'other', sets: [{ weightKg: 999, reps: 100 }] },
        { exerciseId, sets: [{ weightKg: 75, reps: 7 }] },
      ],
    },
    {
      _id: 'best',
      performedAt: 2,
      exercises: [{ exerciseId, sets: [{ weightKg: 89, reps: 11 }] }],
    },
    {
      _id: 'old-tie',
      performedAt: 1,
      exercises: [{ exerciseId, sets: [{ weightKg: 89, reps: 11 }] }],
    },
  ];
  db.query.mockReturnValue({ withIndex: () => ({ collect: async () => workouts }) });
  const records = await run(ctx, { exerciseId });
  const [baseline] = await runBaselines(ctx, { exerciseIds: [exerciseId] });
  expect(records.previous?.workoutId).toBe('recent');
  expect(records.previous?.sets).toHaveLength(3);
  expect(records.maximums.find((record) => record.metric === 'weightKg')).toMatchObject({
    workoutId: 'best',
    set: baseline.maxSet,
  });
  expect(baseline).toMatchObject({ volume: 1866, maxSet: { weightKg: 89, reps: 11 } });
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
  ).toEqual({ volume: true, maxSet: false });
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
