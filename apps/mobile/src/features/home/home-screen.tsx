import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowUpRight,
  History,
  MessageSquareText,
  Settings,
  TrendingUp,
} from 'lucide-react-native';
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
import { DisplayText } from '@/components/display-text';

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
  function changeMode(next: FitnessMode) {
    if (next === mode || session.busy) return;
    if (next === 'analysis' && setCount > 0) {
      router.push('/workout/confirm');
      return;
    }
    router.setParams({ mode: next });
  }
  return (
    <Screen
      headerActions={
        <>
          <IconButton
            accessibilityLabel="Open workout history"
            onPress={() => setHistoryOpen(true)}
          >
            <History color={colors.text} size={20} strokeWidth={2} />
          </IconButton>
          <IconButton
            accessibilityLabel="Open conversation"
            onPress={() => setConversationOpen(true)}
          >
            <MessageSquareText color={colors.text} size={20} strokeWidth={2} />
          </IconButton>
          <IconButton
            accessibilityLabel="Open settings"
            disabled={session.busy}
            onPress={() => router.push('/settings/account')}
          >
            <Settings color={colors.text} size={20} strokeWidth={2} />
          </IconButton>
        </>
      }
    >
      <View className="px-5 pb-2">
        <ModeSwitch mode={mode} onChange={changeMode} disabled={session.busy} />
        {mode === 'analysis' ? (
          <View className="mt-5 flex-row items-end justify-between">
            <View>
              <Text className="text-sm text-muted dark:text-muted-dark">
                Your training, in perspective
              </Text>
              <DisplayText className="text-[52px] leading-[60px]">The long game.</DisplayText>
            </View>
            <TrendingUp size={36} strokeWidth={1.5} color={colors.accent} />
          </View>
        ) : null}
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
              <DisplayText className="text-[36px] leading-10">
                Every session tells a story.
              </DisplayText>
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
                    className="min-h-16 flex-row items-center justify-between gap-4 border-b border-line py-4 active:opacity-70 dark:border-line-dark"
                  >
                    <Text className="flex-1 text-base font-medium text-ink dark:text-ink-dark">
                      {text}
                    </Text>
                    <ArrowUpRight color={colors.accent} size={21} />
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
      {mode === 'workout' && setCount > 0 ? (
        <View className="px-5 pb-2">
          <Button
            variant="secondary"
            disabled={session.busy}
            onPress={() => router.push('/workout/confirm')}
          >
            Review workout
          </Button>
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
