import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button } from '@fitness/ui';
import type { WorkoutExchange } from './latest-workout-exchange';
import { shouldAutoOpenWorkoutHistory } from './workout-history-visibility';
import { ToolCallPills } from '@/components/tool-call-pills';
import { AnalysisMarkdown } from '@/components/analysis-markdown';

export function WorkoutReviewBar({
  response,
  busy,
  hasSets,
  editing,
  onReview,
}: {
  response?: WorkoutExchange;
  busy: boolean;
  hasSets: boolean;
  editing: boolean;
  onReview: () => void;
}) {
  const [previousResponseId, setPreviousResponseId] = useState(response?.id);
  const [visible, setVisible] = useState(
    () => !!response && shouldAutoOpenWorkoutHistory(response.toolCalls),
  );
  if (previousResponseId !== response?.id) {
    setPreviousResponseId(response?.id);
    setVisible(!!response && shouldAutoOpenWorkoutHistory(response.toolCalls));
  }

  return (
    <View className="px-5 pb-2" style={{ flexShrink: 0 }}>
      {visible && response ? (
        <View className="mb-2 rounded-xl bg-soft px-4 py-3 dark:bg-soft-dark">
          <ScrollView
            style={{ maxHeight: 240, flexGrow: 0 }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            <View className="mb-3 gap-1 border-b border-line pb-3 dark:border-line-dark">
              <Text className="text-sm font-bold text-accent dark:text-accent-dark">
                Your message
              </Text>
              <Text
                selectable
                className="text-base font-bold leading-6 text-ink dark:text-ink-dark"
              >
                {response.prompt}
              </Text>
            </View>
            <Text className="mb-1 text-sm font-bold text-muted dark:text-muted-dark">AI reply</Text>
            <AnalysisMarkdown text={response.text} compact />
            <ToolCallPills key={response.id} calls={response.toolCalls} />
          </ScrollView>
        </View>
      ) : null}
      <View className="flex-row items-center gap-2" style={{ height: 48 }}>
        {response ? (
          <View style={{ flex: 1 }}>
            <Button
              variant={visible ? 'primary' : 'secondary'}
              className="px-2"
              style={{ height: 48 }}
              accessibilityRole="switch"
              accessibilityLabel="Show reply history"
              accessibilityState={{ checked: visible, disabled: !response }}
              disabled={!response}
              onPress={() => {
                setVisible((previous) => !previous);
              }}
            >
              {visible ? 'History ▴' : 'History ▾'}
            </Button>
          </View>
        ) : null}
        <View style={{ flex: 2 }}>
          <Button variant="secondary" disabled={busy || !hasSets} onPress={onReview}>
            {editing ? 'Review changes' : 'Review workout'}
          </Button>
        </View>
      </View>
    </View>
  );
}
