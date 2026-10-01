import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button } from '@fitness/ui';
import type { WorkoutExchange } from './latest-workout-exchange';

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
  const [previousResponse, setPreviousResponse] = useState(response?.id);
  const [visible, setVisible] = useState(!!response);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  if (previousResponse !== response?.id) {
    setPreviousResponse(response?.id);
    setVisible(!!response);
  }
  useEffect(() => {
    if (response?.id) timer.current = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(timer.current);
  }, [response?.id]);

  return (
    <View className="px-5 pb-2" style={{ flexShrink: 0 }}>
      {visible && response ? (
        <View className="mb-2 rounded-xl bg-soft px-4 py-3 dark:bg-soft-dark">
          <ScrollView style={{ maxHeight: 120, flexGrow: 0 }} nestedScrollEnabled>
            <Text className="text-xs font-bold text-muted dark:text-muted-dark">You</Text>
            <Text selectable className="mb-2 text-sm leading-5 text-ink dark:text-ink-dark">
              {response.prompt}
            </Text>
            <Text className="text-xs font-bold text-muted dark:text-muted-dark">AI</Text>
            <Text selectable className="text-sm leading-5 text-ink dark:text-ink-dark">
              {response.text}
            </Text>
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
                clearTimeout(timer.current);
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
