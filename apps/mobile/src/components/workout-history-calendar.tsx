import { Pressable, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { cn, IconButton } from '@fitness/ui';
import { historyDayKey, historyMonthWeeks } from '@/features/workout/history-calendar';
import { useAppTheme } from './theme-provider';

export function WorkoutHistoryCalendar({
  selectedDate,
  onSelectDate,
  workoutCounts,
}: {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  workoutCounts: ReadonlyMap<string, number>;
}) {
  const { colors } = useAppTheme();
  const today = new Date();
  const todayKey = historyDayKey(today);
  const selectedKey = historyDayKey(selectedDate);
  const weeks = historyMonthWeeks(selectedDate);

  function changeMonth(offset: number) {
    onSelectDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1));
  }

  return (
    <View className="rounded-3xl border border-line bg-panel p-3 dark:border-line-dark dark:bg-panel-dark">
      <View className="flex-row items-center justify-between">
        <IconButton accessibilityLabel="Previous month" onPress={() => changeMonth(-1)}>
          <ChevronLeft color={colors.text} size={20} />
        </IconButton>
        <Text
          accessibilityRole="header"
          className="flex-1 text-center text-base font-bold text-ink dark:text-ink-dark"
        >
          {selectedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <IconButton accessibilityLabel="Next month" onPress={() => changeMonth(1)}>
          <ChevronRight color={colors.text} size={20} />
        </IconButton>
      </View>
      <View className="mb-1 mt-3 flex-row">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <Text
            key={day}
            className="flex-1 text-center text-xs font-semibold text-muted dark:text-muted-dark"
          >
            {day}
          </Text>
        ))}
      </View>
      {weeks.map((week, index) => (
        <View key={index} className="flex-row">
          {week.map((date, weekday) => {
            if (!date) return <View key={`blank-${weekday}`} className="flex-1" />;
            const key = historyDayKey(date);
            const selected = key === selectedKey;
            const count = workoutCounts.get(key) ?? 0;
            const isToday = key === todayKey;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${isToday ? ', today' : ''}, ${count} ${count === 1 ? 'workout' : 'workouts'}`}
                accessibilityState={{ selected }}
                onPress={() => onSelectDate(date)}
                className={cn(
                  'min-h-12 flex-1 items-center justify-center rounded-xl border py-1 active:opacity-70',
                  selected
                    ? 'border-accent bg-accent dark:border-accent-dark dark:bg-accent-dark'
                    : isToday
                      ? 'border-accent dark:border-accent-dark'
                      : 'border-transparent',
                )}
              >
                <Text
                  className={cn(
                    'text-sm font-semibold',
                    selected
                      ? 'text-accent-ink dark:text-accent-ink-dark'
                      : 'text-ink dark:text-ink-dark',
                  )}
                >
                  {date.getDate()}
                </Text>
                <View
                  className={cn(
                    'mt-1 h-1 w-1 rounded-full',
                    count
                      ? selected
                        ? 'bg-accent-ink dark:bg-accent-ink-dark'
                        : 'bg-accent dark:bg-accent-dark'
                      : 'bg-transparent',
                  )}
                />
              </Pressable>
            );
          })}
        </View>
      ))}
      <View className="mt-2 flex-row items-center justify-between border-t border-line pt-1 dark:border-line-dark">
        <View className="flex-row items-center gap-2">
          <View className="h-1.5 w-1.5 rounded-full bg-accent dark:bg-accent-dark" />
          <Text className="text-xs text-muted dark:text-muted-dark">Saved workout</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go to today"
          onPress={() => onSelectDate(new Date())}
          className="min-h-11 justify-center px-3 active:opacity-70"
        >
          <Text className="text-sm font-bold text-accent dark:text-accent-dark">Today</Text>
        </Pressable>
      </View>
    </View>
  );
}
