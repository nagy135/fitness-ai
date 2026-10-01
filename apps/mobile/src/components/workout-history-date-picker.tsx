import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@fitness/ui';
import { historyDayKey } from '../features/workout/history-calendar';
import { WorkoutHistoryCalendar } from './workout-history-calendar';

export function WorkoutHistoryDatePicker({
  performedAt,
  onReview,
  onCancel,
}: {
  performedAt: number;
  onReview: (performedAt: number) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [selectedDate, setSelectedDate] = useState(() => new Date(performedAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const locked = useRef(false);
  const changed = historyDayKey(selectedDate) !== historyDayKey(performedAt);

  async function review() {
    if (!changed || locked.current) return;
    locked.current = true;
    setSaving(true);
    setError(undefined);
    try {
      // Local noon keeps the saved workout on the calendar day the user picked,
      // including across daylight-saving transitions and UTC date boundaries.
      await onReview(
        new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          12,
        ).getTime(),
      );
    } catch {
      setError(
        'Could not change the date. Finish any current edit or AI request, check your connection, and try again.',
      );
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }

  return (
    <View className="mt-3 gap-3">
      <Text className="text-base font-bold text-ink dark:text-ink-dark">Change workout date</Text>
      <WorkoutHistoryCalendar
        selectedDate={selectedDate}
        onSelectDate={(date) => {
          if (!locked.current) setSelectedDate(date);
        }}
        workoutCounts={new Map([[historyDayKey(performedAt), 1]])}
      />
      <Text accessibilityLiveRegion="polite" className="text-sm text-muted dark:text-muted-dark">
        {selectedDate.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
        {' · Review and save to update history.'}
      </Text>
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-danger dark:text-danger-dark">
          {error}
        </Text>
      ) : null}
      <Button disabled={!changed} loading={saving} onPress={() => void review()}>
        Review date change
      </Button>
      <Button variant="ghost" disabled={saving} onPress={onCancel}>
        Cancel date change
      </Button>
    </View>
  );
}
