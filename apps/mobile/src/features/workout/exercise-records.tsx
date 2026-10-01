import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useQuery } from 'convex/react';
import { api } from '@fitness/convex/api';
import type { Id } from '@fitness/convex/data-model';
import { recordMetrics } from '@fitness/domain';
import { useAppTheme } from '@/components/theme-provider';
import { formatSet } from './history-format';

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
  const [expanded, setExpanded] = useState(false);
  const { colors } = useAppTheme();
  const records = useQuery(api.analysis.getExerciseRecords, expanded ? { exerciseId } : 'skip');
  const maximumWeight = records?.maximums.find((record) => record.metric === 'weightKg');
  const canCopy =
    records?.previous?.sets.every((set) =>
      recordMetrics.some((metric) => set[metric] !== undefined),
    ) ?? false;
  return (
    <View className="border-b border-line bg-canvas dark:border-line-dark dark:bg-canvas-dark">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Previous session and max weight for ${name}`}
        accessibilityHint={expanded ? 'Hide saved records' : 'Show saved records'}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((previous) => !previous)}
        className="min-h-11 flex-row items-center justify-between gap-3 px-4 py-3 active:opacity-70"
      >
        <Text className="flex-1 text-sm font-semibold text-muted dark:text-muted-dark">
          Previous session & max weight
        </Text>
        {expanded ? (
          <ChevronUp size={18} color={colors.muted} />
        ) : (
          <ChevronDown size={18} color={colors.muted} />
        )}
      </Pressable>
      {expanded ? (
        <View className="gap-2 px-4 pb-3">
          {records === undefined ? (
            <Text
              accessibilityRole="progressbar"
              className="text-sm text-muted dark:text-muted-dark"
            >
              Loading saved records…
            </Text>
          ) : (
            <>
              {maximumWeight ? (
                <Text className="text-sm text-ink dark:text-ink-dark">
                  Max weight:{' '}
                  {formatSet({
                    weightKg: maximumWeight.set.weightKg,
                    reps: maximumWeight.set.reps,
                  })}{' '}
                  · {date(maximumWeight.performedAt)}
                </Text>
              ) : null}
              {records.previous ? (
                <>
                  <Text className="mt-2 text-sm font-semibold text-ink dark:text-ink-dark">
                    Previous session
                  </Text>
                  <Text className="text-xs text-muted dark:text-muted-dark">
                    {date(records.previous.performedAt)} · {records.previous.sets.length} sets
                  </Text>
                  {records.previous.sets.map((set, index) => (
                    <Text key={index} className="text-sm text-ink dark:text-ink-dark">
                      {index + 1}. {formatSet(set)}
                    </Text>
                  ))}
                  {!canCopy ? (
                    <Text className="text-sm text-muted dark:text-muted-dark">
                      This session has sets that no longer match the exercise’s tracking type. Log
                      new measurements to repeat it.
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
                <Text className="text-sm text-muted dark:text-muted-dark">
                  No previous session available.
                </Text>
              )}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}
