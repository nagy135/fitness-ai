import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Button } from '@fitness/ui';
import type { WorkoutExchange } from './latest-workout-exchange';
import { shouldAutoOpenWorkoutChat } from './workout-chat-visibility';

export function WorkoutReviewBar({
  response,
  busy,
  hasSets,
  editing,
  onChat,
  onReview,
}: {
  response?: WorkoutExchange;
  busy: boolean;
  hasSets: boolean;
  editing: boolean;
  onChat: () => void;
  onReview: () => void;
}) {
  const previousResponseId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (previousResponseId.current === response?.id) return;
    previousResponseId.current = response?.id;
    if (response && shouldAutoOpenWorkoutChat(response.toolCalls)) onChat();
  }, [onChat, response]);

  return (
    <View className="px-5 pb-2" style={{ flexShrink: 0 }}>
      <View className="flex-row items-center gap-2" style={{ height: 48 }}>
        <View style={{ flex: 1 }}>
          <Button
            variant="secondary"
            className="px-2"
            style={{ height: 48 }}
            accessibilityLabel="Open chat"
            onPress={onChat}
          >
            Chat →
          </Button>
        </View>
        <View style={{ flex: 2 }}>
          <Button variant="secondary" disabled={busy || !hasSets} onPress={onReview}>
            {editing ? 'Review changes' : 'Review workout'}
          </Button>
        </View>
      </View>
    </View>
  );
}
