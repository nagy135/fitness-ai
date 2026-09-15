import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { CalendarDays, Dumbbell, List } from 'lucide-react-native';
import { cn } from '@fitness/ui';
import { useMutation } from 'convex/react';
import { api } from '@fitness/convex/api';
import type { Id } from '@fitness/convex/data-model';
import { useAppTheme } from './theme-provider';
import { Drawer } from './drawer';
import { WorkoutHistoryCalendar } from './workout-history-calendar';
import { WorkoutHistoryRecordActions } from './workout-history-record-actions';
import { formatSetSummary, type WorkoutHistorySet } from '@/features/workout/history-format';
import { groupWorkoutsByDay, historyDayKey } from '@/features/workout/history-calendar';

interface WorkoutHistoryItem {
  _id: Id<'workouts'>;
  performedAt: number;
  notes?: string;
  exercises: {
    exerciseId: string;
    nameSnapshot: string;
    sets: WorkoutHistorySet[];
  }[];
}

function formatWorkoutDate(performedAt: number) {
  const date = new Date(performedAt);
  const now = new Date();
  const includeYear = date.getFullYear() !== now.getFullYear();

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    weekday: 'short',
    ...(includeYear ? { year: 'numeric' as const } : {}),
  });
}

export function WorkoutHistoryDrawer({
  onClose,
  onEdit,
  visible,
  workouts,
}: {
  onClose: () => void;
  onEdit: () => void;
  visible: boolean;
  workouts: WorkoutHistoryItem[] | undefined;
}) {
  const { colors } = useAppTheme();
  const beginEdit = useMutation(api.workouts.beginEdit);
  const deleteWorkout = useMutation(api.workouts.remove);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [initialDate] = useState(() => new Date());
  const date = selectedDate ?? (workouts?.length ? new Date(workouts[0].performedAt) : initialDate);
  const workoutsByDay = useMemo(() => groupWorkoutsByDay(workouts ?? []), [workouts]);
  const workoutCounts = useMemo(
    () => new Map([...workoutsByDay].map(([key, items]) => [key, items.length])),
    [workoutsByDay],
  );
  const displayedWorkouts =
    view === 'list' ? workouts : (workoutsByDay.get(historyDayKey(date)) ?? []);

  return (
    <Drawer
      title="Workout history"
      subtitle="Your latest 50 saved workouts"
      visible={visible}
      onClose={onClose}
    >
      <View
        accessibilityRole="tablist"
        className="mb-4 flex-row rounded-2xl bg-soft p-1 dark:bg-soft-dark"
      >
        {(['list', 'calendar'] as const).map((option) => {
          const selected = view === option;
          const Icon = option === 'list' ? List : CalendarDays;
          return (
            <Pressable
              key={option}
              accessibilityRole="tab"
              accessibilityLabel={option === 'list' ? 'Latest workouts list' : 'Workout calendar'}
              accessibilityState={{ selected }}
              onPress={() => setView(option)}
              className={cn(
                'min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl',
                selected && 'bg-panel dark:bg-panel-dark',
              )}
            >
              <Icon color={selected ? colors.accent : colors.muted} size={18} />
              <Text
                className={cn(
                  'text-sm font-bold',
                  selected
                    ? 'text-accent dark:text-accent-dark'
                    : 'text-muted dark:text-muted-dark',
                )}
              >
                {option === 'list' ? 'List' : 'Calendar'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {workouts === undefined ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
          <Text className="mt-3 text-sm text-muted dark:text-muted-dark">Loading workouts…</Text>
        </View>
      ) : workouts.length || view === 'calendar' ? (
        <ScrollView
          key={view}
          contentContainerClassName="gap-4 pb-6"
          showsVerticalScrollIndicator={false}
        >
          {view === 'calendar' ? (
            <>
              <WorkoutHistoryCalendar
                selectedDate={date}
                onSelectDate={setSelectedDate}
                workoutCounts={workoutCounts}
              />
              <View accessibilityLiveRegion="polite">
                <Text
                  accessibilityRole="header"
                  className="text-base font-bold text-ink dark:text-ink-dark"
                >
                  {formatWorkoutDate(date.getTime())}
                </Text>
                <Text className="mt-1 text-sm text-muted dark:text-muted-dark">
                  {displayedWorkouts?.length
                    ? `${displayedWorkouts.length} saved ${displayedWorkouts.length === 1 ? 'workout' : 'workouts'}`
                    : workouts.length
                      ? 'No workouts in your recent history for this day.'
                      : 'No workouts yet. Confirm your current workout and it will appear here.'}
                </Text>
              </View>
            </>
          ) : null}
          {displayedWorkouts?.map((workout) => (
            <View
              className="rounded-3xl border border-line bg-panel p-5 dark:border-line-dark dark:bg-panel-dark"
              key={workout._id}
            >
              <WorkoutHistoryRecordActions
                dateLabel={formatWorkoutDate(workout.performedAt)}
                onDelete={() => deleteWorkout({ workoutId: workout._id })}
                onEdit={async () => {
                  await beginEdit({ workoutId: workout._id });
                  onEdit();
                }}
              />
              <View className="mt-4 gap-3">
                {workout.exercises.map((exercise, index) => (
                  <Text
                    className="text-[15px] leading-6 text-ink dark:text-ink-dark"
                    key={`${exercise.exerciseId}-${index}`}
                  >
                    <Text className="font-bold">{exercise.nameSnapshot}</Text>{' '}
                    <Text className="text-muted dark:text-muted-dark">
                      ({formatSetSummary(exercise.sets)})
                    </Text>
                  </Text>
                ))}
              </View>
              {workout.notes ? (
                <Text className="mt-4 border-t border-line pt-3 text-sm italic leading-5 text-muted dark:border-line-dark dark:text-muted-dark">
                  {workout.notes}
                </Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center px-5">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-panel dark:bg-panel-dark">
            <Dumbbell color={colors.muted} size={24} />
          </View>
          <Text className="mt-4 text-center text-lg font-bold text-ink dark:text-ink-dark">
            No workouts yet
          </Text>
          <Text className="mt-2 text-center text-sm leading-5 text-muted dark:text-muted-dark">
            Confirm your current workout and it will appear here.
          </Text>
        </View>
      )}
    </Drawer>
  );
}
