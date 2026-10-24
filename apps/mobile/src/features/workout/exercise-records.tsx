import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useQuery } from 'convex/react';
import { api } from '@fitness/convex/api';
import type { Id } from '@fitness/convex/data-model';
import { recordMetrics, type WorkoutSet } from '@fitness/domain';
import { useAppTheme } from '@/components/theme-provider';
import { formatNumber, formatSet } from './history-format';

const date = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
const columns = [
  { field: 'weightKg', label: 'kg' },
  { field: 'reps', label: 'Reps' },
  { field: 'durationSeconds', label: 'sec' },
  { field: 'distanceMeters', label: 'm' },
] as const;

function PreviousSets({ sets }: { sets: WorkoutSet[] }) {
  const visibleColumns = columns.filter(({ field }) =>
    sets.some((set) => set[field] !== undefined),
  );
  return (
    <View>
      <View className="flex-row border-b border-line py-1 dark:border-line-dark">
        <Text className="w-9 text-xs text-muted dark:text-muted-dark">Set</Text>
        {visibleColumns.map(({ field, label }) => (
          <Text key={field} className="flex-1 text-right text-xs text-muted dark:text-muted-dark">
            {label}
          </Text>
        ))}
      </View>
      {sets.map((set, index) => (
        <View
          key={index}
          accessible
          accessibilityLabel={`Previous set ${index + 1}: ${formatSet(set)}`}
          className="min-h-7 flex-row items-center border-b border-line/50 py-1 dark:border-line-dark/50"
        >
          <Text className="w-9 text-xs text-muted dark:text-muted-dark">{index + 1}</Text>
          {visibleColumns.length ? (
            visibleColumns.map(({ field }) => (
              <Text
                key={field}
                className="flex-1 text-right text-sm font-medium text-ink dark:text-ink-dark"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {set[field] === undefined ? '—' : formatNumber(set[field])}
              </Text>
            ))
          ) : (
            <Text className="flex-1 text-right text-sm text-muted dark:text-muted-dark">
              No measurements
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

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
  const [expanded, setExpanded] = useState(false);
  const { colors } = useAppTheme();
  const records = useQuery(api.analysis.getExerciseRecords, expanded ? { exerciseId } : 'skip');
  const maximumWeight = records?.maximums.find((record) => record.metric === 'weightKg');
  const canCopy =
    records?.previous?.sets.every((set) =>
      recordMetrics.some((metric) => set[metric] !== undefined),
    ) ?? false;
  return (
    <View className="mx-2 my-1 overflow-hidden rounded-lg border border-line bg-panel dark:border-line-dark dark:bg-panel-dark">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Previous session and max weight for ${name}`}
        accessibilityHint={expanded ? 'Hide saved records' : 'Show saved records'}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((previous) => !previous)}
        className={`min-h-8 flex-row items-center justify-between gap-2 bg-soft/50 px-3 py-1 active:opacity-70 dark:bg-soft-dark/50 ${expanded ? 'border-b border-line dark:border-line-dark' : ''}`}
      >
        <Text className="flex-1 text-xs font-semibold text-muted dark:text-muted-dark">
          Previous session & max weight
        </Text>
        {expanded ? (
          <ChevronUp size={18} color={colors.muted} />
        ) : (
          <ChevronDown size={18} color={colors.muted} />
        )}
      </Pressable>
      {expanded ? (
        <View className="gap-1 px-3 pb-2 pt-1">
          {records === undefined ? (
            <Text
              accessibilityRole="progressbar"
              className="text-sm text-muted dark:text-muted-dark"
            >
              Loading saved records…
            </Text>
          ) : (
            <>
              {records.previous ? (
                <>
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="text-xs font-medium text-muted dark:text-muted-dark">
                      {date(records.previous.performedAt)}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Log previous record for ${name}`}
                      accessibilityHint="Fills the prompt to append every set from the previous session"
                      accessibilityState={{ disabled: busy || !canCopy }}
                      disabled={busy || !canCopy}
                      onPress={() => onExample(`Log previous record for ${name}`)}
                      className={`min-h-7 justify-center rounded-lg border border-accent px-3 py-1 active:bg-soft dark:border-accent-dark dark:active:bg-soft-dark ${busy || !canCopy ? 'opacity-40' : ''}`}
                    >
                      <Text className="text-xs font-semibold text-accent dark:text-accent-dark">
                        Log these sets
                      </Text>
                    </Pressable>
                  </View>
                  <PreviousSets sets={records.previous.sets} />
                  {!canCopy ? (
                    <Text className="text-sm text-muted dark:text-muted-dark">
                      This session has sets that no longer match the exercise’s tracking type. Log
                      new measurements to repeat it.
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text className="text-sm text-muted dark:text-muted-dark">
                  No previous session available.
                </Text>
              )}
              {maximumWeight ? (
                <View className="mt-1 flex-row flex-wrap items-center justify-between gap-x-2 gap-y-0.5 pt-1">
                  <Text className="text-xs text-muted dark:text-muted-dark">
                    Max weight{' '}
                    <Text className="font-semibold text-ink dark:text-ink-dark">
                      {formatSet({
                        weightKg: maximumWeight.set.weightKg,
                        reps: maximumWeight.set.reps,
                      })}
                    </Text>
                  </Text>
                  <Text className="text-xs text-muted dark:text-muted-dark">
                    {date(maximumWeight.performedAt)}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}
