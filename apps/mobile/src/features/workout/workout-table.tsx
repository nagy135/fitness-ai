import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Award, ChevronDown, ChevronUp, List, Trash2, Trophy } from 'lucide-react-native';
import { useQuery } from 'convex/react';
import { api } from '@fitness/convex/api';
import { exerciseRecordImprovements } from '@fitness/domain';
import type { SetMeasurementField, WorkoutSet } from '@fitness/domain';
import { useAppTheme } from '@/components/theme-provider';
import { formatSet } from './history-format';
import { MeasurementStepper } from './measurement-stepper';
import { SetMeasurement } from './set-measurement';
import { WorkoutChangePulse } from './workout-change-pulse';
import { SetOrderBadge } from './set-order-badge';
import type { Id } from '@fitness/convex/data-model';
import { ExerciseRecords } from './exercise-records';

type DraftSet = WorkoutSet & { setId: string };
interface DraftExercise {
  exerciseId?: Id<'exercises'>;
  rowId: string;
  name: string;
  notes?: string;
  sets: DraftSet[];
}
const measures = [
  { field: 'weightKg', label: 'Weight', unit: 'kg', steps: [0.5, 1, 5] },
  { field: 'reps', label: 'Reps', unit: 'reps', steps: [1] },
  { field: 'durationSeconds', label: 'Duration', unit: 'sec', steps: [1, 10] },
  { field: 'distanceMeters', label: 'Distance', unit: 'm', steps: [10, 100] },
] as const;

