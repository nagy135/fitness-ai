import type { ToolCallRecord, WorkoutToolName } from '@fitness/ai';

// Classify every workout tool explicitly so newly added tools require a decision.
const autoOpenByTool = {
  getCurrentDraft: true,
  getRecentWorkouts: true,
  getWorkout: true,
  searchWorkouts: true,
  getExerciseRecords: true,
  getExerciseHistory: true,
  searchUserExercises: true,
  createUserExercise: false,
  updateUserExercise: false,
  addExercisesToDraft: false,
  removeExerciseFromDraft: false,
  updateSet: false,
  removeSet: false,
  updateExerciseNotes: false,
  reorderExercises: false,
} satisfies Record<WorkoutToolName, boolean>;

export function shouldAutoOpenWorkoutHistory(calls?: readonly ToolCallRecord[]): boolean {
  // A write attempt blocks opening even if it fails. Unknown/legacy tools also
  // stay closed rather than assuming they cannot change exercises.
  return calls?.every((call) => autoOpenByTool[call.toolName as WorkoutToolName] === true) ?? true;
}
