import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { Button, IconButton } from '@fitness/ui';
import { useAppTheme } from './theme-provider';

export function WorkoutHistoryRecordActions({
  dateLabel,
  onDelete,
  onEdit,
}: {
  dateLabel: string;
  onDelete: () => Promise<unknown>;
  onEdit?: () => Promise<unknown>;
}) {
  const { colors } = useAppTheme();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();
  const locked = useRef(false);

  async function confirmDelete() {
    if (!confirming || locked.current) return;
    locked.current = true;
    setDeleting(true);
    setError(undefined);
    try {
      await onDelete();
      setConfirming(false);
    } catch {
      setError('Could not delete this workout. Check your connection and try again.');
    } finally {
      locked.current = false;
      setDeleting(false);
    }
  }

  async function editWorkout() {
    if (!onEdit || locked.current) return;
    locked.current = true;
    setDeleting(true);
    setError(undefined);
    try {
      await onEdit();
    } catch {
      setError('Could not open this workout. Finish any current edit or AI request and try again.');
    } finally {
      locked.current = false;
      setDeleting(false);
    }
  }

  return (
    <View>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-accent dark:text-accent-dark">
          {dateLabel}
        </Text>
        {onEdit ? (
          <IconButton
            accessibilityLabel={`Edit workout from ${dateLabel}`}
            disabled={confirming || deleting}
            onPress={() => void editWorkout()}
          >
            <Pencil color={colors.accent} size={20} />
          </IconButton>
        ) : null}
        <IconButton
          accessibilityLabel={`Delete workout from ${dateLabel}`}
          accessibilityState={{ disabled: confirming || deleting, expanded: confirming }}
          disabled={confirming || deleting}
          onPress={() => setConfirming(true)}
        >
          <Trash2 color={colors.danger} size={20} />
        </IconButton>
      </View>
      {error && !confirming ? (
        <Text accessibilityRole="alert" className="text-sm text-danger dark:text-danger-dark">
          {error}
        </Text>
      ) : null}
      {confirming ? (
        <View
          accessibilityLiveRegion="polite"
          className="mt-3 gap-3 rounded-2xl bg-soft p-4 dark:bg-soft-dark"
        >
          <Text className="text-base font-bold text-ink dark:text-ink-dark">Delete workout?</Text>
          <Text className="text-sm leading-5 text-muted dark:text-muted-dark">
            This will permanently remove this workout from your history. This cannot be undone.
          </Text>
          {error ? (
            <Text accessibilityRole="alert" className="text-sm text-danger dark:text-danger-dark">
              {error}
            </Text>
          ) : null}
          <View className="flex-row flex-wrap gap-2">
            <Button
              className="flex-1"
              variant="secondary"
              disabled={deleting}
              onPress={() => {
                setConfirming(false);
                setError(undefined);
              }}
            >
              Cancel
            </Button>
            <Button
              accessibilityLabel="Confirm delete workout"
              className="flex-1"
              variant="destructive"
              loading={deleting}
              onPress={() => void confirmDelete()}
            >
              Delete
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}
