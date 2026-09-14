import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { requireUserProfile } from './lib/auth';
import { confirmDraft, remove } from './workouts';

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
