import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, List, Trash2 } from 'lucide-react-native';
import { IconButton } from '@fitness/ui';
import type { WorkoutSet } from '@fitness/domain';
import { useAppTheme } from '@/components/theme-provider';
import { formatNumber, formatSet } from './history-format';
import { DisplayText } from '@/components/display-text';

type DraftSet = WorkoutSet & { setId: string };
interface DraftExercise {
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
  const [expanded, setExpanded] = useState<string>();
  const [expandedExercise, setExpandedExercise] = useState<string>();
  const scrollRef = useRef<ScrollView>(null);
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
              setExpandedExercise(undefined);
              setExpanded(undefined);
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
        {exercises.length === 0 ? (
          <View className="flex-1 justify-center py-10">
            <DisplayText className="text-[40px] leading-[46px]">
              Less typing. More training.
            </DisplayText>
            <Text className="mt-3 max-w-md text-base leading-6 text-muted dark:text-muted-dark">
              Tell me what you lifted, ran, or held. Your workout takes shape here.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => onExample('Bench press 80 kg for 8 reps')}
              className="mt-7 self-start rounded-xl border border-line bg-panel px-4 py-3 active:opacity-70 dark:border-line-dark dark:bg-panel-dark"
            >
              <Text className="text-sm text-ink dark:text-ink-dark">
                Try “Bench press 80 kg for 8 reps”
              </Text>
            </Pressable>
            <Text className="mt-3 text-xs text-muted dark:text-muted-dark">
              Review your sets before saving your workout.
            </Text>
          </View>
        ) : (
          exercises.map((exercise) => {
            const exerciseOpen = expandedExercise === exercise.rowId;
            const countLabel = `${exercise.sets.length} ${exercise.sets.length === 1 ? 'set' : 'sets'}`;
            return (
              <View
                key={exercise.rowId}
                onLayout={({ nativeEvent }) => {
                  // Use the new position after the previously open exercise collapses.
                  if (exerciseOpen && pendingExerciseScroll.current === exercise.rowId) {
                    pendingExerciseScroll.current = undefined;
                    scrollRef.current?.scrollTo({
                      y: Math.max(0, nativeEvent.layout.y - 16),
                      animated: false,
                    });
                  }
                }}
                className="mb-3 overflow-hidden rounded-[20px] bg-panel dark:bg-panel-dark"
              >
                <View className="flex-row items-center pr-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${exercise.name}, ${countLabel}`}
                    accessibilityHint={exerciseOpen ? 'Hide sets' : 'Show sets to review or edit'}
                    accessibilityState={{ expanded: exerciseOpen }}
                    onPress={() => {
                      pendingExerciseScroll.current = exerciseOpen ? undefined : exercise.rowId;
                      setExpandedExercise(exerciseOpen ? undefined : exercise.rowId);
                      setExpanded(undefined);
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
                    {exercise.sets.map((set, index) => {
                      const open = expanded === set.setId;
                      return (
                        <View
                          key={set.setId}
                          className={index ? 'border-t border-line dark:border-line-dark' : ''}
                        >
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${exercise.name} set ${index + 1}: ${formatSet(set)}`}
                            accessibilityState={{ expanded: open }}
                            onPress={() => setExpanded(open ? undefined : set.setId)}
                            className="min-h-[68px] flex-row items-center gap-3 px-4 py-3 active:bg-soft dark:active:bg-soft-dark"
                          >
                            <View className="h-8 w-8 items-center justify-center rounded-full bg-soft dark:bg-soft-dark">
                              <Text className="text-sm font-semibold text-muted dark:text-muted-dark">
                                {index + 1}
                              </Text>
                            </View>
                            <DisplayText
                              className="flex-1 text-[28px] leading-9"
                              style={{ fontVariant: ['tabular-nums'] }}
                            >
                              {formatSet(set)}
                            </DisplayText>
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
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
