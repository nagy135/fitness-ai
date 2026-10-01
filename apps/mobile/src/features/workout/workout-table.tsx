import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, List, Trash2 } from 'lucide-react-native';
import { IconButton } from '@fitness/ui';
import type { WorkoutSet } from '@fitness/domain';
import { useAppTheme } from '@/components/theme-provider';
import { formatNumber, formatSet } from './history-format';
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
export type SetPatch = Pick<WorkoutSet, 'weightKg' | 'reps' | 'durationSeconds' | 'distanceMeters'>;
const measures = [
  { field: 'weightKg', label: 'Weight', unit: 'kg', steps: [-5, -1, 1, 5] },
  { field: 'reps', label: 'Repetitions', unit: 'reps', steps: [-1, 1] },
  { field: 'durationSeconds', label: 'Duration', unit: 'sec', steps: [-10, -1, 1, 10] },
  { field: 'distanceMeters', label: 'Distance', unit: 'm', steps: [-100, -10, 10, 100] },
] as const;

export function WorkoutTable({
  exercises,
  busy,
  onRemoveSet,
  onRemoveExercise,
  onUpdateSet,
  onExample,
}: {
  exercises: DraftExercise[];
  busy: boolean;
  onRemoveSet: (rowId: string, setId: string) => Promise<void>;
  onRemoveExercise: (rowId: string) => Promise<void>;
  onUpdateSet: (rowId: string, setId: string, patch: SetPatch) => Promise<void>;
  onExample: (text: string) => void;
}) {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(() => new Set());
  const [previousExercises, setPreviousExercises] = useState(exercises);
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
      const changed = JSON.stringify(previous) !== JSON.stringify(exercise);
      if (changed) changedIds.push(exercise.rowId);
      if (expandedExercises.has(exercise.rowId) || changed) {
        nextExercises.add(exercise.rowId);
      }
      const previousSets = new Map(previous?.sets.map((set) => [set.setId, set]));
      for (const set of exercise.sets) {
        if (JSON.stringify(previousSets.get(set.setId)) !== JSON.stringify(set)) {
          changedSetIds.push(set.setId);
        }
        if (expanded.has(set.setId)) {
          nextSets.add(set.setId);
        }
      }
    }
    if (changedIds.length)
      setChanges({ version: changes.version + 1, ids: changedIds, setIds: changedSetIds });
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
      {exercises.length > 0 ? (
        <View className="flex-row flex-wrap items-center justify-between gap-x-3 px-5 pt-2">
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
            className="min-h-11 flex-row items-center gap-2 rounded-lg px-3 active:bg-soft dark:active:bg-soft-dark"
          >
            <List size={18} color={colors.accent} />
            <Text className="text-sm font-semibold text-accent dark:text-accent-dark">
              All exercises
            </Text>
          </Pressable>
        </View>
      ) : null}
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="grow px-5 pb-6 pt-4"
      >
        {exercises.length === 0 ? null : (
          <View ref={contentRef} collapsable={false}>
            {exercises.map((exercise) => {
              const exerciseOpen = expandedExercises.has(exercise.rowId);
              const countLabel = `${exercise.sets.length} ${exercise.sets.length === 1 ? 'set' : 'sets'}`;
              return (
                <WorkoutChangePulse
                  key={exercise.rowId}
                  className="mb-3 overflow-hidden rounded-[20px] bg-panel dark:bg-panel-dark"
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
                  <View className="flex-row items-center pr-2">
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
                      className="min-h-[68px] flex-1 flex-row items-center gap-3 px-4 py-4 active:bg-soft dark:active:bg-soft-dark"
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
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      onPress={() => void onRemoveExercise(exercise.rowId)}
                      className={`min-h-11 flex-row items-center gap-1 rounded-xl px-2 active:bg-soft dark:active:bg-soft-dark ${busy ? 'opacity-40' : ''}`}
                    >
                      <Trash2 size={18} color={colors.danger} />
                      <Text className="text-sm font-semibold text-danger dark:text-danger-dark">
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                  {exerciseOpen ? (
                    <View className="border-t border-line dark:border-line-dark">
                      {exercise.exerciseId ? (
                        <ExerciseRecords
                          exerciseId={exercise.exerciseId}
                          name={exercise.name}
                          busy={busy}
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
                              className="min-h-[68px] flex-row items-center gap-3 px-4 py-3 active:bg-soft dark:active:bg-soft-dark"
                            >
                              <SetOrderBadge
                                number={index + 1}
                                version={changes.setIds.includes(set.setId) ? changes.version : 0}
                              />
                              <SetMeasurement set={set} className="flex-1 leading-9" />
                              {open ? (
                                <ChevronUp size={18} color={colors.muted} />
                              ) : (
                                <ChevronDown size={18} color={colors.muted} />
                              )}
                            </Pressable>
                            {open ? (
                              <View className="gap-3 border-t border-line px-3 py-3 dark:border-line-dark">
                                {measures.map(({ field, label, unit, steps }) => {
                                  const value = set[field];
                                  if (value === undefined) return null;
                                  return (
                                    <View key={field} className="gap-2">
                                      <View className="flex-row items-center justify-between px-1">
                                        <Text className="text-sm text-muted dark:text-muted-dark">
                                          {label}
                                        </Text>
                                        <Text className="text-base font-semibold text-ink dark:text-ink-dark">
                                          {formatNumber(value)} {unit}
                                        </Text>
                                      </View>
                                      <View className="flex-row gap-2">
                                        {steps.map((step) => (
                                          <Pressable
                                            key={step}
                                            accessibilityRole="button"
                                            accessibilityLabel={`${step < 0 ? 'Decrease' : 'Increase'} ${exercise.name} set ${index + 1} by ${Math.abs(step)} ${unit}`}
                                            accessibilityState={{
                                              disabled: busy || value + step <= 0,
                                            }}
                                            disabled={busy || value + step <= 0}
                                            onPress={() =>
                                              void onUpdateSet(exercise.rowId, set.setId, {
                                                [field]: Number((value + step).toFixed(2)),
                                              })
                                            }
                                            className={`min-h-11 flex-1 items-center justify-center rounded-lg bg-canvas dark:bg-canvas-dark ${busy || value + step <= 0 ? 'opacity-35' : ''}`}
                                          >
                                            <Text className="text-sm font-semibold text-ink dark:text-ink-dark">
                                              {step > 0 ? '+' : '−'}
                                              {Math.abs(step)}
                                            </Text>
                                          </Pressable>
                                        ))}
                                      </View>
                                    </View>
                                  );
                                })}
                                {set.notes ? (
                                  <Text className="text-sm text-muted dark:text-muted-dark">
                                    {set.notes}
                                  </Text>
                                ) : null}
                                <View className="flex-row items-center justify-between">
                                  <Text className="text-sm text-muted dark:text-muted-dark">
                                    Remove this set
                                  </Text>
                                  <IconButton
                                    accessibilityLabel={`Remove ${exercise.name} set ${index + 1}`}
                                    disabled={busy}
                                    onPress={() => void onRemoveSet(exercise.rowId, set.setId)}
                                  >
                                    <Trash2 size={18} color={colors.danger} />
                                  </IconButton>
                                </View>
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                      {!exercise.sets.length ? (
                        <View className="gap-3 p-4">
                          <Text className="text-sm text-muted dark:text-muted-dark">
                            Log a set below, or remove this exercise before saving.
                          </Text>
                        </View>
                      ) : null}
                      {exercise.notes ? (
                        <Text className="px-4 pb-4 pt-2 text-sm leading-5 text-muted dark:text-muted-dark">
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
