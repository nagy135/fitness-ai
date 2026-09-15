import { useEffect, useRef, useState } from 'react';
import { useAction, useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '@fitness/convex/api';
import type { FitnessMode } from '@fitness/ui';
import type { AnalysisChart } from '@fitness/ai';
import type { SetPatch } from '@/features/workout/workout-table';

type Response = { text: string; chart?: AnalysisChart };
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
  const ensureProfile = useMutation(api.userProfiles.ensureCurrent);
  const getOrCreate = useMutation(api.workoutDrafts.getOrCreate);
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
    ready && isAuthenticated && conversationOpen ? { mode, limit: 50 } : 'skip',
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
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      if (mode === 'workout') await getOrCreate({});
      const requestId = mode === 'workout' ? await prepareWorkoutRequest({ prompt }) : undefined;
      const result = requestId ? await workoutAI({ requestId }) : await analysisAI({ prompt });
      setResponses((previous) => ({ ...previous, [mode]: result }));
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
    workouts,
    response: responses[mode],
    submitPrompt,
    updateSet: (rowId: string, setId: string, patch: SetPatch) =>
      edit(() => update({ rowId, setId, patch, source: 'user_ui' })),
    removeSet: (rowId: string, setId: string) =>
      edit(() => remove({ rowId, setId, source: 'user_ui' })),
    removeExercise: (rowId: string) => edit(() => removeExercise({ rowId, source: 'user_ui' })),
  };
}
