import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import {
  formatSetSummary,
  type WorkoutHistorySet,
} from '@/features/workout/history-format';
import { SetMeasurement } from '@/features/workout/set-measurement';
import { useAppTheme } from './theme-provider';

export function WorkoutHistoryExercise({
  name,
  sets,
}: {
  name: string;
  sets: WorkoutHistorySet[];
}) {
  const [expanded, setExpanded] = useState(false);
  const { colors } = useAppTheme();
  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <View className="rounded-2xl bg-soft dark:bg-soft-dark">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${formatSetSummary(sets) || 'No sets'}`}
        accessibilityHint={expanded ? 'Collapse set details' : 'Expand set details'}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        className="min-h-12 flex-row items-center gap-3 px-3 py-3 active:opacity-70"
      >
        <Text className="flex-1 text-[15px] leading-6 text-ink dark:text-ink-dark">
          <Text className="font-bold">{name}</Text>{' '}
          <Text className="text-muted dark:text-muted-dark">
            ({sets.length
              ? sets.map((set, index) => (
                  <Text key={index}>
                    {index > 0 ? ',  ' : null}
                    <SetMeasurement set={set} compact />
                  </Text>
                ))
              : 'No sets'})
          </Text>
        </Text>
        <Chevron color={colors.muted} size={18} />
      </Pressable>
      {expanded ? (
        <View className="mx-3 border-t border-line pb-2 pt-1 dark:border-line-dark">
          {sets.length ? (
            sets.map((set, index) => (
              <View key={index} className="flex-row items-start gap-3 py-2">
                <Text className="w-12 text-sm leading-5 text-muted dark:text-muted-dark">
                  Set {index + 1}
                </Text>
                <SetMeasurement set={set} compact className="flex-1 leading-5" />
              </View>
            ))
          ) : (
            <Text className="py-2 text-sm text-muted dark:text-muted-dark">No sets recorded.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}
