import { Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { ArrowLeft } from 'lucide-react-native';
import { api } from '@fitness/convex/api';
import { normalizeSetForTrackingType, type TrackingType } from '@fitness/domain';
import { Button, Card } from '@fitness/ui';
import { LoadingScreen } from '@/components/loading-screen';
import { useAppTheme } from '@/components/theme-provider';

interface ConfirmSet {
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
}

function formatSet(set: ConfirmSet, trackingType: TrackingType) {
  const normalizedSet = normalizeSetForTrackingType(set, trackingType);
  const parts: string[] = [];
  if (normalizedSet.weightKg !== undefined && normalizedSet.reps !== undefined) {
    parts.push(`${normalizedSet.weightKg} kg × ${normalizedSet.reps} reps`);
  } else {
    if (normalizedSet.weightKg !== undefined) parts.push(`${normalizedSet.weightKg} kg`);
    if (normalizedSet.reps !== undefined) parts.push(`${normalizedSet.reps} reps`);
  }
  if (normalizedSet.durationSeconds !== undefined)
    parts.push(`${normalizedSet.durationSeconds} sec`);
  if (normalizedSet.distanceMeters !== undefined) parts.push(`${normalizedSet.distanceMeters} m`);
  return parts.join(' · ');
}

export default function ConfirmWorkoutScreen() {
  const { colors } = useAppTheme();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const draft = useQuery(api.workoutDrafts.current, isAuthenticated ? {} : 'skip');
  const catalog = useQuery(
    api.exercises.list,
    isAuthenticated ? { includeArchived: true } : 'skip',
  );
  const confirm = useMutation(api.workouts.confirmDraft);

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (draft === undefined || catalog === undefined) return <LoadingScreen label="Loading draft…" />;
  if (!draft) return <Redirect href="/?mode=analysis" />;

  async function finish() {
    await confirm({ draftId: draft!._id });
    router.replace('/?mode=analysis');
  }

  return (
    <View className="flex-1 bg-canvas px-5 pb-8 pt-16 dark:bg-canvas-dark">
      <Pressable
        className="mb-8 h-11 w-11 items-center justify-center rounded-2xl bg-panel dark:bg-panel-dark"
        onPress={() => router.back()}
      >
        <ArrowLeft color={colors.text} size={20} />
      </Pressable>
      <Text className="text-4xl font-black text-ink dark:text-ink-dark">
        Finish today’s workout?
      </Text>
      <Text className="mt-3 text-base leading-6 text-muted dark:text-muted-dark">
        Confirmation creates immutable history. The AI cannot do this for you.
      </Text>
      <ScrollView className="my-7 flex-1" contentContainerClassName="gap-4">
        {draft.exercises.map((exercise) => {
          const trackingType =
            catalog.find((catalogExercise) => catalogExercise._id === exercise.exerciseId)
              ?.trackingType ?? 'custom';
          return (
            <Card key={exercise.rowId}>
              <Text className="text-lg font-black text-ink dark:text-ink-dark">
                {exercise.name}
              </Text>
              {exercise.sets.map((set, index) => (
                <Text className="mt-2 text-base text-muted dark:text-muted-dark" key={set.setId}>
                  {index + 1}. {formatSet(set, trackingType)}
                </Text>
              ))}
            </Card>
          );
        })}
      </ScrollView>
      <View className="gap-3">
        <Button variant="secondary" onPress={() => router.back()}>
          Continue workout
        </Button>
        <Button onPress={finish}>Confirm workout</Button>
      </View>
    </View>
  );
}
