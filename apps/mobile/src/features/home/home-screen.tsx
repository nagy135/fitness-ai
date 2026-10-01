import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BrainCircuit, History, MessageSquareText, Settings, Plus } from 'lucide-react-native';
import { Button, IconButton, ModeSwitch, type FitnessMode } from '@fitness/ui';
import { LoadingScreen } from '@/components/loading-screen';
import { PromptBar } from '@/components/prompt-bar';
import { ConversationDrawer } from '@/components/conversation-drawer';
import { AnalysisConversationDrawer } from '@/components/analysis-conversation-drawer';
import { AnalysisMarkdown } from '@/components/analysis-markdown';
import { AnalysisHistoryDrawer } from '@/components/analysis-history-drawer';
import { useAppTheme } from '@/components/theme-provider';
import { WorkoutTable } from '@/features/workout/workout-table';
import { WorkoutReviewBar } from '@/features/workout/workout-review-bar';
import { ProgressChart } from '@/components/progress-chart';
import { WorkoutHistoryDrawer } from '@/components/workout-history-drawer';
import { Screen } from '@/components/screen';
import { ErrorNotice } from '@/components/error-notice';
import { useWorkoutSession } from './use-workout-session';
import { usePromptQueue } from './use-prompt-queue';
import { QuickModelSettings } from '@/features/settings/quick-model-settings';

