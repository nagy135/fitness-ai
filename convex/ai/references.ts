import { makeFunctionReference } from 'convex/server';
import type { AnalysisChart } from '@fitness/ai';
import type { Doc, Id } from '../_generated/dataModel';

type Empty = Record<string, never>;
type DateRange = { from?: string; to?: string };
type TrackedSet = {
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  rir?: number;
  rpe?: number;
  notes?: string;
};
type TrackingType = 'weight_reps' | 'reps' | 'duration' | 'distance' | 'weight_duration' | 'custom';
type Source = 'user_ui' | 'ai';

export const refs = {
  profileCurrent: makeFunctionReference<'query', Empty, Doc<'userProfiles'>>(
    'userProfiles:current',
  ),
  exercisesList: makeFunctionReference<'query', { includeArchived?: boolean }, Doc<'exercises'>[]>(
    'exercises:list',
  ),
  exercisesSearch: makeFunctionReference<'query', { query: string; limit?: number }, unknown>(
    'exercises:search',
  ),
  exerciseCreate: makeFunctionReference<
    'mutation',
    {
      name: string;
      aliases: string[];
      description?: string;
      muscleGroups?: string[];
      equipment?: string[];
      trackingType: TrackingType;
    },
    Id<'exercises'>
  >('exercises:create'),
  exerciseUpdate: makeFunctionReference<
    'mutation',
    {
      exerciseId: Id<'exercises'>;
      name?: string;
      aliases?: string[];
      description?: string;
      muscleGroups?: string[];
      equipment?: string[];
      trackingType?: TrackingType;
    },
    null
  >('exercises:update'),
  draftCurrent: makeFunctionReference<'query', Empty, Doc<'workoutDrafts'> | null>(
    'workoutDrafts:current',
  ),
  draftAddExercises: makeFunctionReference<
    'mutation',
    {
      exercises: { exerciseId: Id<'exercises'>; notes?: string; sets: TrackedSet[] }[];
      source: Source;
      requestId?: Id<'workoutRequests'>;
    },
    string[]
  >('workoutDrafts:addExercises'),
  draftRemoveExercise: makeFunctionReference<
    'mutation',
    { rowId: string; source: Source; requestId?: Id<'workoutRequests'> },
    null
  >('workoutDrafts:removeExercise'),
  draftUpdateSet: makeFunctionReference<
    'mutation',
    {
      rowId: string;
      setId: string;
      patch: TrackedSet;
      source: Source;
      requestId?: Id<'workoutRequests'>;
    },
    null
  >('workoutDrafts:updateSet'),
  draftRemoveSet: makeFunctionReference<
    'mutation',
    { rowId: string; setId: string; source: Source; requestId?: Id<'workoutRequests'> },
    null
  >('workoutDrafts:removeSet'),
  draftUpdateNotes: makeFunctionReference<
    'mutation',
    { rowId: string; notes: string; source: Source; requestId?: Id<'workoutRequests'> },
    null
  >('workoutDrafts:updateExerciseNotes'),
  draftReorder: makeFunctionReference<
    'mutation',
    { orderedRowIds: string[]; source: Source; requestId?: Id<'workoutRequests'> },
    null
  >('workoutDrafts:reorderExercises'),
  draftUndo: makeFunctionReference<
    'mutation',
    { source: Source; requestId?: Id<'workoutRequests'> },
    string
  >('workoutDrafts:undoLastAction'),
  conversation: makeFunctionReference<
    'query',
    { mode: 'workout' | 'analysis' },
    { role: 'user' | 'assistant'; content: string }[]
  >('aiMessages:conversation'),
  messageAppend: makeFunctionReference<
    'mutation',
    {
      mode: 'workout' | 'analysis';
      role: 'user' | 'assistant';
      text: string;
      chart?: AnalysisChart;
    },
    Id<'aiMessages'>
  >('aiMessages:append'),
  workoutsRecent: makeFunctionReference<'query', { limit?: number }, unknown>('workouts:recent'),
  workoutGet: makeFunctionReference<'query', { workoutId: Id<'workouts'> }, unknown>(
    'workouts:get',
  ),
  searchWorkouts: makeFunctionReference<
    'query',
    DateRange & { query: string; limit?: number },
    unknown
  >('analysis:searchWorkouts'),
  exerciseHistory: makeFunctionReference<
    'query',
    DateRange & { exerciseId: Id<'exercises'> },
    unknown
  >('analysis:getExerciseHistory'),
  exerciseStats: makeFunctionReference<
    'query',
    DateRange & { exerciseId: Id<'exercises'> },
    unknown
  >('analysis:getExerciseStats'),
  personalRecords: makeFunctionReference<
    'query',
    DateRange & { exerciseId: Id<'exercises'> },
    unknown
  >('analysis:getPersonalRecords'),
  weeklyVolume: makeFunctionReference<'query', DateRange, unknown>('analysis:getWeeklyVolume'),
  monthlyVolume: makeFunctionReference<'query', DateRange, unknown>('analysis:getMonthlyVolume'),
  compareExercises: makeFunctionReference<
    'query',
    DateRange & { exerciseIds: Id<'exercises'>[] },
    unknown
  >('analysis:compareExercises'),
  exerciseFrequency: makeFunctionReference<
    'query',
    DateRange & { exerciseId: Id<'exercises'> },
    unknown
  >('analysis:getExerciseFrequency'),
  trainingDays: makeFunctionReference<'query', DateRange, unknown>('analysis:getTrainingDays'),
} as const;
