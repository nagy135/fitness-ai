import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Check } from 'lucide-react-native';
import { api } from '@fitness/convex/api';
import { normalizeSetForTrackingType } from '@fitness/domain';
import { Button, IconButton } from '@fitness/ui';
import { LoadingScreen } from '@/components/loading-screen';
import { useAppTheme } from '@/components/theme-provider';
import { Screen } from '@/components/screen';
import { ErrorNotice } from '@/components/error-notice';
import { formatSet } from './history-format';

export default function ConfirmWorkoutScreen() {
  const { colors } = useAppTheme();
  const draft = useQuery(api.workoutDrafts.current, {});
  const catalog = useQuery(api.exercises.list, { includeArchived: true });
  const confirm = useMutation(api.workouts.confirmDraft);
  const [saving, setSaving] = useState(false);
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
      await confirm({ draftId: draft._id });
      router.replace('/?mode=analysis');
    } catch {
      setError('Your workout could not be saved. Check your connection and try again.');
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }
  return (
    <Screen>
      <View className="px-5 pb-4 pt-4">
        <IconButton accessibilityLabel="Back to workout" disabled={saving} onPress={back}>
          <ArrowLeft color={colors.text} size={22} />
        </IconButton>
        <Text className="mt-5 text-[32px] font-bold tracking-tight text-ink dark:text-ink-dark">
          Review your workout
        </Text>
        <Text className="mt-3 text-base leading-6 text-muted dark:text-muted-dark">
          Check your sets below. Once saved, this workout becomes a permanent part of your history.
        </Text>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-5 py-4">
        {draft?.exercises.map((exercise) => {
          const trackingType =
            catalog.find((item) => item._id === exercise.exerciseId)?.trackingType ?? 'custom';
          return (
            <View key={exercise.rowId}>
              <Text className="mb-3 text-xl font-bold text-ink dark:text-ink-dark">
                {exercise.name}
              </Text>
              <View className="rounded-2xl border border-line bg-panel px-4 dark:border-line-dark dark:bg-panel-dark">
                {exercise.sets.map((set, index) => (
                  <View
                    className={`flex-row items-center gap-3 py-4 ${index ? 'border-t border-line dark:border-line-dark' : ''}`}
                    key={set.setId}
                  >
                    <Text className="w-10 text-sm text-muted dark:text-muted-dark">
                      Set {index + 1}
                    </Text>
                    <Text className="flex-1 text-base font-semibold text-ink dark:text-ink-dark">
                      {formatSet(normalizeSetForTrackingType(set, trackingType))}
                    </Text>
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
          Confirm workout
        </Button>
        <Button variant="ghost" disabled={saving} onPress={back}>
          Continue workout
        </Button>
      </View>
    </Screen>
  );
}
