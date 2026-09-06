import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Dumbbell, History, MessageSquareText, Settings, TrendingUp } from 'lucide-react-native';
import { Button, IconButton, ModeSwitch, type FitnessMode } from '@fitness/ui';
import { LoadingScreen } from '@/components/loading-screen';
import { PromptBar } from '@/components/prompt-bar';
import { ConversationDrawer } from '@/components/conversation-drawer';
import { useAppTheme } from '@/components/theme-provider';
import { WorkoutTable } from '@/features/workout/workout-table';
import { ProgressChart } from '@/components/progress-chart';
import { WorkoutHistoryDrawer } from '@/components/workout-history-drawer';
import { Screen } from '@/components/screen';
import { ErrorNotice } from '@/components/error-notice';
import { useWorkoutSession } from './use-workout-session';

const suggestions = [
  'How has my bench press improved?',
  'Graph my weekly training volume',
  'What did I train last week?',
];

export default function HomeScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: FitnessMode = params.mode === 'analysis' ? 'analysis' : 'workout';
  const [conversationOpen, setConversationOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [prompts, setPrompts] = useState({ workout: '', analysis: '' });
  const { colors } = useAppTheme();
  const session = useWorkoutSession(mode, conversationOpen, historyOpen);
  const setPrompt = (value: string) => setPrompts((previous) => ({ ...previous, [mode]: value }));
  if (session.initializationError)
    return (
      <Screen>
        <View className="flex-1 justify-center px-5">
          <ErrorNotice message={session.initializationError} />
          <Button onPress={() => void session.initialize()}>Try again</Button>
        </View>
      </Screen>
    );
  if (!session.ready || session.draft === undefined)
    return <LoadingScreen label="Loading your workout…" />;
  const exercises = session.draft?.exercises ?? [];
  const setCount = exercises.reduce((total, row) => total + row.sets.length, 0);
  const sessionDate = session.draft?.date ? new Date(`${session.draft.date}T12:00:00`) : new Date();
  const dateLabel = sessionDate.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  function changeMode(next: FitnessMode) {
    if (next === mode || session.busy) return;
    if (next === 'analysis' && setCount > 0) {
      router.push('/workout/confirm');
      return;
    }
    router.setParams({ mode: next });
  }
  return (
    <Screen>
      <View className="px-5 pb-3 pt-4">
        <View className="mb-5 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Dumbbell color={colors.accent} size={23} strokeWidth={2} />
            <Text className="text-lg font-bold tracking-tight text-ink dark:text-ink-dark">
              Fitness AI
            </Text>
          </View>
          <View className="flex-row gap-1">
            <IconButton
              accessibilityLabel="Open workout history"
              onPress={() => setHistoryOpen(true)}
            >
              <History color={colors.text} size={21} />
            </IconButton>
            <IconButton
              accessibilityLabel="Open conversation"
              onPress={() => setConversationOpen(true)}
            >
              <MessageSquareText color={colors.text} size={21} />
            </IconButton>
            <IconButton
              accessibilityLabel="Open settings"
              disabled={session.busy}
              onPress={() => router.push('/settings/account')}
            >
              <Settings color={colors.text} size={21} />
            </IconButton>
          </View>
        </View>
        <ModeSwitch mode={mode} onChange={changeMode} disabled={session.busy} />
        <View className="mt-6 flex-row flex-wrap items-center justify-between gap-3">
          <View>
            <Text className="text-[32px] font-bold tracking-tight text-ink dark:text-ink-dark">
              {mode === 'workout' ? 'Your workout' : 'Your progress'}
            </Text>
            <Text className="mt-1 text-sm text-muted dark:text-muted-dark">
              {mode === 'workout'
                ? `${dateLabel}${setCount ? `  /  ${setCount} sets logged` : ''}`
                : 'Built from your saved workouts'}
            </Text>
          </View>
          {mode === 'workout' && setCount > 0 ? (
            <Button disabled={session.busy} onPress={() => router.push('/workout/confirm')}>
              Review workout
            </Button>
          ) : null}
        </View>
      </View>
      {mode === 'workout' ? (
        <WorkoutTable
          exercises={exercises}
          busy={session.busy}
          onRemoveSet={session.removeSet}
          onRemoveExercise={session.removeExercise}
          onUpdateSet={session.updateSet}
          onExample={setPrompt}
        />
      ) : (
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="grow px-5 pb-6 pt-5"
        >
          {session.response ? (
            <View>
              <Text className="text-base leading-7 text-ink dark:text-ink-dark" selectable>
                {session.response.text}
              </Text>
              {session.response.chart ? <ProgressChart chart={session.response.chart} /> : null}
            </View>
          ) : (
            <View className="flex-1 justify-center py-6">
              <TrendingUp color={colors.accent} size={36} strokeWidth={1.5} />
              <Text className="mt-5 text-2xl font-bold tracking-tight text-ink dark:text-ink-dark">
                See what’s adding up.
              </Text>
              <Text className="mt-3 text-base leading-6 text-muted dark:text-muted-dark">
                Explore your lifts, spot patterns, and follow your progress.
              </Text>
              <View className="mt-7 gap-2">
                {suggestions.map((text) => (
                  <Pressable
                    key={text}
                    accessibilityRole="button"
                    disabled={session.busy}
                    onPress={() => setPrompt(text)}
                    className="min-h-12 justify-center rounded-xl border border-line bg-panel px-4 py-3 active:opacity-70 dark:border-line-dark dark:bg-panel-dark"
                  >
                    <Text className="text-sm text-ink dark:text-ink-dark">{text}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
      {mode === 'workout' && session.response ? (
        <View className="mx-5 mb-2 max-h-28 rounded-xl bg-soft px-4 py-3 dark:bg-soft-dark">
          <ScrollView>
            <Text selectable className="text-sm leading-5 text-ink dark:text-ink-dark">
              {session.response.text}
            </Text>
          </ScrollView>
        </View>
      ) : null}
      <ErrorNotice message={session.error} />
      <PromptBar
        value={prompts[mode]}
        onChangeText={setPrompt}
        onSubmit={session.submitPrompt}
        placeholder={
          mode === 'workout' ? 'Log a set or make a correction…' : 'Ask about your training…'
        }
        processing={session.busy}
      />
      <ConversationDrawer
        messages={session.messages}
        mode={mode}
        onClose={() => setConversationOpen(false)}
        visible={conversationOpen}
      />
      <WorkoutHistoryDrawer
        onClose={() => setHistoryOpen(false)}
        visible={historyOpen}
        workouts={session.workouts}
      />
    </Screen>
  );
}
