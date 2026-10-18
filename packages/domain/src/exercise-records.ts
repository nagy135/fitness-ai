import { normalizeSetForTrackingType } from './normalization';
import { calculateVolume } from './calculations';
import type { TrackingType, WorkoutSet } from './types';

export const recordMetrics = ['weightKg', 'reps', 'durationSeconds', 'distanceMeters'] as const;
export type RecordMetric = (typeof recordMetrics)[number];
export interface ExerciseSession {
  workoutId: string;
  performedAt: number;
  sets: WorkoutSet[];
}

export interface ExerciseRecordBaseline {
  volume: number | null;
  maxSet: { weightKg: number; reps: number } | null;
}

function weightedSets(sets: readonly WorkoutSet[], trackingType: TrackingType) {
  return sets
    .map((set) => normalizeSetForTrackingType(set, trackingType))
    .filter(
      (set): set is WorkoutSet & { weightKg: number; reps: number } =>
        set.weightKg !== undefined &&
        Number.isFinite(set.weightKg) &&
        set.weightKg > 0 &&
        set.reps !== undefined &&
        Number.isInteger(set.reps) &&
        set.reps > 0,
    );
}

// Weight takes priority; repetitions break ties at the same weight.
function betterMaxSet(
  set: { weightKg: number; reps?: number },
  best: { weightKg: number; reps?: number },
) {
  return (
    set.weightKg > best.weightKg ||
    (set.weightKg === best.weightKg && (set.reps ?? 0) > (best.reps ?? 0))
  );
}

/** Saved sessions only: each session's volume includes every row for the exercise. */
export function summarizeExerciseRecordBaseline(
  sessions: readonly ExerciseSession[],
  trackingType: TrackingType,
): ExerciseRecordBaseline {
  const baseline: ExerciseRecordBaseline = { volume: null, maxSet: null };
  for (const session of sessions) {
    const sets = weightedSets(session.sets, trackingType);
    if (!sets.length) continue;
    baseline.volume = Math.max(baseline.volume ?? 0, calculateVolume(sets));
    for (const set of sets) {
      if (!baseline.maxSet || betterMaxSet(set, baseline.maxSet)) {
        baseline.maxSet = { weightKg: set.weightKg, reps: set.reps };
      }
    }
  }
  return baseline;
}

/** Recompute from the current draft so removals and optimistic edits also update badges. */
export function exerciseRecordImprovements(
  sets: readonly WorkoutSet[],
  trackingType: TrackingType,
  baseline: ExerciseRecordBaseline,
) {
  const current = weightedSets(sets, trackingType);
  const volume = calculateVolume(current);
  const previousVolume = baseline.volume;
  const previousMaxSet = baseline.maxSet;
  // Different set orders can produce tiny floating-point differences in equal totals.
  const tolerance =
    Number.EPSILON * Math.max(volume, previousVolume ?? 0) * Math.max(1, current.length);
  return {
    volume: previousVolume !== null && volume - previousVolume > tolerance,
    maxSet: previousMaxSet !== null && current.some((set) => betterMaxSet(set, previousMaxSet)),
  };
}

/** Compare actual measurements, keeping the full set as context for each maximum. */
export function summarizeExerciseRecords(sessions: ExerciseSession[], trackingType: TrackingType) {
  const ordered = sessions
    .map((session) => ({
      ...session,
      sets: session.sets.map((set) => normalizeSetForTrackingType(set, trackingType)),
    }))
    .filter((session) => session.sets.length > 0)
    .sort((a, b) => b.performedAt - a.performedAt);
  const maximums = recordMetrics.flatMap((metric) => {
    let best:
      { metric: RecordMetric; workoutId: string; performedAt: number; set: WorkoutSet } | undefined;
    for (const session of ordered) {
      for (const set of session.sets) {
        const value = set[metric];
        if (value === undefined || !Number.isFinite(value)) continue;
        const improved =
          !best ||
          (metric === 'weightKg'
            ? betterMaxSet(
                { weightKg: value, reps: set.reps },
                { weightKg: best.set.weightKg!, reps: best.set.reps },
              )
            : value > best.set[metric]!);
        if (improved) {
          best = { metric, workoutId: session.workoutId, performedAt: session.performedAt, set };
        }
      }
    }
    return best ? [best] : [];
  });
  return { previous: ordered[0] ?? null, maximums };
}
