import { beforeEach, expect, it, vi } from 'vitest';
import type { QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { requireUserProfile } from './lib/auth';
import { currentForUser } from './workoutDrafts';
import { getExerciseRecords } from './analysis';

vi.mock('./lib/auth', () => ({ requireUserProfile: vi.fn() }));
vi.mock('./workoutDrafts', () => ({ currentForUser: vi.fn() }));
const run = (
  getExerciseRecords as unknown as {
    _handler: (
      ctx: QueryCtx,
      args: { exerciseId: Id<'exercises'> },
    ) => Promise<{
      previous: { workoutId: string; sets: unknown[] } | null;
      maximums: { set: { weightKg?: number } }[];
    }>;
  }
)._handler;
const exerciseId = 'bench' as Id<'exercises'>;
const db = { get: vi.fn(), query: vi.fn() };
const ctx = { db } as unknown as QueryCtx;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireUserProfile).mockResolvedValue({ _id: 'owner' } as never);
  vi.mocked(currentForUser).mockResolvedValue({ editingWorkoutId: 'editing' } as never);
  db.get.mockResolvedValue({ userId: 'owner', trackingType: 'weight_reps' });
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