export default function HomeScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: FitnessMode = params.mode === 'analysis' ? 'analysis' : 'workout';
  const [conversationOpen, setConversationOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [analysisHistoryOpen, setAnalysisHistoryOpen] = useState(false);
  const [legacyConversation, setLegacyConversation] = useState(false);
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [analysisReset, setAnalysisReset] = useState(0);
  const [prompts, setPrompts] = useState({ workout: '', analysis: '' });
  const { colors } = useAppTheme();
  const session = useWorkoutSession(mode, conversationOpen, historyOpen);
  const queue = usePromptQueue(
    session.submitPrompt,
    session.busy || (mode === 'analysis' && session.analysisLoading),
  );
  const busy = session.busy || queue.hasWork;
  const setPrompt = (value: string) => setPrompts((previous) => ({ ...previous, [mode]: value }));
  function newAnalysis() {
    if (busy) return;
    session.resetAnalysis();
    setPrompts((previous) => ({ ...previous, analysis: '' }));
    setAnalysisReset((previous) => previous + 1);
    setAnalysisHistoryOpen(false);
  }
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
    if (next === mode || busy) return;
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
            accessibilityLabel={
              mode === 'analysis' ? 'Open analysis history' : 'Open workout history'
            }
            disabled={busy}
            onPress={() =>
              mode === 'analysis' ? setAnalysisHistoryOpen(true) : setHistoryOpen(true)
            }
          >
            <History color={colors.text} size={20} strokeWidth={2} />
          </IconButton>
          <IconButton
            accessibilityLabel="Open conversation"
            onPress={() => {
              setLegacyConversation(false);
              setConversationOpen(true);
            }}
          >
            <MessageSquareText color={colors.text} size={20} strokeWidth={2} />
          </IconButton>
          <IconButton
            accessibilityLabel="Open model settings"
            onPress={() => setModelSettingsOpen(true)}
          >
            <BrainCircuit color={colors.text} size={20} strokeWidth={2} />
          </IconButton>
          <IconButton
            accessibilityLabel="Open settings"
            disabled={busy}
            onPress={() => router.push('/settings/account')}
          >
            <Settings color={colors.text} size={20} strokeWidth={2} />
          </IconButton>
          {mode === 'analysis' ? (
            <IconButton
              accessibilityLabel="Start new analysis"
              disabled={busy || session.analysisLoading}
              onPress={newAnalysis}
            >
              <Plus color={colors.text} size={20} strokeWidth={2} />
            </IconButton>
          ) : null}
        </>
      }
    >
      <View className="px-5 pb-2">
        <ModeSwitch mode={mode} onChange={changeMode} disabled={busy} />
        {session.draft?.editingWorkoutId ? (
          <View className="mt-3 gap-2 rounded-xl bg-soft p-3 dark:bg-soft-dark">
            <Text className="font-bold text-ink dark:text-ink-dark">
              Editing saved workout ·{' '}
              {session.draft.performedAt !== undefined
                ? new Date(session.draft.performedAt).toLocaleDateString()
                : session.draft.date}
            </Text>
            <Text className="text-sm text-muted dark:text-muted-dark">
              Review and save your changes when you’re done.
            </Text>
            <Button
              variant="ghost"
              disabled={busy}
              onPress={() => void session.cancelHistoryEdit()}
            >
              Cancel changes
            </Button>
          </View>
        ) : null}
      </View>
      {mode === 'workout' ? (
        <WorkoutTable
          key={session.draft?._id}
          exercises={exercises}
          busy={busy}
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
          {session.analysisLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator
                color={colors.accent}
                accessibilityLabel="Loading saved analysis"
              />
            </View>
          ) : session.response ? (
            <View>
              <AnalysisMarkdown text={session.response.text} />
              {session.response.chart ? <ProgressChart chart={session.response.chart} /> : null}
            </View>
          ) : null}
        </ScrollView>
      )}
      {mode === 'workout' && (setCount > 0 || session.workoutExchange) ? (
        <WorkoutReviewBar
          key={session.draft?._id}
          response={session.workoutExchange}
          busy={busy}
          hasSets={setCount > 0}
          editing={!!session.draft?.editingWorkoutId}
          onReview={() => router.push('/workout/confirm')}
        />
      ) : null}
      <ErrorNotice message={session.error} />
      <PromptBar
        key={mode === 'analysis' ? `analysis-${analysisReset}` : mode}
        voiceEnabled={
          !conversationOpen && !historyOpen && !analysisHistoryOpen && !modelSettingsOpen
        }
        value={prompts[mode]}
        onChangeText={setPrompt}
        onSubmit={queue.enqueue}
        queued={queue.pending}
        queueFull={queue.full}
        failedPrompt={queue.failed}
        onRemoveQueued={queue.remove}
        onRetryFailed={queue.retry}
        onDiscardFailed={queue.discardFailed}
        placeholder={
          mode === 'workout' ? 'Log a set or make a correction…' : 'Ask about your training…'
        }
        processing={session.busy}
        processingLabel={
          mode === 'workout' ? 'Updating your draft…' : 'Reading your training history…'
        }
      />
      {mode === 'analysis' ? (
        <AnalysisConversationDrawer
          key={legacyConversation ? 'legacy' : (session.analysisId ?? 'new')}
          sessionId={legacyConversation ? undefined : session.analysisId}
          legacy={legacyConversation}
          onClose={() => setConversationOpen(false)}
          visible={conversationOpen}
        />
      ) : (
        <ConversationDrawer
          messages={session.messages}
          mode={mode}
          onClose={() => setConversationOpen(false)}
          visible={conversationOpen}
        />
      )}
      <AnalysisHistoryDrawer
        visible={analysisHistoryOpen}
        selectedId={session.analysisId}
        onClose={() => setAnalysisHistoryOpen(false)}
        onNew={newAnalysis}
        onOpen={(id) => {
          if (busy) return;
          session.openAnalysis(id);
          setPrompts((previous) => ({ ...previous, analysis: '' }));
          setAnalysisReset((previous) => previous + 1);
          setAnalysisHistoryOpen(false);
        }}
        onLegacy={() => {
          setAnalysisHistoryOpen(false);
          setLegacyConversation(true);
          setConversationOpen(true);
        }}
      />
      <QuickModelSettings visible={modelSettingsOpen} onClose={() => setModelSettingsOpen(false)} />
      <WorkoutHistoryDrawer
        onEdit={() => {
          setHistoryOpen(false);
          setPrompts((previous) => ({ ...previous, workout: '' }));
          router.setParams({ mode: 'workout' });
        }}
        onClose={() => setHistoryOpen(false)}
        visible={historyOpen}
        workouts={session.workouts}
      />
    </Screen>
  );
}