export function WorkoutTable({
  exercises,
  busy,
  savingSets = false,
  onRemoveSet,
  onRemoveExercise,
  onAdjustSet,
  onExample,
}: {
  exercises: DraftExercise[];
  busy: boolean;
  savingSets?: boolean;
  onRemoveSet: (rowId: string, setId: string) => Promise<void>;
  onRemoveExercise: (rowId: string) => Promise<void>;
  onAdjustSet: (
    rowId: string,
    setId: string,
    field: SetMeasurementField,
    delta: number,
  ) => Promise<void>;
  onExample: (text: string) => void;
}) {
  const { colors } = useAppTheme();
  const exerciseIds = [
    ...new Set(exercises.flatMap((row) => (row.exerciseId ? [row.exerciseId] : []))),
  ];
  const baselines = useQuery(
    api.analysis.getExerciseRecordBaselines,
    exerciseIds.length ? { exerciseIds } : 'skip',
  );
  const improvements = new Map(
    baselines?.map((baseline) => [
      baseline.exerciseId,
      exerciseRecordImprovements(
        exercises
          .filter((row) => row.exerciseId === baseline.exerciseId)
          .flatMap((row) => row.sets),
        baseline.trackingType,
        baseline,
      ),
    ]),
  );
  const [adjustmentSteps, setAdjustmentSteps] = useState<Record<SetMeasurementField, number>>({
    weightKg: 1,
    reps: 1,
    durationSeconds: 1,
    distanceMeters: 10,
  });
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(() => new Set());
  const [previousExercises, setPreviousExercises] = useState(exercises);
  const [previousSavingSets, setPreviousSavingSets] = useState(savingSets);
  // Also skip the final save/rollback render when the last adjustment settles.
  const manualChange = savingSets || previousSavingSets;
  if (previousSavingSets !== savingSets) setPreviousSavingSets(savingSets);
  const destructiveBusy = busy || savingSets;
  const [changes, setChanges] = useState({
    version: 0,
    ids: [] as string[],
    setIds: [] as string[],
  });

  // Compare contents, not query object identities: unrelated updates must not
  // undo a user's collapse. Open every affected row in a batched tool update.
  if (previousExercises !== exercises) {
    const previousById = new Map(previousExercises.map((exercise) => [exercise.rowId, exercise]));
    const nextExercises = new Set<string>();
    const nextSets = new Set<string>();
    const changedIds: string[] = [];
    const changedSetIds: string[] = [];
    for (const exercise of exercises) {
      const previous = previousById.get(exercise.rowId);
      const changed = !manualChange && JSON.stringify(previous) !== JSON.stringify(exercise);
      if (changed) changedIds.push(exercise.rowId);
      if (expandedExercises.has(exercise.rowId) || changed) {
        nextExercises.add(exercise.rowId);
      }
      const previousSets = new Map(previous?.sets.map((set) => [set.setId, set]));
      for (const set of exercise.sets) {
        if (!manualChange && JSON.stringify(previousSets.get(set.setId)) !== JSON.stringify(set)) {
          changedSetIds.push(set.setId);
        }
        if (expanded.has(set.setId)) {
          nextSets.add(set.setId);
        }
      }
    }
    if (changedIds.length)
      setChanges({ version: changes.version + 1, ids: changedIds, setIds: changedSetIds });
    else if (manualChange && (changes.ids.length || changes.setIds.length))
      setChanges({ version: changes.version, ids: [], setIds: [] });
    setPreviousExercises(exercises);
    setExpandedExercises(nextExercises);
    setExpanded(nextSets);
  }
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const pendingExerciseScroll = useRef<string | undefined>(undefined);
  const setCount = exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  return (
    <View className="flex-1">
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="grow px-5 pb-2 pt-1"
      >
        {exercises.length === 0 ? null : (
          <View ref={contentRef} collapsable={false}>
            <View className="mb-1 flex-row flex-wrap items-center justify-between gap-x-3">
              <Text className="text-sm text-muted dark:text-muted-dark">
                {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'} · {setCount}{' '}
                {setCount === 1 ? 'set' : 'sets'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show all exercises"
                accessibilityHint="Collapses the sets and returns to the exercise overview"
                onPress={() => {
                  pendingExerciseScroll.current = undefined;
                  setExpandedExercises(new Set());
                  setExpanded(new Set());
                  setChanges((previous) => ({ ...previous, setIds: [] }));
                  scrollRef.current?.scrollTo({ y: 0, animated: false });
                }}
                className="min-h-8 flex-row items-center gap-1.5 rounded-lg px-2 active:bg-soft dark:active:bg-soft-dark"
              >
                <List size={18} color={colors.accent} />
                <Text className="text-sm font-semibold text-accent dark:text-accent-dark">
                  All exercises
                </Text>
              </Pressable>
            </View>
            {exercises.map((exercise) => {
              const exerciseOpen = expandedExercises.has(exercise.rowId);
              const countLabel = `${exercise.sets.length} ${exercise.sets.length === 1 ? 'set' : 'sets'}`;
              const records = exercise.exerciseId
                ? improvements.get(exercise.exerciseId)
                : undefined;
              return (
                <WorkoutChangePulse
                  key={exercise.rowId}
                  style={{
                    marginBottom: 6,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.line,
                    overflow: 'hidden',
                    backgroundColor: colors.panel,
                  }}
                  pulseVersion={changes.ids.includes(exercise.rowId) ? changes.version : 0}
                  reveal={changes.ids[0] === exercise.rowId}
                  contentRef={contentRef}
                  scrollRef={scrollRef}
                  onLayout={({ nativeEvent }) => {
                    // Use the new position after the exercise expands.
                    if (exerciseOpen && pendingExerciseScroll.current === exercise.rowId) {
                      pendingExerciseScroll.current = undefined;
                      scrollRef.current?.scrollTo({
                        y: Math.max(0, nativeEvent.layout.y - 16),
                        animated: false,
                      });
                    }
                  }}
                >
                  <View className="flex-row items-center pr-1">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${exercise.name}, ${countLabel}`}
                      accessibilityHint={exerciseOpen ? 'Hide sets' : 'Show sets to review or edit'}
                      accessibilityState={{ expanded: exerciseOpen }}
                      onPress={() => {
                        pendingExerciseScroll.current = exerciseOpen ? undefined : exercise.rowId;
                        // Reopening manually must not replay an old set update.
                        setChanges((previous) => ({
                          ...previous,
                          setIds: previous.setIds.filter(
                            (id) => !exercise.sets.some((set) => set.setId === id),
                          ),
                        }));
                        setExpandedExercises((previous) => {
                          const next = new Set(previous);
                          if (exerciseOpen) next.delete(exercise.rowId);
                          else next.add(exercise.rowId);
                          return next;
                        });
                      }}
                      className="min-h-11 flex-1 flex-row items-center gap-2 px-3 py-1.5 active:bg-soft dark:active:bg-soft-dark"
                    >
                      <Text className="flex-1 text-base font-semibold text-ink dark:text-ink-dark">
                        {exercise.name}{' '}
                        <Text className="text-sm font-normal text-muted dark:text-muted-dark">
                          ({countLabel})
                        </Text>
                      </Text>
                      {exerciseOpen ? (
                        <ChevronUp size={20} color={colors.accent} />
                      ) : (
                        <ChevronDown size={20} color={colors.muted} />
                      )}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${exercise.name} from current workout`}
                      accessibilityHint="Removes this exercise and all its sets from the draft"
                      accessibilityState={{ disabled: destructiveBusy }}
                      disabled={destructiveBusy}
                      onPress={() => void onRemoveExercise(exercise.rowId)}
                      className={`h-11 w-11 items-center justify-center rounded-lg active:bg-soft dark:active:bg-soft-dark ${destructiveBusy ? 'opacity-40' : ''}`}
                    >
                      <Trash2 size={17} color={colors.danger} />
                    </Pressable>
                  </View>
                  {records?.volume || records?.maxSet ? (
                    <View
                      accessibilityLiveRegion="polite"
                      className="flex-row flex-wrap gap-1.5 px-3 pb-1"
                    >
                      {records.volume ? (
                        <View
                          accessible
                          accessibilityLabel={`Volume personal record for ${exercise.name}`}
                          className="flex-row items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 dark:bg-accent-dark/15"
                        >
                          <Trophy size={14} color={colors.accent} />
                          <Text className="text-xs font-semibold text-accent dark:text-accent-dark">
                            Volume PR
                          </Text>
                        </View>
                      ) : null}
                      {records.maxSet ? (
                        <View
                          accessible
                          accessibilityLabel={`Max set personal record for ${exercise.name}`}
                          className="flex-row items-center gap-1 rounded-full bg-highlight px-2 py-0.5 dark:bg-highlight-dark"
                        >
                          <Award size={14} color={colors.highlightInk} />
                          <Text className="text-xs font-semibold text-highlight-ink dark:text-highlight-ink-dark">
                            Max set PR
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                  {exerciseOpen ? (
                    <View className="border-t border-line dark:border-line-dark">
                      {exercise.exerciseId ? (
                        <ExerciseRecords
                          exerciseId={exercise.exerciseId}
                          name={exercise.name}
                          busy={destructiveBusy}
                          onExample={onExample}
                        />
                      ) : null}
                      {exercise.sets.map((set, index) => {
                        const open = expanded.has(set.setId);
                        return (
                          <View
                            key={set.setId}
                            className={index ? 'border-t border-line dark:border-line-dark' : ''}
                          >
                            <View className="flex-row items-center pr-1">
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Edit ${exercise.name} set ${index + 1}: ${formatSet(set)}`}
                                accessibilityState={{ expanded: open }}
                                onPress={() =>
                                  setExpanded((previous) => {
                                    const next = new Set(previous);
                                    if (open) next.delete(set.setId);
                                    else next.add(set.setId);
                                    return next;
                                  })
                                }
                                className="min-h-11 flex-1 flex-row items-center gap-2 px-3 py-1 active:bg-soft dark:active:bg-soft-dark"
                              >
                                <SetOrderBadge
                                  number={index + 1}
                                  version={changes.setIds.includes(set.setId) ? changes.version : 0}
                                />
                                <SetMeasurement set={set} compact className="flex-1 leading-6" />
                                {open ? (
                                  <ChevronUp size={18} color={colors.muted} />
                                ) : (
                                  <ChevronDown size={18} color={colors.muted} />
                                )}
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Remove ${exercise.name} set ${index + 1}`}
                                accessibilityHint="Removes this set from the draft"
                                accessibilityState={{ disabled: destructiveBusy }}
                                disabled={destructiveBusy}
                                onPress={() => void onRemoveSet(exercise.rowId, set.setId)}
                                className={`h-11 w-11 items-center justify-center rounded-lg active:bg-soft dark:active:bg-soft-dark ${destructiveBusy ? 'opacity-40' : ''}`}
                              >
                                <Trash2 size={17} color={colors.danger} />
                              </Pressable>
                            </View>
                            {open ? (
                              <View className="gap-1.5 border-t border-line px-3 py-1.5 dark:border-line-dark">
                                {measures.map(({ field, label, unit, steps }) => {
                                  const value = set[field];
                                  if (value === undefined) return null;
                                  return (
                                    <MeasurementStepper
                                      key={field}
                                      label={label}
                                      unit={unit}
                                      value={value}
                                      steps={steps}
                                      step={adjustmentSteps[field]}
                                      busy={busy}
                                      context={`${exercise.name} set ${index + 1}`}
                                      onStepChange={(step) =>
                                        setAdjustmentSteps((previous) => ({
                                          ...previous,
                                          [field]: step,
                                        }))
                                      }
                                      onAdjust={(delta) =>
                                        void onAdjustSet(exercise.rowId, set.setId, field, delta)
                                      }
                                    />
                                  );
                                })}
                                {set.notes ? (
                                  <Text className="text-sm text-muted dark:text-muted-dark">
                                    {set.notes}
                                  </Text>
                                ) : null}
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                      {!exercise.sets.length ? (
                        <View className="gap-1 px-3 py-2">
                          <Text className="text-sm text-muted dark:text-muted-dark">
                            Log a set below, or remove this exercise before saving.
                          </Text>
                        </View>
                      ) : null}
                      {exercise.notes ? (
                        <Text className="px-3 pb-2 pt-1 text-sm leading-5 text-muted dark:text-muted-dark">
                          {exercise.notes}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </WorkoutChangePulse>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
