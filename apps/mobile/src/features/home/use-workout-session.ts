import { useEffect, useRef, useState } from 'react';
import { useAction, useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '@fitness/convex/api';
import type { FitnessMode } from '@fitness/ui';
import type { AnalysisChart } from '@fitness/ai';
import type { Id } from '@fitness/convex/data-model';
import type { SetPatch } from '@/features/workout/workout-table';
import { latestWorkoutExchange } from '../workout/latest-workout-exchange';

type Response = {
  text: string;
  chart?: AnalysisChart;
  draftId?: string;
  sessionId?: Id<'analysisSessions'>;
};
export function useWorkoutSession(
  mode: FitnessMode,
  conversationOpen: boolean,
  historyOpen: boolean,
) {
  const { isAuthenticated } = useConvexAuth();
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [initializationError, setInitializationError] = useState<string>();
  const [errors, setErrors] = useState<Partial<Record<FitnessMode, string>>>({});
  const setError = (message?: string) =>
    setErrors((previous) => ({ ...previous, [mode]: message }));
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [responses, setResponses] = useState<Partial<Record<FitnessMode, Response>>>({});
  // undefined restores the latest saved session; null is an unsent new analysis.
  const [selectedAnalysis, setSelectedAnalysis] = useState<Id<'analysisSessions'> | null>();
  const createAnalysis = useMutation(api.aiMessages.createAnalysisSession);
  const analysis = useQuery(
    api.aiMessages.analysisSession,
    ready && isAuthenticated && selectedAnalysis !== null
      ? { ...(selectedAnalysis ? { sessionId: selectedAnalysis } : {}) }
      : 'skip',
  );
  const analysisId =
    selectedAnalysis ?? (selectedAnalysis === undefined ? analysis?._id : undefined);
  // Resolve the initial selection once so updates from another device cannot
  // switch the conversation underneath the current prompt.
  if (selectedAnalysis === undefined && analysis !== undefined) {
    setSelectedAnalysis(analysis?._id ?? null);
  }
  const ensureProfile = useMutation(api.userProfiles.ensureCurrent);
  const getOrCreate = useMutation(api.workoutDrafts.getOrCreate);
  const cancelEdit = useMutation(api.workouts.cancelEdit);
  const update = useMutation(api.workoutDrafts.updateSet);
  const remove = useMutation(api.workoutDrafts.removeSet);
  const removeExercise = useMutation(api.workoutDrafts.removeExercise);
  const prepareWorkoutRequest = useMutation(api.aiMessages.prepareWorkoutRequest);
  const acknowledgeWorkoutRequest = useMutation(api.aiMessages.acknowledgeWorkoutRequest);
  const workoutAI = useAction(api.ai.workout.respond);
  const analysisAI = useAction(api.ai.analysis.respond);
  const draft = useQuery(api.workoutDrafts.current, ready && isAuthenticated ? {} : 'skip');
  const messages = useQuery(
    api.aiMessages.recent,
    ready && isAuthenticated && mode === 'workout'
      ? { mode, limit: conversationOpen ? 50 : 10 }
      : 'skip',
  );
  const workouts = useQuery(
    api.workouts.recent,
    ready && isAuthenticated && historyOpen ? { limit: 50 } : 'skip',
  );
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    void ensureProfile({})
      .then(() => getOrCreate({}))
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active)
          setInitializationError(
            'Your workout could not be loaded. Check your connection and try again.',
          );
      });
    return () => {
      active = false;
    };
  }, [ensureProfile, getOrCreate, isAuthenticated, attempt]);

  async function submitPrompt(prompt: string): Promise<boolean> {
    if (
      locked.current ||
      (mode === 'analysis' && selectedAnalysis !== null && analysis === undefined)
    )
      return false;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const responseDraftId = mode === 'workout' ? await getOrCreate({}) : undefined;
      const requestId = mode === 'workout' ? await prepareWorkoutRequest({ prompt }) : undefined;
      let sessionId = analysisId;
      if (mode === 'analysis' && !sessionId) {
        sessionId = await createAnalysis({ title: prompt });
        setSelectedAnalysis(sessionId);
      }
      const result = requestId
        ? await workoutAI({ requestId })
        : await analysisAI({ prompt, sessionId });
      setResponses((previous) => ({
        ...previous,
        [mode]: { ...result, draftId: responseDraftId, sessionId },
      }));
      // Once the result arrived, an acknowledgement failure must not turn this
      // into a failed submission: its acknowledgement may already have committed.
      if (requestId) await acknowledgeWorkoutRequest({ requestId }).catch(() => undefined);
      return true;
    } catch {
      setError(
        mode === 'workout'
          ? 'The request is still running or could not be reached. Send the same message again to retrieve its outcome safely.'
          : 'Analysis could not be loaded. Check your connection and try again.',
      );
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function edit(operation: () => Promise<unknown>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await operation();
    } catch {
      setError('The change could not be saved. Check your connection and try again.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return {
    ready,
    initializationError,
    initialize: () => {
      setInitializationError(undefined);
      setAttempt((previous) => previous + 1);
    },
    error: errors[mode],
    busy,
    draft,
    messages,
    workoutExchange: latestWorkoutExchange(messages),
    workouts,
    analysisId,
    analysisTitle: selectedAnalysis === null ? undefined : analysis?.title,
    analysisLoading: selectedAnalysis !== null && analysis === undefined,
    response:
      mode === 'analysis'
        ? selectedAnalysis !== null
          ? (analysis?.response ??
            (responses.analysis?.sessionId === analysisId ? responses.analysis : undefined))
          : undefined
        : responses.workout?.draftId !== draft?._id
          ? undefined
          : responses.workout,
    submitPrompt,
    resetAnalysis: () => {
      if (locked.current) return;
      setSelectedAnalysis(null);
      setResponses((previous) => ({ ...previous, analysis: undefined }));
      setErrors((previous) => ({ ...previous, analysis: undefined }));
    },
    openAnalysis: (id: Id<'analysisSessions'>) => {
      if (locked.current) return;
      setSelectedAnalysis(id);
      setResponses((previous) => ({ ...previous, analysis: undefined }));
      setErrors((previous) => ({ ...previous, analysis: undefined }));
    },
    cancelHistoryEdit: () =>
      edit(async () => {
        if (!draft?.editingWorkoutId) return;
        await cancelEdit({ draftId: draft._id });
        await getOrCreate({});
        setResponses((previous) => ({ ...previous, workout: undefined }));
      }),
    updateSet: (rowId: string, setId: string, patch: SetPatch) =>
      edit(() => update({ rowId, setId, patch, source: 'user_ui' })),
    removeSet: (rowId: string, setId: string) =>
      edit(() => remove({ rowId, setId, source: 'user_ui' })),
    removeExercise: (rowId: string) => edit(() => removeExercise({ rowId, source: 'user_ui' })),
  };
}
