import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useWorkoutSession } from './use-workout-session';

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  mutation: vi.fn(async () => 'draft-1'),
  analysis: null as {
    _id: string;
    title: string;
    response: { text: string; question?: string } | null;
  } | null,
}));
vi.mock('@fitness/convex/api', () => ({
  api: {
    userProfiles: { ensureCurrent: 'ensure' },
    workoutDrafts: {
      getOrCreate: 'create',
      current: 'draft',
      updateSet: 'update',
      removeSet: 'remove',
      removeExercise: 'removeExercise',
    },
    workouts: { cancelEdit: 'cancel', recent: 'workouts' },
    aiMessages: {
      prepareWorkoutRequest: 'prepare',
      acknowledgeWorkoutRequest: 'ack',
      recent: 'messages',
      createAnalysisSession: 'createAnalysis',
      analysisSession: 'analysisSession',
    },
    ai: { workout: { respond: 'workoutAI' }, analysis: { respond: 'analysisAI' } },
  },
}));
vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useAction: () => mocks.action,
  useMutation: () => mocks.mutation,
  useQuery: (ref: string, args: unknown) =>
    args === 'skip'
      ? undefined
      : ref === 'analysisSession'
        ? mocks.analysis
        : ref === 'draft'
          ? { _id: 'draft-1', exercises: [] }
          : [],
}));
let session: ReturnType<typeof useWorkoutSession>;
let renderer: ReactTestRenderer;
function Harness() {
  const current = useWorkoutSession('analysis', false, false);
  useEffect(() => {
    session = current;
  });
  return null;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  mocks.analysis = null;
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});
it('resets the analysis result and errors without changing saved workouts or drafts', async () => {
  mocks.action.mockResolvedValue({ text: 'Your graph' });
  await act(() => {
    renderer = create(createElement(Harness));
  });
  await act(async () => {
    await session.submitPrompt('Graph volume');
  });
  expect(session.response?.text).toBe('Your graph');
  expect(session.response?.question).toBe('Graph volume');
  mocks.action.mockRejectedValue(new Error('offline'));
  await act(async () => {
    await session.submitPrompt('Another graph');
  });
  expect(session.error).toBeTruthy();
  mocks.mutation.mockClear();
  await act(() => session.resetAnalysis());
  expect(session.response).toBeUndefined();
  expect(session.response?.question).toBeUndefined();
  expect(session.error).toBeUndefined();
  expect(mocks.mutation).not.toHaveBeenCalled();
});
it('does not reset while an analysis is in flight', async () => {
  let resolve!: (value: { text: string }) => void;
  mocks.action.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await act(() => {
    renderer = create(createElement(Harness));
  });
  let pending!: Promise<boolean>;
  await act(() => {
    pending = session.submitPrompt('Graph volume');
  });
  expect(session.busy).toBe(true);
  await act(() => session.resetAnalysis());
  await act(async () => {
    resolve({ text: 'Completed graph' });
    await pending;
  });
  expect(session.response?.text).toBe('Completed graph');
});

it('restores saved results after remount and starts a new session only after another prompt', async () => {
  mocks.analysis = {
    _id: 'saved-session',
    title: 'Squat progress',
    response: { text: 'Saved result', question: 'How is my squat progressing?' },
  };
  await act(() => {
    renderer = create(createElement(Harness));
  });
  expect(session.response?.text).toBe('Saved result');
  expect(session.response?.question).toBe('How is my squat progressing?');
  expect(session.analysisTitle).toBe('Squat progress');
  mocks.action.mockResolvedValue({ text: 'Updated result' });
  await act(async () => {
    await session.submitPrompt('Squat progress this month');
  });
  expect(mocks.action).toHaveBeenCalledWith({
    prompt: 'Squat progress this month',
    sessionId: 'saved-session',
  });
  mocks.mutation.mockClear();
  await act(() => session.resetAnalysis());
  expect(session.response).toBeUndefined();
  expect(mocks.mutation).not.toHaveBeenCalled();
  await act(async () => {
    await session.submitPrompt('Bench press progress');
  });
  expect(mocks.mutation).toHaveBeenCalledWith({ title: 'Bench press progress' });
});

it('retains the selected session after a failed request so retry stays in the same history', async () => {
  mocks.action.mockRejectedValue(new Error('offline'));
  await act(() => {
    renderer = create(createElement(Harness));
  });
  await act(async () => {
    await session.submitPrompt('Graph volume');
  });
  const firstId = session.analysisId;
  expect(firstId).toBeTruthy();
  mocks.mutation.mockClear();
  mocks.action.mockResolvedValue({ text: 'Done' });
  await act(async () => {
    await session.submitPrompt('Graph volume');
  });
  expect(mocks.mutation).not.toHaveBeenCalled();
  expect(mocks.action).toHaveBeenLastCalledWith({ prompt: 'Graph volume', sessionId: firstId });
});
