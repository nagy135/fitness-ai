import { normalizeSetForTrackingType } from './normalization';
import type { TrackingType, WorkoutSet } from './types';

export const recordMetrics = ['weightKg', 'reps', 'durationSeconds', 'distanceMeters'] as const;
export type RecordMetric = (typeof recordMetrics)[number];
export interface ExerciseSession {
  workoutId: string;
  performedAt: number;
  sets: WorkoutSet[];
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
        if (value !== undefined && Number.isFinite(value) && (!best || value > best.set[metric]!)) {
          best = { metric, workoutId: session.workoutId, performedAt: session.performedAt, set };
        }
      }
    }
    return best ? [best] : [];
  });
  return { previous: ordered[0] ?? null, maximums };
}
