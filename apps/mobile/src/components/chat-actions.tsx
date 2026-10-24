import { Pressable, Text, View } from 'react-native';
import {
  ChartNoAxesCombined,
  ChevronRight,
  Dumbbell,
  MessageSquareText,
} from 'lucide-react-native';
import { IconButton, type FitnessMode } from '@fitness/ui';
import { useAppTheme } from './theme-provider';

export function ChatActions({
  mode,
  chatOpen,
  busy,
  hasSets,
  editing,
  onToggleChat,
  onReview,
}: {
  mode: FitnessMode;
  chatOpen: boolean;
  busy: boolean;
  hasSets: boolean;
  editing: boolean;
  onToggleChat: () => void;
  onReview: () => void;
}) {
  const { colors } = useAppTheme();
  const ToggleIcon = chatOpen
    ? mode === 'workout'
      ? Dumbbell
      : ChartNoAxesCombined
    : MessageSquareText;
  const reviewDisabled = busy || !hasSets;

  return (
    <View className="flex-row items-center justify-between px-5" style={{ flexShrink: 0 }}>
      <IconButton
        accessibilityLabel={
          chatOpen ? (mode === 'workout' ? 'Back to workout' : 'Back to analysis') : 'Open chat'
        }
        accessibilityState={{ expanded: chatOpen }}
        onPress={onToggleChat}
        className="border border-line bg-panel active:opacity-60 dark:border-line-dark dark:bg-panel-dark"
      >
        <ToggleIcon size={22} strokeWidth={2} color={colors.text} />
      </IconButton>
      {mode === 'workout' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editing ? 'Review changes' : 'Review workout'}
          accessibilityState={{ disabled: reviewDisabled }}
          disabled={reviewDisabled}
          onPress={onReview}
          className={`min-h-11 flex-row items-center gap-1 rounded-xl border border-line bg-panel px-3 active:opacity-60 dark:border-line-dark dark:bg-panel-dark${reviewDisabled ? ' opacity-40' : ''}`}
        >
          <Text className="text-sm font-semibold text-ink dark:text-ink-dark">
            {editing ? 'Review changes' : 'Review'}
          </Text>
          <ChevronRight size={16} color={colors.text} />
        </Pressable>
      ) : null}
    </View>
  );
}
