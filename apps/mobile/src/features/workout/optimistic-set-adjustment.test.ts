import { expect, it } from 'vitest';
import type { OptimisticLocalStore } from 'convex/browser';
import type { FunctionReturnType } from 'convex/server';
import type { Id } from '@fitness/convex/data-model';
import { api } from '@fitness/convex/api';
import { optimisticSetAdjustment } from './optimistic-set-adjustment';

const draftId = 'draft' as Id<'workoutDrafts'>;
const args = { draftId, rowId: 'bench', setId: 'set', field: 'reps' as const, delta: 1 };
const initial = {
  _id: draftId,
  exercises: [
    { rowId: 'bench', sets: [{ setId: 'set', reps: 8, weightKg: 80 }] },
    { rowId: 'squat', sets: [{ setId: 'other', reps: 5, weightKg: 100 }] },
  ],
} as FunctionReturnType<typeof api.workoutDrafts.current>;

it('immediately accumulates five taps before a response and leaves cached server objects unchanged', () => {
  let draft = initial;
  const store = {
    getQuery: () => draft,
    setQuery: (_query: unknown, _args: unknown, value: typeof draft) => {
      draft = value;
    },
  } as unknown as OptimisticLocalStore;
  for (let tap = 0; tap < 5; tap++) optimisticSetAdjustment(store, args);
  optimisticSetAdjustment(store, { ...args, field: 'weightKg', delta: 5 });
  expect(draft!.exercises[0].sets[0]).toEqual({ setId: 'set', reps: 13, weightKg: 85 });
  expect(initial!.exercises[0].sets[0].reps).toBe(8);
  expect(draft!.exercises[1]).toBe(initial!.exercises[1]);
  // Convex replays remaining adjustments on the confirmed server result.
  draft = {
    ...initial!,
    exercises: [{ ...initial!.exercises[0], sets: [{ setId: 'set', reps: 10, weightKg: 80 }] }],
  };
  for (let remaining = 0; remaining < 3; remaining++) optimisticSetAdjustment(store, args);
  expect(draft.exercises[0].sets[0].reps).toBe(13);
});

it('does not modify a different draft, missing set or an invalid decrement', () => {
  let draft = initial;
  const store = {
    getQuery: () => draft,
    setQuery: (_query: unknown, _args: unknown, value: typeof draft) => {
      draft = value;
    },
  } as unknown as OptimisticLocalStore;
  optimisticSetAdjustment(store, { ...args, draftId: 'other' as Id<'workoutDrafts'> });
  optimisticSetAdjustment(store, { ...args, setId: 'missing' });
  optimisticSetAdjustment(store, { ...args, delta: -8 });
  expect(draft).toBe(initial);
});
