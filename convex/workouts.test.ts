import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { requireUserProfile } from './lib/auth';
import { confirmDraft, namingContext, remove } from './workouts';

vi.mock('./lib/auth', () => ({ requireUserProfile: vi.fn() }));

// Convex exposes handlers at runtime for tests, but omits them from its public declarations.
const removeHandler = (
  remove as unknown as {
    _handler: (ctx: MutationCtx, args: { workoutId: Id<'workouts'> }) => Promise<void>;
  }
)._handler;
const confirmHandler = (
  confirmDraft as unknown as {
    _handler: (ctx: MutationCtx, args: { draftId: Id<'workoutDrafts'> }) => Promise<Id<'workouts'>>;
  }
)._handler;

const workoutId = 'workout-1' as Id<'workouts'>;
const draftId = 'draft-1' as Id<'workoutDrafts'>;
const userId = 'user-1' as Id<'userProfiles'>;
const db = { get: vi.fn(), delete: vi.fn(), query: vi.fn(), insert: vi.fn() };
const ctx = { db } as unknown as MutationCtx;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireUserProfile).mockResolvedValue({
    _id: userId,
    _creationTime: 0,
    authUserId: 'auth-user-1',
    units: 'metric',
    createdAt: 0,
  });
});

describe('workout naming context', () => {
  const contextHandler = (
    namingContext as unknown as {
      _handler: (
        ctx: MutationCtx,
        args: { draftId: Id<'workoutDrafts'> },
      ) => Promise<{
        exercises: string[];
        previousWorkouts: { name: string; exercises: string[] }[];
      }>;
    }
  )._handler;

  function setup(editing = false) {
    const recent = Array.from({ length: 7 }, (_, index) => ({
      _id: index === 0 ? workoutId : `workout-${index + 1}`,
      name: index === 0 || index === 6 ? 'Push' : undefined,
      exercises: [{ nameSnapshot: `Exercise ${index}` }],
    }));
    const eq = vi.fn().mockReturnThis();
    const take = vi.fn(async (limit: number) => recent.slice(0, limit));
    const order = vi.fn().mockReturnValue({ take });
    db.query.mockImplementation((table: string) => ({
      withIndex: (_index: string, build: (q: unknown) => unknown) => {
        build({ eq });
        return table === 'workoutDrafts'
          ? {
              collect: async () => [
                {
                  _id: draftId,
                  status: 'active',
                  editingWorkoutId: editing ? workoutId : undefined,
                  exercises: [{ name: 'Push-ups' }],
                },
              ],
            }
          : { order };
      },
    }));
    return { eq, take, order };
  }

  it('reads exactly the last five workouts, including unnamed ones, scoped to the authenticated user', async () => {
    const { eq, take, order } = setup();
    const result = await contextHandler(ctx, { draftId });
    expect(requireUserProfile).toHaveBeenCalledWith(ctx);
    expect(eq.mock.calls.every(([field, value]) => field === 'userId' && value === userId)).toBe(
      true,
    );
    expect(order).toHaveBeenCalledWith('desc');
    expect(take).toHaveBeenCalledWith(5);
    expect(result.exercises).toEqual(['Push-ups']);
    expect(result.previousWorkouts).toHaveLength(5);
    expect(result.previousWorkouts.map(({ name }) => name)).toEqual(['Push', '', '', '', '']);
    expect(result.previousWorkouts[0].exercises).toEqual(['Exercise 0']);
  });

  it('excludes the workout being edited without reaching beyond five other sessions', async () => {
    const { take } = setup(true);
    const result = await contextHandler(ctx, { draftId });
    expect(take).toHaveBeenCalledWith(6);
    expect(result.previousWorkouts).toHaveLength(5);
    expect(result.previousWorkouts.every(({ name }) => name === '')).toBe(true);
  });

  it('rejects foreign or stale draft IDs before reading history', async () => {
    setup();
    await expect(
      contextHandler(ctx, { draftId: 'foreign' as Id<'workoutDrafts'> }),
    ).rejects.toThrow('Workout draft not found');
    expect(db.query).not.toHaveBeenCalledWith('workouts');
  });
});

describe('delete confirmed workout', () => {
  it('deletes only the authenticated owner’s selected workout', async () => {
    db.get.mockResolvedValue({ _id: workoutId, userId, sourceDraftId: draftId });
    await removeHandler(ctx, { workoutId });
    expect(requireUserProfile).toHaveBeenCalledWith(ctx);
    expect(db.get).toHaveBeenCalledWith(workoutId);
    expect(db.delete).toHaveBeenCalledExactlyOnceWith(workoutId);
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });

  it.each([null, { _id: workoutId, userId: 'another-user' }])(
    'rejects missing or foreign workouts without deleting anything: %j',
    async (workout) => {
      db.get.mockResolvedValue(workout);
      await expect(removeHandler(ctx, { workoutId })).rejects.toThrow('Workout not found');
      expect(db.delete).not.toHaveBeenCalled();
    },
  );

  it('requires authentication before reading or deleting a workout', async () => {
    vi.mocked(requireUserProfile).mockRejectedValue(new Error('Unauthenticated'));
    await expect(removeHandler(ctx, { workoutId })).rejects.toThrow('Unauthenticated');
    expect(db.get).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it('preserves the receipt so a late confirmation retry cannot recreate a deleted workout', async () => {
    db.get.mockResolvedValue({ _id: workoutId, userId, sourceDraftId: draftId });
    await removeHandler(ctx, { workoutId });
    db.get.mockResolvedValue(null);
    db.query.mockReturnValue({
      withIndex: () => ({ unique: async () => ({ workoutId }) }),
    });
    expect(await confirmHandler(ctx, { draftId })).toBe(workoutId);
    expect(db.delete).toHaveBeenCalledExactlyOnceWith(workoutId);
    expect(db.insert).not.toHaveBeenCalled();
  });
});
