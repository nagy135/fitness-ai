export const workoutToolNames = [
  'getCurrentDraft',
  'getRecentWorkouts',
  'getWorkout',
  'getExerciseHistory',
  'searchUserExercises',
  'createUserExercise',
  'updateUserExercise',
  'addExercisesToDraft',
  'removeExerciseFromDraft',
  'updateSet',
  'removeSet',
  'updateExerciseNotes',
  'reorderExercises',
] as const;

export const analysisToolNames = [
  'getRecentWorkouts',
  'getWorkout',
  'searchWorkouts',
  'getExerciseHistory',
  'getExerciseStats',
  'getPersonalRecords',
  'getWeeklyVolume',
  'getMonthlyVolume',
  'compareExercises',
  'getExerciseFrequency',
  'getTrainingDays',
  'searchExercises',
  'renderChart',
] as const;

export type WorkoutToolName = (typeof workoutToolNames)[number];
export type AnalysisToolName = (typeof analysisToolNames)[number];

export const capabilityMatrix = {
  workout: {
    readCurrentDraft: true,
    modifyCurrentDraft: true,
    readExerciseCatalog: true,
    createExercise: true,
    modifyConfirmedHistory: false,
    confirmWorkout: false,
  },
  analysis: {
    readCurrentDraft: false,
    modifyCurrentDraft: false,
    readExerciseCatalog: true,
    createExercise: false,
    modifyConfirmedHistory: false,
    confirmWorkout: false,
  },
} as const;
