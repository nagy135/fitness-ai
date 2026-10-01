import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import ConfirmWorkoutScreen from './confirm-screen';

const state = vi.hoisted(() => ({
  draft: {
    _id: 'draft-1',
    date: '2026-09-10',
    editingWorkoutId: undefined as string | undefined,
    performedAt: undefined as number | undefined,
    exercises: [
      {
        rowId: 'row-1',
        exerciseId: 'exercise-1',
        name: 'Squat',
        sets: [{ setId: 'set-1', weightKg: 80, reps: 8 }],
      },
    ],
  },
  confirm: vi.fn(),
  discard: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
}));
vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Text: 'Text',
  View: 'View',
}));
vi.mock('lucide-react-native', () => ({
  ArrowLeft: 'ArrowLeft',
  Check: 'Check',
  CalendarDays: 'CalendarDays',
  ChevronDown: 'ChevronDown',
  ChevronUp: 'ChevronUp',
}));
vi.mock('expo-router', () => ({
  Redirect: 'Redirect',
  router: { canGoBack: () => true, back: state.back, replace: state.replace },
}));
vi.mock('convex/react', () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref) === 'workoutDrafts:current'
      ? state.draft
      : [{ _id: 'exercise-1', trackingType: 'weight_reps' }],
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref) === 'workouts:confirmDraft' ? state.confirm : state.discard,
}));
vi.mock('@fitness/ui', () => ({ Button: 'Button', IconButton: 'IconButton', Input: 'Input' }));
vi.mock('@/components/theme-provider', () => ({ useAppTheme: () => ({ colors: {} }) }));
vi.mock('@/components/screen', () => ({ Screen: 'Screen' }));
vi.mock('@/components/loading-screen', () => ({ LoadingScreen: 'LoadingScreen' }));
vi.mock('@/components/display-text', () => ({ DisplayText: 'DisplayText' }));
vi.mock('@/components/error-notice', () => ({ ErrorNotice: 'ErrorNotice' }));
vi.mock('@/components/workout-history-calendar', () => ({ WorkoutHistoryCalendar: 'Calendar' }));
vi.mock('./use-workout-name', () => ({
  useWorkoutName: () => ({ name: 'Legs', setName: vi.fn() }),
}));
let renderer: ReactTestRenderer;
async function mount() {
  await act(() => {
    renderer = create(createElement(ConfirmWorkoutScreen));
  });
}
async function openCalendar() {
  await act(() =>
    renderer.root.findByProps({ accessibilityLabel: 'Change workout date' }).props.onPress(),
  );
  return renderer.root.findByType('Calendar' as never);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 30, 9, 15));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  state.draft.editingWorkoutId = undefined;
  state.draft.performedAt = undefined;
  state.confirm.mockResolvedValue('saved');
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('defaults an old active draft to today and puts the date above the name', async () => {
  await mount();
  const calendar = await openCalendar();
  expect(calendar.props.selectedDate).toEqual(new Date(2026, 8, 30, 9, 15));
  const fields = renderer.root
    .findByType('ScrollView' as never)
    .findAll(
      (node) =>
        node.props.children === 'Workout date' || node.props.label === 'Workout name (optional)',
    );
  expect(fields.map((node) => node.props.label ?? node.props.children)).toEqual([
    'Workout date',
    'Workout name (optional)',
  ]);
  expect(state.confirm).not.toHaveBeenCalled();
});
it('keeps date changes local until confirmation and sends local noon for the chosen day', async () => {
  await mount();
  const calendar = await openCalendar();
  await act(() => calendar.props.onSelectDate(new Date(2026, 9, 25)));
  expect(state.confirm).not.toHaveBeenCalled();
  expect(state.discard).not.toHaveBeenCalled();
  await act(() =>
    renderer.root.findByProps({ accessibilityLabel: 'Confirm workout' }).props.onPress(),
  );
  expect(state.confirm).toHaveBeenCalledExactlyOnceWith({
    draftId: 'draft-1',
    name: 'Legs',
    performedAt: new Date(2026, 9, 25, 12).getTime(),
  });
});
it('leaves the draft unchanged when returning to the workout without confirming', async () => {
  await mount();
  const calendar = await openCalendar();
  await act(() => calendar.props.onSelectDate(new Date(2026, 8, 29)));
  await act(() =>
    renderer.root.findByProps({ accessibilityLabel: 'Continue workout' }).props.onPress(),
  );
  expect(state.back).toHaveBeenCalledOnce();
  expect(state.confirm).not.toHaveBeenCalled();
  expect(state.draft.date).toBe('2026-09-10');
});
it('preserves the saved workout date when reviewing a history edit', async () => {
  state.draft.editingWorkoutId = 'saved';
  state.draft.performedAt = new Date(2026, 7, 20, 8, 30).getTime();
  await mount();
  const calendar = await openCalendar();
  expect(calendar.props.selectedDate.getTime()).toBe(state.draft.performedAt);
  await act(() =>
    renderer.root.findByProps({ accessibilityLabel: 'Save workout changes' }).props.onPress(),
  );
  expect(state.confirm).toHaveBeenCalledWith(
    expect.objectContaining({ performedAt: state.draft.performedAt }),
  );
});
