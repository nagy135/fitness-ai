import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Dumbbell, X } from 'lucide-react-native';
import { useAppTheme } from './theme-provider';
import {
  formatSetSummary,
  type WorkoutHistorySet,
} from '@/features/workout/history-format';

interface WorkoutHistoryItem {
  _id: string;
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
  visible,
  workouts,
}: {
  onClose: () => void;
  visible: boolean;
  workouts: WorkoutHistoryItem[] | undefined;
}) {
  const { colors } = useAppTheme();

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View className="flex-1 flex-row bg-black/50">
        <Pressable accessibilityLabel="Close workout history" className="flex-1" onPress={onClose} />
        <View className="h-full w-[92%] max-w-lg border-l border-line bg-canvas px-5 pb-8 pt-14 dark:border-line-dark dark:bg-canvas-dark">
          <View className="mb-6 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-2xl font-black text-ink dark:text-ink-dark">
                Workout history
              </Text>
              <Text className="mt-1 text-sm text-muted dark:text-muted-dark">
                Most recent first
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close workout history"
              className="h-11 w-11 items-center justify-center rounded-2xl border border-line bg-panel dark:border-line-dark dark:bg-panel-dark"
              onPress={onClose}
            >
              <X color={colors.text} size={20} />
            </Pressable>
          </View>

          {workouts === undefined ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={colors.accent} />
              <Text className="mt-3 text-sm text-muted dark:text-muted-dark">
                Loading workouts…
              </Text>
            </View>
          ) : workouts.length ? (
            <ScrollView
              contentContainerClassName="gap-4 pb-6"
              showsVerticalScrollIndicator={false}
            >
              {workouts.map((workout) => (
                <View
                  className="rounded-3xl border border-line bg-panel p-5 dark:border-line-dark dark:bg-panel-dark"
                  key={workout._id}
                >
                  <Text className="text-xs font-black uppercase tracking-widest text-accent dark:text-accent-dark">
                    {formatWorkoutDate(workout.performedAt)}
                  </Text>
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
        </View>
      </View>
    </Modal>
  );
}
