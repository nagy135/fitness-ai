import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Check } from 'lucide-react-native';
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

export default function ConfirmWorkoutScreen() {
  const { colors } = useAppTheme();
  const draft = useQuery(api.workoutDrafts.current, {});
  const { name, setName, suggesting, suggestionFailed } = useWorkoutName(draft);
  const catalog = useQuery(api.exercises.list, { includeArchived: true });
  const confirm = useMutation(api.workouts.confirmDraft);
  const discard = useMutation(api.workouts.discardDraft);
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
    setSaving(true);
    setError(undefined);
    try {
      await confirm({ draftId: draft._id, name });
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
      <View className="px-5 pb-4 pt-2">
        <DisplayText className="text-[48px] leading-[54px]">Review your workout.</DisplayText>
        <Text className="mt-3 text-base leading-6 text-muted dark:text-muted-dark">
          {draft?.editingWorkoutId
            ? 'Check your changes below. Saving updates this workout in history.'
            : 'Check your sets below. You can edit saved workouts from history.'}
        </Text>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-5 py-4"
        keyboardShouldPersistTaps="handled"
      >
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
          <Text
            accessibilityLiveRegion="polite"
            className="text-sm text-muted dark:text-muted-dark"
          >
            {suggesting
              ? 'Looking for a name from your last 5 workouts…'
              : suggestionFailed
                ? 'Suggestion unavailable. Add a name or leave it blank.'
                : 'Suggestions follow names and exercises from your last 5 workouts. Edit or leave blank.'}
          </Text>
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
      <View className="gap-2 border-t border-line px-5 pb-4 pt-4 dark:border-line-dark">
        <Button disabled={!canConfirm} loading={saving} onPress={() => void finish()}>
          {draft?.editingWorkoutId ? 'Save changes' : 'Confirm workout'}
        </Button>
        <Button variant="ghost" disabled={saving} onPress={back}>
          Continue workout
        </Button>
        {confirmingDiscard ? (
          <View accessibilityLiveRegion="polite" className="gap-3 rounded-2xl bg-soft p-4 dark:bg-soft-dark">
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
                Keep workout
              </Button>
              <Button
                className="flex-1"
                variant="destructive"
                loading={saving}
                onPress={() => void discardAndExit()}
              >
                Discard & exit
              </Button>
            </View>
          </View>
        ) : (
          <Button
            variant="ghost"
            textClassName="text-danger dark:text-danger-dark"
            disabled={saving}
            onPress={() => setConfirmingDiscard(true)}
          >
            {draft?.editingWorkoutId ? 'Discard changes & exit' : 'Discard workout & exit'}
          </Button>
        )}
      </View>
    </Screen>
  );
}
