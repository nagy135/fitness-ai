import { View } from 'react-native';
import { Button } from '@fitness/ui';

export function WorkoutReviewBar({
  busy,
  hasSets,
  editing,
  onChat,
  onReview,
}: {
  busy: boolean;
  hasSets: boolean;
  editing: boolean;
  onChat: () => void;
  onReview: () => void;
}) {
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
