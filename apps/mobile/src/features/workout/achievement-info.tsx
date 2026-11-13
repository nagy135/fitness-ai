import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Info } from 'lucide-react-native';
import { useThemeVariables } from '@fitness/ui';
import {
  exerciseRecordImprovements,
  summarizeExerciseRecordBaseline,
  type ExerciseRecordBaseline,
  type TrackingType,
  type WorkoutSet,
} from '@fitness/domain';
import { useAppTheme } from '@/components/theme-provider';
import { formatNumber, formatSet } from './history-format';

export function AchievementInfo({
  name,
  sets,
  baseline,
}: {
  name: string;
  sets: WorkoutSet[];
  baseline?: ExerciseRecordBaseline & { trackingType: TrackingType };
}) {
  const [open, setOpen] = useState(false);
  const { colors } = useAppTheme();
  const variables = useThemeVariables();
  const close = () => setOpen(false);
  const supported = baseline?.trackingType === 'weight_reps' || baseline?.trackingType === 'custom';
  const current =
    baseline &&
    summarizeExerciseRecordBaseline(
      [{ workoutId: 'draft', performedAt: 0, sets }],
      baseline.trackingType,
    );
  const improvements =
    baseline && exerciseRecordImprovements(sets, baseline.trackingType, baseline);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Explain achievements for ${name}`}
        accessibilityHint="Shows personal record rules and your current progress"
        onPress={() => setOpen(true)}
        className="min-h-11 flex-row items-center gap-1.5 rounded-lg border border-line px-3 active:opacity-70 dark:border-line-dark"
      >
        <Info size={17} color={colors.muted} />
        <Text className="text-sm font-semibold text-muted dark:text-muted-dark">PR info</Text>
      </Pressable>
      {open ? (
        <Modal transparent animationType="fade" visible onRequestClose={close}>
          <View
            style={variables}
            className="flex-1 items-center justify-center bg-black/50 px-5 py-8"
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss achievement info"
              onPress={close}
              className="absolute inset-0"
            />
            <View
              accessibilityViewIsModal
              style={{ maxHeight: '85%' }}
              className="w-full max-w-sm rounded-2xl border border-line bg-canvas p-4 dark:border-line-dark dark:bg-canvas-dark"
            >
              <ScrollView>
                <Text
                  accessibilityRole="header"
                  className="text-lg font-semibold text-ink dark:text-ink-dark"
                >
                  Achievements
                </Text>
                <Text className="mb-4 mt-1 text-sm text-muted dark:text-muted-dark">{name}</Text>
                {!baseline ? (
                  <Text
                    accessibilityRole="progressbar"
                    className="text-sm text-muted dark:text-muted-dark"
                  >
                    Loading saved records…
                  </Text>
                ) : !supported ? (
                  <Text className="text-sm text-muted dark:text-muted-dark">
                    Volume and max-set badges are available for exercises tracked with weight and
                    reps.
                  </Text>
                ) : (
                  <View className="gap-4">
                    <View className="gap-1">
                      <Text className="text-base font-semibold text-accent dark:text-accent-dark">
                        Volume PR
                      </Text>
                      <Text className="text-sm leading-5 text-muted dark:text-muted-dark">
                        Beat your highest total volume from any saved session, not just the previous
                        session. Volume is weight × reps, added across all sets of this exercise.
                      </Text>
                      <Text className="text-sm font-medium text-ink dark:text-ink-dark">
                        This workout: {formatNumber(current?.volume ?? 0)} kg
                      </Text>
                      <Text className="text-sm text-ink dark:text-ink-dark">
                        All-time best:{' '}
                        {baseline.volume === null
                          ? 'No saved record'
                          : `${formatNumber(baseline.volume)} kg`}
                      </Text>
                      <Text className="text-sm font-semibold text-accent dark:text-accent-dark">
                        {baseline.volume === null
                          ? 'Save a workout to establish your first record.'
                          : improvements?.volume
                            ? 'Earned in this draft'
                            : 'Not yet — your total must be higher than the all-time best.'}
                      </Text>
                    </View>
                    <View className="gap-1 border-t border-line pt-3 dark:border-line-dark">
                      <Text className="text-base font-semibold text-accent dark:text-accent-dark">
                        Max set PR
                      </Text>
                      <Text className="text-sm leading-5 text-muted dark:text-muted-dark">
                        Lift more than your heaviest saved set, or do more reps at that same weight.
                        Matching it does not count. Extra reps at a lighter weight are not tracked
                        as a separate achievement.
                      </Text>
                      <Text className="text-sm font-medium text-ink dark:text-ink-dark">
                        This workout:{' '}
                        {current?.maxSet ? formatSet(current.maxSet) : 'No weighted sets yet'}
                      </Text>
                      <Text className="text-sm text-ink dark:text-ink-dark">
                        All-time best:{' '}
                        {baseline.maxSet ? formatSet(baseline.maxSet) : 'No saved record'}
                      </Text>
                      <Text className="text-sm font-semibold text-accent dark:text-accent-dark">
                        {!baseline.maxSet
                          ? 'Save a workout to establish your first record.'
                          : improvements?.maxSet
                            ? 'Earned in this draft'
                            : `Not yet — lift over ${formatNumber(baseline.maxSet.weightKg)} kg, or do at least ${baseline.maxSet.reps + 1} reps at ${formatNumber(baseline.maxSet.weightKg)} kg.`}
                      </Text>
                    </View>
                    <Text className="text-xs leading-4 text-muted dark:text-muted-dark">
                      Both badges update as you log or edit sets. Settling an exercise only marks it
                      complete for you.
                    </Text>
                  </View>
                )}
              </ScrollView>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close achievement info"
                onPress={close}
                className="mt-4 min-h-11 items-center justify-center rounded-lg border border-accent dark:border-accent-dark"
              >
                <Text className="text-sm font-semibold text-accent dark:text-accent-dark">
                  Got it
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}
