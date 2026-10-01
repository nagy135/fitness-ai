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
      headerLeft={
        <IconButton accessibilityLabel="Back to workout" disabled={saving} onPress={back}>
          <ArrowLeft color={colors.text} size={22} />
        </IconButton>
      }
    >
      <View className="px-5 pb-2 pt-1">
        <DisplayText className="text-[32px] leading-[38px]">Review workout.</DisplayText>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-3"
        keyboardShouldPersistTaps="handled"
      >
        {draft ? (
          <View className="gap-3">
            <Text className="text-sm text-muted dark:text-muted-dark">Workout date</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change workout date"
              accessibilityHint="Choose a date to save with this workout"
              accessibilityState={{ expanded: datePickerOpen, disabled: saving }}
              disabled={saving}
              onPress={() => setDatePickerOpen((open) => !open)}
              className="min-h-12 flex-row items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 active:opacity-70 dark:border-line-dark dark:bg-panel-dark"
            >
              <CalendarDays size={21} color={colors.accent} />
              <Text className="flex-1 text-base font-bold text-ink dark:text-ink-dark">
                {selectedDate.toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
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
        <View className="gap-2">
          <Input
            label="Workout name (optional)"
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
              className="text-sm text-muted dark:text-muted-dark"
            >
              {suggesting ? 'Suggesting a name…' : 'Add a name or leave it blank.'}
            </Text>
          ) : null}
        </View>
        {draft?.exercises.map((exercise) => {
          const trackingType =
            catalog.find((item) => item._id === exercise.exerciseId)?.trackingType ?? 'custom';
          return (
            <View key={exercise.rowId}>
              <Text className="mb-3 text-xl font-bold text-ink dark:text-ink-dark">
                {exercise.name}
              </Text>
              <View className="rounded-[20px] bg-panel px-4 dark:border-line-dark dark:bg-panel-dark">
                {exercise.sets.map((set, index) => (
                  <View
                    className={`flex-row items-center gap-3 py-4 ${index ? 'border-t border-line dark:border-line-dark' : ''}`}
                    key={set.setId}
                  >
                    <Text className="w-10 text-sm text-muted dark:text-muted-dark">
                      Set {index + 1}
                    </Text>
                    <SetMeasurement
                      set={normalizeSetForTrackingType(set, trackingType)}
                      className="flex-1 leading-9"
                    />
                    <Check color={colors.accent} size={17} />
                  </View>
                ))}
              </View>
              {!exercise.sets.length ? (
                <Text className="mt-2 text-sm text-danger dark:text-danger-dark">
                  Add a set or remove this exercise to continue.
                </Text>
              ) : null}
              {exercise.notes ? (
                <Text className="mt-2 text-sm text-muted dark:text-muted-dark">
                  {exercise.notes}
                </Text>
              ) : null}
            </View>
          );
        })}
        {draft?.notes ? (
          <Text className="text-base text-muted dark:text-muted-dark">{draft.notes}</Text>
        ) : null}
        {!canConfirm && !saving ? (
          <Text className="text-sm text-danger dark:text-danger-dark">
            Each exercise needs a set and a matching exercise in your library before saving.
          </Text>
        ) : null}
      </ScrollView>
      <ErrorNotice message={error} />
      <View className="gap-2 border-t border-line px-5 py-3 dark:border-line-dark">
        <View className="flex-row gap-2">
          <Button
            className="flex-1 px-2"
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
            className="flex-1 px-2"
            variant="secondary"
            accessibilityLabel="Continue workout"
            disabled={saving}
            onPress={back}
          >
            Back
          </Button>
          <Button
            className="flex-1 px-2"
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
            className="gap-3 rounded-2xl bg-soft p-4 dark:bg-soft-dark"
          >
            <Text className="text-base font-bold text-ink dark:text-ink-dark">
              {draft?.editingWorkoutId ? 'Discard changes?' : 'Discard this workout?'}
            </Text>
            <Text className="text-sm leading-5 text-muted dark:text-muted-dark">
              {draft?.editingWorkoutId
                ? 'Your saved workout will stay unchanged. You’ll leave workout mode.'
                : 'All exercises and sets in this draft will be removed. You’ll leave workout mode.'}
            </Text>
            <View className="flex-row gap-2">
              <Button
                className="flex-1"
                variant="secondary"
                disabled={saving}
                onPress={() => setConfirmingDiscard(false)}
              >
                Keep
              </Button>
              <Button
                className="flex-1"
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
