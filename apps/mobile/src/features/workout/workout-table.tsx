import { Pressable, ScrollView, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useAppTheme } from '@/components/theme-provider';

interface DraftSet {
  setId: string;
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
}

interface DraftExercise {
  rowId: string;
  name: string;
  notes?: string;
  sets: DraftSet[];
}

type SetPatch = Pick<DraftSet, 'weightKg' | 'reps'>;

export function WorkoutTable({
  exercises,
  onRemoveSet,
  onUpdateSet,
}: {
  exercises: DraftExercise[];
  onRemoveSet: (rowId: string, setId: string) => void;
  onUpdateSet: (rowId: string, setId: string, patch: SetPatch) => void;
}) {
  const { colors } = useAppTheme();
  if (exercises.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-center text-2xl font-black text-ink dark:text-ink-dark">
          Tell me what you did.
        </Text>
        <Text className="mt-3 text-center text-base leading-6 text-muted dark:text-muted-dark">
          Try “bench 80 kg 8 reps” to start today’s structured workout.
        </Text>
      </View>
    );
  }
  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-7 px-4 pb-8 pt-5">
      <View className="flex-row px-2">
        <Text className="text-xs font-bold tracking-widest text-muted dark:text-muted-dark">
          EXERCISES
        </Text>
      </View>
      {exercises.map((exercise) => (
        <View key={exercise.rowId}>
          <Text className="mb-3 text-lg font-black text-ink dark:text-ink-dark">
            {exercise.name}
          </Text>
          {exercise.sets.map((set, index) => (
            <View
              className="mb-2 w-full flex-row items-center rounded-2xl bg-panel px-3 py-3 dark:bg-panel-dark lg:w-auto lg:self-start"
              key={set.setId}
            >
              <Text className="w-16 flex-none text-sm font-semibold text-muted dark:text-muted-dark sm:w-20 lg:w-16">
                Set {index + 1}
              </Text>
              <View className="flex-1 gap-2 sm:flex-row sm:items-center lg:ml-2 lg:flex-none">
                {set.weightKg !== undefined ? (
                  <View className="flex-row items-center justify-center gap-0.5 sm:flex-1 lg:flex-none">
                    <AdjustButton
                      accessibilityLabel={`Decrease ${exercise.name} set ${index + 1} by 5 kg`}
                      disabled={set.weightKg <= 5}
                      label="−5"
                      onPress={() =>
                        onUpdateSet(exercise.rowId, set.setId, { weightKg: set.weightKg! - 5 })
                      }
                    />
                    <AdjustButton
                      accessibilityLabel={`Decrease ${exercise.name} set ${index + 1} by 1 kg`}
                      disabled={set.weightKg <= 1}
                      label="−1"
                      onPress={() =>
                        onUpdateSet(exercise.rowId, set.setId, { weightKg: set.weightKg! - 1 })
                      }
                    />
                    <Text className="min-w-[58px] text-center text-base font-bold text-ink dark:text-ink-dark">
                      {set.weightKg} kg
                    </Text>
                    <AdjustButton
                      accessibilityLabel={`Increase ${exercise.name} set ${index + 1} by 1 kg`}
                      label="+1"
                      onPress={() =>
                        onUpdateSet(exercise.rowId, set.setId, { weightKg: set.weightKg! + 1 })
                      }
                    />
                    <AdjustButton
                      accessibilityLabel={`Increase ${exercise.name} set ${index + 1} by 5 kg`}
                      label="+5"
                      onPress={() =>
                        onUpdateSet(exercise.rowId, set.setId, { weightKg: set.weightKg! + 5 })
                      }
                    />
                  </View>
                ) : null}
                {set.reps !== undefined ? (
                  <View className="flex-row items-center justify-center gap-0.5 sm:flex-1 lg:ml-3 lg:flex-none">
                    <AdjustButton
                      accessibilityLabel={`Decrease ${exercise.name} set ${index + 1} by 1 rep`}
                      disabled={set.reps <= 1}
                      label="−1"
                      onPress={() =>
                        onUpdateSet(exercise.rowId, set.setId, { reps: set.reps! - 1 })
                      }
                    />
                    <Text className="min-w-[66px] text-center text-base font-bold text-ink dark:text-ink-dark">
                      {set.reps} reps
                    </Text>
                    <AdjustButton
                      accessibilityLabel={`Increase ${exercise.name} set ${index + 1} by 1 rep`}
                      label="+1"
                      onPress={() =>
                        onUpdateSet(exercise.rowId, set.setId, { reps: set.reps! + 1 })
                      }
                    />
                  </View>
                ) : null}
              </View>
              <Pressable
                accessibilityLabel={`Remove ${exercise.name} set ${index + 1}`}
                className="ml-1 h-8 w-8 items-center justify-center lg:ml-2"
                onPress={() => onRemoveSet(exercise.rowId, set.setId)}
              >
                <X color={colors.muted} size={16} />
              </Pressable>
            </View>
          ))}
          {exercise.notes ? (
            <Text className="mt-1 text-sm italic text-muted dark:text-muted-dark">
              {exercise.notes}
            </Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

function AdjustButton({
  accessibilityLabel,
  disabled,
  label,
  onPress,
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      className="h-8 min-w-7 items-center justify-center rounded-lg border border-line px-1 dark:border-line-dark"
      disabled={disabled}
      onPress={onPress}
    >
      <Text className="text-xs font-bold text-ink dark:text-ink-dark">{label}</Text>
    </Pressable>
  );
}
