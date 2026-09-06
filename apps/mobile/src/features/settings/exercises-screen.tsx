import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Archive, Plus } from 'lucide-react-native';
import { api } from '@fitness/convex/api';
import { Button, Card, Dialog, IconButton, Input } from '@fitness/ui';
import { LoadingScreen } from '@/components/loading-screen';
import { useAppTheme } from '@/components/theme-provider';
import { Screen } from '@/components/screen';
import { ErrorNotice } from '@/components/error-notice';

export default function ExercisesScreen() {
  const { colors } = useAppTheme();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const exercises = useQuery(api.exercises.list, isAuthenticated ? {} : 'skip');
  const create = useMutation(api.exercises.create);
  const archive = useMutation(api.exercises.archive);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState<string>();
  const [dialog, setDialog] = useState(false);
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (exercises === undefined) return <LoadingScreen label="Loading exercises…" />;

  async function addExercise() {
    if (locked.current || !name.trim()) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await create({
        name: name.trim(),
        aliases: aliases
          .split(',')
          .map((alias) => alias.trim())
          .filter(Boolean),
        trackingType: 'weight_reps',
      });
      setName('');
      setAliases('');
      setDialog(false);
    } catch {
      setError('The exercise could not be created. Check your connection and try again.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  async function archiveExercise(exerciseId: NonNullable<typeof exercises>[number]['_id']) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await archive({ exerciseId });
    } catch {
      setError('The exercise could not be archived. Try again.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View className="flex-1 px-5 pt-4">
        <View className="flex-row items-center justify-between">
          <IconButton
            accessibilityLabel="Back to settings"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/settings/account')
            }
          >
            <ArrowLeft color={colors.text} size={20} />
          </IconButton>
          <IconButton
            accessibilityLabel="Add exercise"
            className="bg-accent dark:bg-accent-dark"
            disabled={busy}
            onPress={() => {
              setError(undefined);
              setDialog(true);
            }}
          >
            <Plus color={colors.accentInk} size={20} />
          </IconButton>
        </View>
        <Text className="mb-6 mt-7 text-[32px] font-bold tracking-tight text-ink dark:text-ink-dark">
          Exercise library
        </Text>
        <ErrorNotice message={!dialog ? error : undefined} />
        <ScrollView contentContainerClassName="gap-3 pb-10">
          {!exercises.length ? (
            <Text className="text-base leading-6 text-muted dark:text-muted-dark">
              Exercises you log appear here. Add an exercise with the plus button to get started.
            </Text>
          ) : null}
          {exercises.map((exercise) => (
            <Card className="flex-row items-center" key={exercise._id}>
              <View className="flex-1">
                <Text className="text-lg font-black text-ink dark:text-ink-dark">
                  {exercise.name}
                </Text>
                <Text className="mt-1 text-sm text-muted dark:text-muted-dark">
                  {exercise.aliases.length
                    ? exercise.aliases.join(', ')
                    : exercise.trackingType.replace('_', ' ')}
                </Text>
              </View>
              <IconButton
                disabled={busy}
                accessibilityLabel={`Archive ${exercise.name}`}
                onPress={() => void archiveExercise(exercise._id)}
              >
                <Archive color={colors.muted} size={19} />
              </IconButton>
            </Card>
          ))}
        </ScrollView>
        <Dialog
          onRequestClose={() => {
            if (!busy) setDialog(false);
          }}
          title="New exercise"
          visible={dialog}
        >
          <Input autoFocus label="Name" onChangeText={setName} value={name} />
          <Input label="Aliases (comma separated)" onChangeText={setAliases} value={aliases} />
          <ErrorNotice message={error} />
          <Button loading={busy} disabled={!name.trim()} onPress={addExercise}>
            Create exercise
          </Button>
          <Button disabled={busy} variant="ghost" onPress={() => setDialog(false)}>
            Cancel
          </Button>
        </Dialog>
      </View>
    </Screen>
  );
}
