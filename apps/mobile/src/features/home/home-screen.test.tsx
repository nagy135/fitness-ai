import { createElement, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HomeScreen from './home-screen';

const state = vi.hoisted(() => ({
  mode: 'workout' as 'workout' | 'analysis',
  exercises: [] as { sets: { reps: number }[] }[],
  setParams: vi.fn(),
  push: vi.fn(),
  enqueue: vi.fn(async () => true),
}));
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  ScrollView: 'ScrollView',
  Text: 'Text',
  View: 'View',
}));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ mode: state.mode }),
  router: { setParams: state.setParams, push: state.push },
}));
vi.mock('lucide-react-native', () => ({
  BrainCircuit: 'BrainCircuit',
  History: 'History',
  MessageSquareText: 'MessageSquareText',
  Settings: 'Settings',
  Plus: 'Plus',
}));
vi.mock('@fitness/ui', () => ({
  Button: 'Button',
  IconButton: 'IconButton',
  ModeSwitch: 'ModeSwitch',
}));
vi.mock('@/components/screen', () => ({
  Screen: ({ children, headerActions }: { children: ReactNode; headerActions: ReactNode }) =>
    createElement('Screen', null, headerActions, children),
}));
vi.mock('@/components/chat-pages', () => ({
  ChatPages: ({ children, panel, ...props }: { children: ReactNode; panel: ReactNode }) =>
    createElement('ChatPages', props, children, panel),
}));
vi.mock('@/components/loading-screen', () => ({ LoadingScreen: 'LoadingScreen' }));
vi.mock('@/components/prompt-bar', () => ({ PromptBar: 'PromptBar' }));
vi.mock('@/components/workout-conversation-drawer', () => ({
  WorkoutConversationDrawer: 'WorkoutConversation',
}));
vi.mock('@/components/analysis-conversation-drawer', () => ({
  AnalysisConversationDrawer: 'AnalysisConversation',
}));
vi.mock('@/components/analysis-markdown', () => ({ AnalysisMarkdown: 'AnalysisMarkdown' }));
vi.mock('@/components/tool-call-pills', () => ({ ToolCallPills: 'ToolCallPills' }));
vi.mock('@/components/analysis-history-drawer', () => ({
  AnalysisHistoryDrawer: 'AnalysisHistory',
}));
vi.mock('@/components/theme-provider', () => ({ useAppTheme: () => ({ colors: {} }) }));
vi.mock('@/features/workout/workout-table', () => ({ WorkoutTable: 'WorkoutTable' }));
vi.mock('@/features/workout/workout-review-bar', () => ({ WorkoutReviewBar: 'WorkoutReview' }));
vi.mock('@/components/progress-chart', () => ({ ProgressChart: 'ProgressChart' }));
vi.mock('@/components/workout-history-drawer', () => ({ WorkoutHistoryDrawer: 'WorkoutHistory' }));
vi.mock('@/components/error-notice', () => ({ ErrorNotice: 'ErrorNotice' }));
vi.mock('@/features/settings/quick-model-settings', () => ({
  QuickModelSettings: 'QuickModelSettings',
}));
vi.mock('./use-workout-session', () => ({
  useWorkoutSession: () => ({
    ready: true,
    draft: { _id: 'draft', exercises: state.exercises },
    busy: false,
    savingSets: false,
    analysisLoading: false,
    analysisId: 'analysis',
    response: { text: 'Answer', question: 'Question' },
    submitPrompt: vi.fn(),
    resetAnalysis: vi.fn(),
  }),
}));
vi.mock('./use-prompt-queue', () => ({
  usePromptQueue: () => ({ hasWork: false, pending: [], enqueue: state.enqueue }),
}));

let renderer: ReactTestRenderer;
const find = (type: string) => renderer.root.findByType(type as never);
async function mount() {
  await act(() => {
    renderer = create(createElement(HomeScreen));
  });
}
async function open() {
  await act(() => renderer.root.findByProps({ accessibilityLabel: 'Open chat' }).props.onPress());
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  state.mode = 'workout';
  state.exercises = [];
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});

it.each(['workout', 'analysis'] as const)(
  'keeps the header, mode switch and usable composer outside the page transition in %s',
  async (mode) => {
    state.mode = mode;
    await mount();
    const prompt = find('PromptBar');
    const modes = find('ModeSwitch');
    const pages = find('ChatPages');
    expect(pages.findAllByType('PromptBar' as never)).toHaveLength(0);
    expect(pages.findAllByType('ModeSwitch' as never)).toHaveLength(0);
    expect(pages.findAllByType('IconButton' as never)).toHaveLength(0);
    await act(() => prompt.props.onChangeText('Follow-up'));
    await open();
    expect(find('ChatPages').props.open).toBe(true);
    expect(find('PromptBar')).toBe(prompt);
    expect(find('ModeSwitch')).toBe(modes);
    expect(prompt.props.value).toBe('Follow-up');
    expect(prompt.props.voiceEnabled).toBe(true);
    await act(() => prompt.props.onSubmit('Follow-up'));
    expect(state.enqueue).toHaveBeenCalledWith('Follow-up');
    await act(() =>
      renderer.root.findByProps({ accessibilityLabel: 'Close chat' }).props.onPress(),
    );
    expect(find('ChatPages').props.open).toBe(false);
  },
);

it('switches the selected conversation using the fixed mode switch while the panel is open', async () => {
  await mount();
  await open();
  await act(() => find('ModeSwitch').props.onChange('analysis'));
  expect(state.setParams).toHaveBeenCalledWith({ mode: 'analysis' });
  state.mode = 'analysis';
  await act(() => renderer.update(createElement(HomeScreen)));
  expect(find('ChatPages').props.open).toBe(true);
  expect(find('AnalysisConversation').props).toMatchObject({
    visible: true,
    sessionId: 'analysis',
  });
  expect(find('PromptBar').props.placeholder).toBe('Ask about your training…');
});

it('still requires workout review when switching out of an unsaved workout from the open panel', async () => {
  state.exercises = [{ sets: [{ reps: 10 }] }];
  await mount();
  await open();
  await act(() => find('ModeSwitch').props.onChange('analysis'));
  expect(state.push).toHaveBeenCalledWith('/workout/confirm');
  expect(state.setParams).not.toHaveBeenCalled();
});

it('opens the current workout chat from the bottom Chat button', async () => {
  state.exercises = [{ sets: [{ reps: 10 }] }];
  await mount();
  await act(() => find('WorkoutReview').props.onChat());
  expect(find('ChatPages').props.open).toBe(true);
  expect(find('WorkoutConversation').props.visible).toBe(true);
  await act(() => find('WorkoutConversation').props.onClose());
  expect(find('ChatPages').props.open).toBe(false);
});
