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
  const { colors, isDark } = useAppTheme();
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
        accessibilityHint="Shows your current numbers and records to beat"
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
                    Loading…
                  </Text>
                ) : !supported ? (
                  <Text className="text-sm text-muted dark:text-muted-dark">
                    No weight/reps records
                  </Text>
                ) : (
                  <View className="gap-3">
                    <View className="flex-row gap-3">
                      <Text className="flex-1 text-xs text-muted dark:text-muted-dark">PR</Text>
                      <Text className="flex-1 text-right text-xs text-muted dark:text-muted-dark">
                        Now
                      </Text>
                      <Text className="flex-1 text-right text-xs text-muted dark:text-muted-dark">
                        To beat
                      </Text>
                    </View>
                    {[
                      {
                        label: 'Volume',
                        value: `${formatNumber(current?.volume ?? 0)} kg`,
                        target:
                          baseline.volume === null ? '—' : `${formatNumber(baseline.volume)} kg`,
                        hasRecord: baseline.volume !== null,
                        improved: improvements?.volume,
                        tied: current?.volume === baseline.volume,
                      },
                      {
                        label: 'Max set',
                        value: current?.maxSet ? formatSet(current.maxSet) : '—',
                        target: baseline.maxSet ? formatSet(baseline.maxSet) : '—',
                        hasRecord: baseline.maxSet !== null,
                        improved: improvements?.maxSet,
                        tied:
                          current?.maxSet?.weightKg === baseline.maxSet?.weightKg &&
                          current?.maxSet?.reps === baseline.maxSet?.reps,
                      },
                    ].map(({ label, value, target, hasRecord, improved, tied }) => (
                      <View
                        key={label}
                        className="flex-row items-center gap-3 border-t border-line pt-3 dark:border-line-dark"
                      >
                        <Text className="flex-1 text-sm font-semibold text-ink dark:text-ink-dark">
                          {label}
                        </Text>
                        <Text
                          accessibilityLabel={`${label}: ${value}, ${!hasRecord ? 'no saved record' : improved ? 'above record' : tied ? 'tied with record' : 'below record'}`}
                          className="flex-1 text-right text-sm font-semibold"
                          style={{
                            color: !hasRecord
                              ? colors.muted
                              : improved
                                ? isDark
                                  ? '#4ade80'
                                  : '#15803d'
                                : colors.danger,
                          }}
                        >
                          {value}
                        </Text>
                        <Text className="flex-1 text-right text-sm text-ink dark:text-ink-dark">
                          {target}
                        </Text>
                      </View>
                    ))}
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
