export const trackingTypes = [
  'weight_reps',
  'reps',
  'duration',
  'distance',
  'weight_duration',
  'custom',
] as const;

export type TrackingType = (typeof trackingTypes)[number];

export interface WorkoutSet {
  setId?: string;
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  rir?: number;
  rpe?: number;
  notes?: string;
}

export interface WorkoutExercise<TExerciseId = string> {
  rowId?: string;
  exerciseId?: TExerciseId;
  name: string;
  notes?: string;
  sets: WorkoutSet[];
}

export interface WorkoutDraft<TExerciseId = string> {
  date: string;
  status: 'active' | 'confirming';
  exercises: WorkoutExercise<TExerciseId>[];
  notes?: string;
}

export interface ConfirmedWorkout<TExerciseId = string> {
  performedAt: number;
  exercises: Array<{
    exerciseId: TExerciseId;
    nameSnapshot: string;
    sets: WorkoutSet[];
  }>;
  notes?: string;
}

export interface Exercise<TId = string> {
  id: TId;
  name: string;
  aliases: string[];
  description?: string;
  muscleGroups?: string[];
  equipment?: string[];
  trackingType: TrackingType;
}
