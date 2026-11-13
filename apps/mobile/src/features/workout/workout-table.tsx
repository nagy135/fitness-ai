import { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { Award, Check, ChevronDown, ChevronUp, List, Trash2, Trophy } from 'lucide-react-native';
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
import { ExerciseReorderCard } from './exercise-reorder-card';
import { useExerciseDrag } from './use-exercise-drag';
import { moveExercise } from './exercise-reorder';
import { ExerciseRecords } from './exercise-records';
import { AchievementInfo } from './achievement-info';
import { SettleRipple } from './settle-ripple';

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
  onReorder,
  onAdjustSet,
  onExample,
}: {
  exercises: DraftExercise[];
  busy: boolean;
  savingSets?: boolean;
  onRemoveSet: (rowId: string, setId: string) => Promise<void>;
  onRemoveExercise: (rowId: string) => Promise<void>;
  onReorder: (ids: string[]) => Promise<void | boolean>;
  onAdjustSet: (
    rowId: string,
    setId: string,
    field: SetMeasurementField,
    delta: number,
  ) => Promise<void>;
  onExample: (text: string) => void;
}) {
  const { colors, isDark } = useAppTheme();
  const completedColor = isDark ? '#4ade80' : '#15803d';
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
  // Personal progress belongs to this mounted draft, never to saved workout data.
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(() => new Set());
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(() => new Set());
  const [previousExercises, setPreviousExercises] = useState(exercises);
  const [previousSavingSets, setPreviousSavingSets] = useState(savingSets);
  // Also skip the final save/rollback render when the last adjustment settles.
  const manualChange = savingSets || previousSavingSets;
  if (previousSavingSets !== savingSets) setPreviousSavingSets(savingSets);
  const [reorderMode, setReorderMode] = useState<{
    source: DraftExercise[];
    ids: string[];
    scroll: number;
  }>();
  const [savingOrder, setSavingOrder] = useState(false);
  if (
    reorderMode &&
    reorderMode.source !== exercises &&
    !savingOrder &&
    JSON.stringify(reorderMode.source) !== JSON.stringify(exercises)
  )
    setReorderMode(undefined);
  const destructiveBusy = busy || savingSets || savingOrder;
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
    const remainingCompleted = new Set(
      exercises
        .filter((exercise) => completedExercises.has(exercise.rowId))
        .map((exercise) => exercise.rowId),
    );
    if (remainingCompleted.size !== completedExercises.size)
      setCompletedExercises(remainingCompleted);
    setPreviousExercises(exercises);
    setExpandedExercises(nextExercises);
    setExpanded(nextSets);
  }
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const displayedExercises = useMemo(() => {
    if (!reorderMode) return exercises;
    const byId = new Map(reorderMode.source.map((row) => [row.rowId, row]));
    return reorderMode.ids.map((id) => byId.get(id)!);
  }, [exercises, reorderMode]);
  function stageOrder(ids: string[]) {
    setReorderMode((current) => (current ? { ...current, ids } : undefined));
  }
  const drag = useExerciseDrag(displayedExercises, scrollRef, stageOrder);
  function enterReorder() {
    if (destructiveBusy || exercises.length < 2 || reorderMode) return;
    pendingExerciseScroll.current = undefined;
    setChanges((previous) => ({ ...previous, ids: [], setIds: [] }));
    setReorderMode({
      source: exercises,
      ids: exercises.map((row) => row.rowId),
      scroll: drag.getScroll(),
    });
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  function closeReorder() {
    drag.cancel();
    const scroll = reorderMode?.scroll ?? 0;
    setReorderMode(undefined);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: scroll, animated: false }));
  }
  async function saveOrder() {
    if (!reorderMode || destructiveBusy || drag.activeId) return;
    if (reorderMode.ids.every((id, index) => id === exercises[index]?.rowId)) {
      closeReorder();
      return;
    }
    setSavingOrder(true);
    try {
      if ((await onReorder(reorderMode.ids)) !== false) closeReorder();
    } finally {
      setSavingOrder(false);
    }
  }
  const pendingExerciseScroll = useRef<string | undefined>(undefined);
  const setCount = exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  return (
    <View className="flex-1">
      {reorderMode ? (
        <View className="flex-row items-center justify-between gap-2 px-5 pb-2">
          <Text
            accessibilityLiveRegion="polite"
            className="flex-1 text-sm font-semibold text-accent dark:text-accent-dark"
          >
            Reorder exercises
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel reordering"
            disabled={savingOrder}
            onPress={closeReorder}
            className="min-h-11 justify-center rounded-lg border border-line px-3 dark:border-line-dark"
          >
            <Text className="text-sm font-semibold text-ink dark:text-ink-dark">Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save exercise order"
            accessibilityState={{ disabled: destructiveBusy || !!drag.activeId }}
            disabled={destructiveBusy || !!drag.activeId}
            onPress={() => void saveOrder()}
            className="min-h-11 justify-center rounded-lg bg-accent px-3 dark:bg-accent-dark"
          >
            <Text className="text-sm font-semibold text-accent-ink dark:text-accent-ink-dark">
              {savingOrder ? 'Saving…' : 'Done'}
            </Text>
          </Pressable>
        </View>
      ) : null}
      <ScrollView
        ref={scrollRef}
        scrollEnabled={!drag.activeId}
        removeClippedSubviews={false}
        scrollEventThrottle={16}
        onScroll={({ nativeEvent }) => {
          drag.setScroll(nativeEvent.contentOffset.y);
        }}
        onContentSizeChange={(_width, height) => {
          drag.setContentHeight(height);
        }}
        onLayout={() =>
          scrollRef.current?.getNativeScrollRef()?.measureInWindow((_x, y, _width, height) => {
            drag.setViewport(y, height);
          })
        }
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="grow px-5 pb-2 pt-1"
        contentContainerStyle={{ paddingTop: reorderMode ? 12 : 4 }}
      >
        {exercises.length === 0 ? null : (
          <View ref={contentRef} collapsable={false}>
            {!reorderMode ? (
              <View className="mb-1 flex-row flex-wrap items-center justify-between gap-x-3">
                <Text className="text-sm text-muted dark:text-muted-dark">
                  {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'} ·{' '}
                  {setCount} {setCount === 1 ? 'set' : 'sets'}
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
            ) : null}
            {displayedExercises.map((exercise, exerciseIndex) => {
              const completed = completedExercises.has(exercise.rowId);
              const exerciseOpen = !reorderMode && expandedExercises.has(exercise.rowId);
              const countLabel = `${exercise.sets.length} ${exercise.sets.length === 1 ? 'set' : 'sets'}`;
              const records = exercise.exerciseId
                ? improvements.get(exercise.exerciseId)
                : undefined;
              return (
                <ExerciseReorderCard
                  key={exercise.rowId}
                  name={exercise.name}
                  reordering={!!reorderMode}
                  disabled={destructiveBusy || exercises.length < 2}
                  canMoveUp={exerciseIndex > 0}
                  canMoveDown={exerciseIndex < displayedExercises.length - 1}
                  onEnter={enterReorder}
                  onStart={(pageY) => drag.start(exercise.rowId, pageY)}
                  onMove={drag.move}
                  onEnd={drag.end}
                  onCancel={drag.cancel}
                  onStep={(delta) =>
                    stageOrder(
                      moveExercise(
                        displayedExercises.map((row) => row.rowId),
                        exerciseIndex,
                        exerciseIndex + delta,
                      ),
                    )
                  }
                  style={{
                    marginBottom: 6,
                    zIndex: drag.activeId === exercise.rowId ? 10 : 0,
                    elevation: drag.activeId === exercise.rowId ? 8 : 0,
                    transform: [{ translateY: drag.offset(exercise.rowId) }],
                  }}
                  onLayout={({ nativeEvent }) => {
                    drag.setLayout(exercise.rowId, nativeEvent.layout);
                    if (exerciseOpen && pendingExerciseScroll.current === exercise.rowId) {
                      pendingExerciseScroll.current = undefined;
                      scrollRef.current?.scrollTo({
                        y: Math.max(0, nativeEvent.layout.y - 16),
                        animated: false,
                      });
                    }
                  }}
                >
                  <SettleRipple settled={completed} name={exercise.name}>
                    {({ buttonRef, buttonScale }) => (
                      <WorkoutChangePulse
                        style={{
                          borderRadius: 12,
                          opacity: drag.activeId === exercise.rowId ? 0.95 : 1,
                          borderWidth: 1,
                          borderColor: colors.line,
                          overflow: 'hidden',
                          backgroundColor: colors.panel,
                        }}
                        pulseVersion={
                          !reorderMode && changes.ids.includes(exercise.rowId) ? changes.version : 0
                        }
                        reveal={!reorderMode && changes.ids[0] === exercise.rowId}
                        contentRef={contentRef}
                        scrollRef={scrollRef}
                      >
                        <View className="flex-row items-center pr-1">
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${exercise.name}, ${countLabel}`}
                            accessibilityHint={
                              exerciseOpen ? 'Hide sets' : 'Show sets to review or edit'
                            }
                            accessibilityState={{ expanded: exerciseOpen }}
                            accessibilityActions={[
                              { name: 'longpress', label: 'Reorder exercises' },
                            ]}
                            onAccessibilityAction={({ nativeEvent }) => {
                              if (nativeEvent.actionName === 'longpress') enterReorder();
                            }}
                            onPress={() => {
                              if (reorderMode) return;
                              pendingExerciseScroll.current = exerciseOpen
                                ? undefined
                                : exercise.rowId;
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
                            {reorderMode ? null : exerciseOpen ? (
                              <ChevronUp size={20} color={colors.accent} />
                            ) : (
                              <ChevronDown size={20} color={colors.muted} />
                            )}
                          </Pressable>
                          {!reorderMode ? (
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
                          ) : null}
                        </View>
                        {!reorderMode && (records?.volume || records?.maxSet) ? (
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
                                  className={
                                    index ? 'border-t border-line dark:border-line-dark' : ''
                                  }
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
                                        version={
                                          changes.setIds.includes(set.setId) ? changes.version : 0
                                        }
                                      />
                                      <SetMeasurement
                                        set={set}
                                        compact
                                        className="flex-1 leading-6"
                                      />
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
                                              void onAdjustSet(
                                                exercise.rowId,
                                                set.setId,
                                                field,
                                                delta,
                                              )
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
                            <View className="flex-row justify-end gap-2 px-3 pb-2 pt-1">
                              {exercise.exerciseId ? (
                                <AchievementInfo
                                  name={exercise.name}
                                  sets={exercises
                                    .filter((row) => row.exerciseId === exercise.exerciseId)
                                    .flatMap((row) => row.sets)}
                                  baseline={baselines?.find(
                                    (baseline) => baseline.exerciseId === exercise.exerciseId,
                                  )}
                                />
                              ) : null}
                              <Animated.View
                                ref={buttonRef}
                                collapsable={false}
                                style={{ transform: [{ scale: buttonScale }] }}
                              >
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={`${completed ? 'Unsettle' : 'Settle'} ${exercise.name}`}
                                  accessibilityHint="Toggles your personal completed marker for this workout"
                                  accessibilityState={{ selected: completed }}
                                  onPress={() =>
                                    setCompletedExercises((previous) => {
                                      const next = new Set(previous);
                                      if (next.has(exercise.rowId)) next.delete(exercise.rowId);
                                      else next.add(exercise.rowId);
                                      return next;
                                    })
                                  }
                                  className="min-h-11 flex-row items-center gap-1.5 rounded-lg border px-3 active:opacity-70"
                                  style={{ borderColor: completed ? completedColor : colors.line }}
                                >
                                  <Check
                                    size={17}
                                    color={completed ? completedColor : colors.muted}
                                  />
                                  <Text
                                    className="text-sm font-semibold"
                                    style={{ color: completed ? completedColor : colors.text }}
                                  >
                                    {completed ? 'Settled' : 'Settle'}
                                  </Text>
                                </Pressable>
                              </Animated.View>
                            </View>
                          </View>
                        ) : null}
                      </WorkoutChangePulse>
                    )}
                  </SettleRipple>
                </ExerciseReorderCard>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
