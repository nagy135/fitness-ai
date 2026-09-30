import { Pressable, Text, View } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@fitness/convex/api';
import type { Id } from '@fitness/convex/data-model';
import { recordMetrics } from '@fitness/domain';
import { formatSet } from './history-format';

const labels = {
  weightKg: 'Max weight',
  reps: 'Max reps',
  durationSeconds: 'Longest duration',
  distanceMeters: 'Longest distance',
};
const date = (timestamp: number) => new Date(timestamp).toLocaleDateString();

export function ExerciseRecords({
  exerciseId,
  name,
  busy,
  onExample,
}: {
  exerciseId: Id<'exercises'>;
  name: string;
  busy: boolean;
  onExample: (text: string) => void;
}) {
  const records = useQuery(api.analysis.getExerciseRecords, { exerciseId });
  const canCopy =
    records?.previous?.sets.every((set) =>
      recordMetrics.some((metric) => set[metric] !== undefined),
    ) ?? false;
  return (
    <View className="gap-2 border-b border-line bg-canvas px-4 py-3 dark:border-line-dark dark:bg-canvas-dark">
      <Text className="text-sm font-semibold text-ink dark:text-ink-dark">Previous session</Text>
      {records === undefined ? (
        <Text accessibilityRole="progressbar" className="text-sm text-muted dark:text-muted-dark">
          Loading saved records…
        </Text>
      ) : records.previous ? (
        <>
          <Text className="text-xs text-muted dark:text-muted-dark">
            {date(records.previous.performedAt)} · {records.previous.sets.length} sets
          </Text>
          {records.previous.sets.map((set, index) => (
            <Text key={index} className="text-sm text-ink dark:text-ink-dark">
              {index + 1}. {formatSet(set)}
            </Text>
          ))}
          <Text className="mt-2 text-sm font-semibold text-ink dark:text-ink-dark">
            All-time maximums
          </Text>
          {records.maximums.map((record) => (
            <Text key={record.metric} className="text-sm text-muted dark:text-muted-dark">
              {labels[record.metric]}: {formatSet(record.set)} · {date(record.performedAt)}
            </Text>
          ))}
          {!canCopy ? (
            <Text className="text-sm text-muted dark:text-muted-dark">
              This session has sets that no longer match the exercise’s tracking type. Log new
              measurements to repeat it.
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Log previous record for ${name}`}
            accessibilityHint="Fills the prompt to append every set from the previous session"
            accessibilityState={{ disabled: busy || !canCopy }}
            disabled={busy || !canCopy}
            onPress={() => onExample(`Log previous record for ${name}`)}
            className={`min-h-11 justify-center self-start rounded-lg px-3 active:opacity-70 ${busy || !canCopy ? 'opacity-40' : ''}`}
          >
            <Text className="text-sm font-semibold text-accent dark:text-accent-dark">
              Log previous record
            </Text>
          </Pressable>
        </>
      ) : (
        <Text className="text-sm text-muted dark:text-muted-dark">No saved records yet.</Text>
      )}
    </View>
  );
}
