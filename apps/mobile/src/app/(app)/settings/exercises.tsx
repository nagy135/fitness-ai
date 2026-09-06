import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Archive, Plus } from 'lucide-react-native';
import { api } from '@fitness/convex/api';
import { Button, Card, Dialog, Input } from '@fitness/ui';
import { LoadingScreen } from '@/components/loading-screen';
import { useAppTheme } from '@/components/theme-provider';

export default function ExercisesScreen() {
  const { colors } = useAppTheme();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const exercises = useQuery(api.exercises.list, isAuthenticated ? {} : 'skip');
  const create = useMutation(api.exercises.create);
  const archive = useMutation(api.exercises.archive);
  const [dialog, setDialog] = useState(false);
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (exercises === undefined) return <LoadingScreen label="Loading exercises…" />;

  async function addExercise() {
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
  }

  return (
    <View className="flex-1 bg-canvas px-5 pt-16 dark:bg-canvas-dark">
      <View className="flex-row items-center justify-between">
        <Pressable
          className="h-11 w-11 items-center justify-center rounded-2xl bg-panel dark:bg-panel-dark"
          onPress={() => router.back()}
        >
          <ArrowLeft color={colors.text} size={20} />
        </Pressable>
        <Pressable
          className="h-11 w-11 items-center justify-center rounded-2xl bg-accent dark:bg-accent-dark"
          onPress={() => setDialog(true)}
        >
          <Plus color="#0B0D0F" size={20} />
        </Pressable>
      </View>
      <Text className="mb-6 mt-7 text-4xl font-black text-ink dark:text-ink-dark">
        Your exercises
      </Text>
      <ScrollView contentContainerClassName="gap-3 pb-10">
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
            <Pressable
              accessibilityLabel={`Archive ${exercise.name}`}
              onPress={() => void archive({ exerciseId: exercise._id })}
            >
              <Archive color={colors.muted} size={19} />
            </Pressable>
          </Card>
        ))}
      </ScrollView>
      <Dialog onRequestClose={() => setDialog(false)} title="New exercise" visible={dialog}>
        <Input autoFocus label="Name" onChangeText={setName} value={name} />
        <Input label="Aliases (comma separated)" onChangeText={setAliases} value={aliases} />
        <Button disabled={!name.trim()} onPress={addExercise}>
          Create exercise
        </Button>
        <Button variant="ghost" onPress={() => setDialog(false)}>
          Cancel
        </Button>
      </Dialog>
    </View>
  );
}
