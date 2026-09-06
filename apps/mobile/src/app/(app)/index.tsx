import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { History, MessageSquareText, Moon, Settings, Sun } from 'lucide-react-native';
import { useAction, useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '@fitness/convex/api';
import { ModeSwitch, type FitnessMode } from '@fitness/ui';
import { LoadingScreen } from '@/components/loading-screen';
import { PromptBar } from '@/components/prompt-bar';
import { ConversationDrawer } from '@/components/conversation-drawer';
import { useAppTheme } from '@/components/theme-provider';
import { WorkoutTable } from '@/features/workout/workout-table';
import { ProgressChart } from '@/components/progress-chart';
import { WorkoutHistoryDrawer } from '@/components/workout-history-drawer';
import type { AnalysisChart } from '@fitness/ai';

export default function HomeScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<FitnessMode>(
    params.mode === 'analysis' ? 'analysis' : 'workout',
  );
  const [processing, setProcessing] = useState(false);
  const [assistantText, setAssistantText] = useState<string>();
  const [assistantChart, setAssistantChart] = useState<AnalysisChart>();
  const [conversationOpen, setConversationOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { colors, isDark, toggleTheme } = useAppTheme();
  const initialized = useRef(false);
  const ensureProfile = useMutation(api.userProfiles.ensureCurrent);
  const getOrCreateDraft = useMutation(api.workoutDrafts.getOrCreate);
  const removeSet = useMutation(api.workoutDrafts.removeSet);
  const updateSet = useMutation(api.workoutDrafts.updateSet);
  const runWorkoutAI = useAction(api.ai.workout.respond);
  const runAnalysisAI = useAction(api.ai.analysis.respond);
  const draft = useQuery(api.workoutDrafts.current, ready ? {} : 'skip');
  const messages = useQuery(api.aiMessages.recent, ready ? { mode, limit: 50 } : 'skip');
  const workouts = useQuery(
    api.workouts.recent,
    ready && historyOpen ? { limit: 50 } : 'skip',
  );

  useEffect(() => {
    if (!isAuthenticated || initialized.current) return;
    initialized.current = true;
    void ensureProfile({})
      .then(() => getOrCreateDraft({}))
      .then(() => setReady(true));
  }, [ensureProfile, getOrCreateDraft, isAuthenticated]);

  if (isLoading) return <LoadingScreen label="Restoring secure session…" />;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!ready || draft === undefined) return <LoadingScreen label="Preparing today’s workout…" />;

  function changeMode(next: FitnessMode) {
    if (next === mode) return;
    if (
      next === 'analysis' &&
      draft &&
      draft.exercises.some((exercise) => exercise.sets.length > 0)
    ) {
      router.push('/workout/confirm');
      return;
    }
    setMode(next);
  }

  async function submitPrompt(prompt: string) {
    setProcessing(true);
    setAssistantText(undefined);
    setAssistantChart(undefined);
    try {
      if (mode === 'workout') {
        const result = await runWorkoutAI({ prompt });
        setAssistantText(result.text);
      } else {
        const result = await runAnalysisAI({ prompt });
        setAssistantText(result.text);
        setAssistantChart(result.chart);
      }
    } catch (error) {
      setAssistantText(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-canvas dark:bg-canvas-dark"
      keyboardVerticalOffset={0}
    >
      <View className="px-4 pb-2 pt-16">
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-black tracking-[3px] text-accent dark:text-accent-dark">
              FITNESS AI
            </Text>
            <Text className="mt-1 text-2xl font-black text-ink dark:text-ink-dark">
              {mode === 'workout' ? 'Today' : 'Your training'}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <Pressable
              accessibilityLabel="Open workout history"
              className="h-11 w-11 items-center justify-center rounded-2xl border border-line bg-panel dark:border-line-dark dark:bg-panel-dark"
              onPress={() => setHistoryOpen(true)}
            >
              <History color={colors.text} size={20} />
            </Pressable>
            <Pressable
              accessibilityLabel="Open conversation"
              className="h-11 w-11 items-center justify-center rounded-2xl border border-line bg-panel dark:border-line-dark dark:bg-panel-dark"
              onPress={() => setConversationOpen(true)}
            >
              <MessageSquareText color={colors.text} size={20} />
            </Pressable>
            <Pressable
              accessibilityLabel={isDark ? 'Use light mode' : 'Use dark mode'}
              className="h-11 w-11 items-center justify-center rounded-2xl border border-line bg-panel dark:border-line-dark dark:bg-panel-dark"
              onPress={toggleTheme}
            >
              {isDark ? (
                <Sun color={colors.text} size={20} />
              ) : (
                <Moon color={colors.text} size={20} />
              )}
            </Pressable>
            <Pressable
              accessibilityLabel="Open settings"
              className="h-11 w-11 items-center justify-center rounded-2xl border border-line bg-panel dark:border-line-dark dark:bg-panel-dark"
              onPress={() => router.push('/settings/exercises')}
            >
              <Settings color={colors.text} size={20} />
            </Pressable>
          </View>
        </View>
        <ModeSwitch mode={mode} onChange={changeMode} />
      </View>

      {mode === 'workout' ? (
        <WorkoutTable
          exercises={draft?.exercises ?? []}
          onRemoveSet={(rowId, setId) => void removeSet({ rowId, setId, source: 'user_ui' })}
          onUpdateSet={(rowId, setId, patch) =>
            void updateSet({ rowId, setId, patch, source: 'user_ui' })
          }
        />
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="px-5 pb-8 pt-8">
          <Text className="text-3xl font-black leading-10 text-ink dark:text-ink-dark">
            Ask your history a real question.
          </Text>
          <Text className="mt-3 text-base leading-6 text-muted dark:text-muted-dark">
            Analysis reads only the confirmed data it retrieves. It cannot change your workouts.
          </Text>
          {assistantText ? (
            <View className="mt-8 rounded-3xl border border-line bg-panel p-5 dark:border-line-dark dark:bg-panel-dark">
              <Text className="text-base leading-7 text-ink dark:text-ink-dark">
                {assistantText}
              </Text>
              {assistantChart ? <ProgressChart chart={assistantChart} /> : null}
            </View>
          ) : null}
        </ScrollView>
      )}

      {mode === 'workout' && assistantText ? (
        <View className="px-5 pb-2">
          <Text className="text-sm text-muted dark:text-muted-dark">{assistantText}</Text>
        </View>
      ) : null}
      <PromptBar
        onSubmit={submitPrompt}
        placeholder={mode === 'workout' ? 'What did you do?' : 'Ask about your training…'}
        processing={processing}
      />
      <ConversationDrawer
        messages={messages ?? []}
        mode={mode}
        onClose={() => setConversationOpen(false)}
        visible={conversationOpen}
      />
      <WorkoutHistoryDrawer
        onClose={() => setHistoryOpen(false)}
        visible={historyOpen}
        workouts={workouts}
      />
    </KeyboardAvoidingView>
  );
}
