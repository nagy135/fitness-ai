import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, CalendarDays, Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { api } from '@fitness/convex/api';
import { normalizeSetForTrackingType } from '@fitness/domain';
import { Button, IconButton, Input } from '@fitness/ui';
import { LoadingScreen } from '@/components/loading-screen';
import { useAppTheme } from '@/components/theme-provider';
import { Screen } from '@/components/screen';
import { ErrorNotice } from '@/components/error-notice';
import { DisplayText } from '@/components/display-text';
import { useWorkoutName } from './use-workout-name';
import { SetMeasurement } from './set-measurement';
import { WorkoutHistoryCalendar } from '@/components/workout-history-calendar';

export default function ConfirmWorkoutScreen() {
  const { colors } = useAppTheme();
  const draft = useQuery(api.workoutDrafts.current, {});
  const { name, setName, suggesting, suggestionFailed } = useWorkoutName(draft);
  const catalog = useQuery(api.exercises.list, { includeArchived: true });
  const confirm = useMutation(api.workouts.confirmDraft);
  const discard = useMutation(api.workouts.discardDraft);
  const [today] = useState(() => new Date());
  const [dateSelection, setDateSelection] = useState<{ draftId: string; date: Date }>();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const selectedDate =
    dateSelection?.draftId === draft?._id && dateSelection
      ? dateSelection.date
      : draft?.editingWorkoutId
        ? new Date(draft.performedAt ?? `${draft.date}T12:00:00`)
        : today;
  const [saving, setSaving] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [error, setError] = useState<string>();
  const locked = useRef(false);
  if (draft === undefined || catalog === undefined)
    return <LoadingScreen label="Loading your workout…" />;
  if (!draft && !saving) return <Redirect href="/?mode=analysis" />;
  const canConfirm =
    !!draft?.exercises.length && draft.exercises.every((row) => row.exerciseId && row.sets.length);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  async function finish() {
    if (!draft || !canConfirm || locked.current) return;
    locked.current = true;
    setDatePickerOpen(false);
    setSaving(true);
    setError(undefined);
    try {
      const performedAt =
        draft.editingWorkoutId && dateSelection?.draftId !== draft._id
          ? selectedDate.getTime()
          : new Date(
              selectedDate.getFullYear(),
              selectedDate.getMonth(),
              selectedDate.getDate(),
              12,
            ).getTime();
      await confirm({ draftId: draft._id, name, performedAt });
      router.replace(draft.editingWorkoutId ? '/?mode=workout' : '/?mode=analysis');
    } catch {
      setError('Your workout could not be saved. Check your connection and try again.');
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }
  async function discardAndExit() {
    if (!draft || !confirmingDiscard || locked.current) return;
    locked.current = true;
    setSaving(true);
    setError(undefined);
    try {
      await discard({ draftId: draft._id });
      router.replace('/?mode=analysis');
    } catch {
      setError('Could not discard this workout. Check your connection and try again.');
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }
  return (
    <Screen
      compact
      headerLeft={
        <View className="flex-1 flex-row items-center gap-2">
          <IconButton accessibilityLabel="Back to workout" disabled={saving} onPress={back}>
            <ArrowLeft color={colors.text} size={22} />
          </IconButton>
          <DisplayText className="flex-1 text-[26px] leading-8">Review workout</DisplayText>
        </View>
      }
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2 px-5 pb-2 pt-1"
        keyboardShouldPersistTaps="handled"
      >
        {draft ? (
          <View className="gap-1">
            <Text className="text-xs text-muted dark:text-muted-dark">Workout date</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change workout date"
              accessibilityHint="Choose a date to save with this workout"
              accessibilityState={{ expanded: datePickerOpen, disabled: saving }}
              disabled={saving}
              onPress={() => setDatePickerOpen((open) => !open)}
              className="min-h-10 flex-row items-center gap-2 rounded-xl border border-line bg-panel px-3 py-1.5 active:opacity-70 dark:border-line-dark dark:bg-panel-dark"
            >
              <CalendarDays size={18} color={colors.accent} />
              <Text className="flex-1 text-sm font-semibold text-ink dark:text-ink-dark">
                {selectedDate.toLocaleDateString(undefined, {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
              {datePickerOpen ? (
                <ChevronUp size={18} color={colors.muted} />
              ) : (
                <ChevronDown size={18} color={colors.muted} />
              )}
            </Pressable>
            {datePickerOpen ? (
              <WorkoutHistoryCalendar
                selectedDate={selectedDate}
                onSelectDate={(date) => {
                  if (!locked.current) setDateSelection({ draftId: draft._id, date });
                }}
              />
            ) : null}
          </View>
        ) : null}
        <View className="gap-1">
          <Input
            label="Workout name (optional)"
            className="min-h-10 px-3 py-1.5 text-sm"
            placeholder="Name this workout"
            value={name}
            onChangeText={setName}
            maxLength={100}
            editable={!saving}
            autoCapitalize="sentences"
            returnKeyType="done"
          />
          {suggesting || suggestionFailed ? (
            <Text
              accessibilityLiveRegion="polite"
              className="text-xs text-muted dark:text-muted-dark"
            >
              {suggesting ? 'Suggesting a name…' : 'Add a name or leave it blank.'}
            </Text>
          ) : null}
        </View>
        {draft?.exercises.map((exercise) => {
          const trackingType =
            catalog.find((item) => item._id === exercise.exerciseId)?.trackingType ?? 'custom';
          return (
            <View
              key={exercise.rowId}
              className="overflow-hidden rounded-xl border border-line bg-panel dark:border-line-dark dark:bg-panel-dark"
            >
              <View className="min-h-10 flex-row items-center gap-2 border-b border-line px-3 py-1.5 dark:border-line-dark">
                <Text className="flex-1 text-base font-semibold text-ink dark:text-ink-dark">
                  {exercise.name}
                </Text>
                <Text className="text-xs text-muted dark:text-muted-dark">
                  {exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}
                </Text>
              </View>
              {exercise.sets.map((set, index) => (
                <View
                  className={`min-h-11 flex-row items-center gap-2 px-3 py-1 ${index ? 'border-t border-line dark:border-line-dark' : ''}`}
                  key={set.setId}
                >
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-soft dark:bg-soft-dark">
                    <Text className="text-xs font-semibold text-muted dark:text-muted-dark">
                      {index + 1}
                    </Text>
                  </View>
                  <SetMeasurement
                    set={normalizeSetForTrackingType(set, trackingType)}
                    compact
                    className="flex-1 leading-6"
                  />
                  <Check color={colors.accent} size={15} />
                </View>
              ))}
              {!exercise.sets.length ? (
                <Text className="px-3 py-2 text-sm text-danger dark:text-danger-dark">
                  Add a set or remove this exercise to continue.
                </Text>
              ) : null}
              {exercise.notes ? (
                <Text className="px-3 pb-2 pt-1 text-xs text-muted dark:text-muted-dark">
                  {exercise.notes}
                </Text>
              ) : null}
            </View>
          );
        })}
        {draft?.notes ? (
          <Text className="text-sm text-muted dark:text-muted-dark">{draft.notes}</Text>
        ) : null}
        {!canConfirm && !saving ? (
          <Text className="text-sm text-danger dark:text-danger-dark">
            Each exercise needs a set and a matching exercise in your library before saving.
          </Text>
        ) : null}
      </ScrollView>
      <ErrorNotice message={error} />
      <View className="gap-2 border-t border-line px-5 py-2 dark:border-line-dark">
        <View className="flex-row gap-2">
          <Button
            className="min-h-11 flex-1 rounded-xl px-2 py-2"
            accessibilityLabel={
              draft?.editingWorkoutId ? 'Save workout changes' : 'Confirm workout'
            }
            disabled={!canConfirm || confirmingDiscard}
            loading={saving && !confirmingDiscard}
            onPress={() => void finish()}
          >
            Save
          </Button>
          <Button
            className="min-h-11 flex-1 rounded-xl px-2 py-2"
            variant="secondary"
            accessibilityLabel="Continue workout"
            disabled={saving}
            onPress={back}
          >
            Back
          </Button>
          <Button
            className="min-h-11 flex-1 rounded-xl px-2 py-2"
            variant="ghost"
            textClassName="text-danger dark:text-danger-dark"
            accessibilityLabel={
              draft?.editingWorkoutId ? 'Discard workout changes' : 'Discard workout'
            }
            disabled={saving || confirmingDiscard}
            onPress={() => setConfirmingDiscard(true)}
          >
            Discard
          </Button>
        </View>
        {confirmingDiscard ? (
          <View
            accessibilityLiveRegion="polite"
            className="gap-2 rounded-xl bg-soft p-3 dark:bg-soft-dark"
          >
            <Text className="text-sm font-bold text-ink dark:text-ink-dark">
              {draft?.editingWorkoutId ? 'Discard changes?' : 'Discard this workout?'}
            </Text>
            <Text className="text-sm leading-5 text-muted dark:text-muted-dark">
              {draft?.editingWorkoutId
                ? 'Your saved workout will stay unchanged. You’ll leave workout mode.'
                : 'All exercises and sets in this draft will be removed. You’ll leave workout mode.'}
            </Text>
            <View className="flex-row gap-2">
              <Button
                className="min-h-11 flex-1 rounded-xl py-2"
                variant="secondary"
                disabled={saving}
                onPress={() => setConfirmingDiscard(false)}
              >
                Keep
              </Button>
              <Button
                className="min-h-11 flex-1 rounded-xl py-2"
                variant="destructive"
                loading={saving}
                onPress={() => void discardAndExit()}
              >
                Discard
              </Button>
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
