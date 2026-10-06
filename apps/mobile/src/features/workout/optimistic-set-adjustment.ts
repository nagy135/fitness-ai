import type { OptimisticLocalStore } from 'convex/browser';
import type { FunctionArgs } from 'convex/server';
import { api } from '@fitness/convex/api';
import { adjustSetMeasurement } from '@fitness/domain';

export function optimisticSetAdjustment(
  store: OptimisticLocalStore,
  args: FunctionArgs<typeof api.workoutDrafts.adjustSet>,
) {
  const draft = store.getQuery(api.workoutDrafts.current, {});
  if (!draft || draft._id !== args.draftId) return;
  const row = draft.exercises.find((row) => row.rowId === args.rowId);
  const set = row?.sets.find((set) => set.setId === args.setId);
  const next = set && adjustSetMeasurement(set, args.field, args.delta);
  if (next === undefined) return;
  store.setQuery(
    api.workoutDrafts.current,
    {},
    {
      ...draft,
      exercises: draft.exercises.map((row) =>
        row.rowId === args.rowId
          ? {
              ...row,
              sets: row.sets.map((set) =>
                set.setId === args.setId ? { ...set, [args.field]: next } : set,
              ),
            }
          : row,
      ),
    },
  );
}
