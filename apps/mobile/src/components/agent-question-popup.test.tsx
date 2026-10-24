import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AgentQuestionCard, AgentQuestionPopup } from './agent-question-popup';
import type { Id } from '@fitness/convex/data-model';

const state = vi.hoisted(() => ({ questions: [] as unknown[], respond: vi.fn() }));
vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  ScrollView: 'ScrollView',
  Pressable: 'Pressable',
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));
vi.mock('convex/react', () => ({
  useQuery: () => state.questions,
  useMutation: () => state.respond,
}));
vi.mock('lucide-react-native', () => ({
  MessageCircleQuestion: 'QuestionIcon',
  Minus: 'Minus',
  Send: 'Send',
  X: 'X',
}));
vi.mock('@fitness/ui', () => ({ Button: 'Button', IconButton: 'IconButton', Input: 'Input' }));
vi.mock('./theme-provider', () => ({ useAppTheme: () => ({ colors: {} }) }));

let renderer: ReactTestRenderer;
const question = {
  _id: 'question-1' as Id<'aiQuestions'>,
  question: 'Which exercise did you mean?',
  options: ['Push-ups', 'Squats'],
  expiresAt: Date.now() + 180_000,
};
const respond = vi.fn();
const find = (accessibilityLabel: string) => renderer.root.findByProps({ accessibilityLabel });
async function mount() {
  await act(() => {
    renderer = create(createElement(AgentQuestionCard, { question, count: 1, onRespond: respond }));
  });
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  respond.mockResolvedValue(undefined);
  state.questions = [];
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});

it('sends a suggested answer directly from the popup', async () => {
  await mount();
  await act(() => find('Push-ups').props.onPress());
  expect(respond).toHaveBeenCalledExactlyOnceWith('Push-ups');
});

it('accepts a custom answer and trims it before sending', async () => {
  await mount();
  expect(find('Send answer to agent').props.disabled).toBe(true);
  await act(() => find('Your answer to the agent').props.onChangeText('  Bench press  '));
  await act(() => find('Send answer to agent').props.onPress());
  expect(respond).toHaveBeenCalledExactlyOnceWith('Bench press');
});

it('keeps the answer after a failed send and permits retry', async () => {
  respond.mockRejectedValueOnce(new Error('Offline'));
  await mount();
  await act(() => find('Your answer to the agent').props.onChangeText('Bench press'));
  await act(() => find('Send answer to agent').props.onPress());
  expect(find('Your answer to the agent').props.value).toBe('Bench press');
  expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain(
    'try again',
  );
  await act(() => find('Send answer to agent').props.onPress());
  expect(respond).toHaveBeenCalledTimes(2);
});

it('can minimize and reopen without losing text, or dismiss without answering', async () => {
  await mount();
  await act(() => find('Your answer to the agent').props.onChangeText('Bench'));
  await act(() =>
    renderer.root
      .findAllByProps({ accessibilityLabel: 'Minimize agent question' })[0]
      .props.onPress(),
  );
  expect(renderer.root.findAllByType('Input' as never)).toHaveLength(0);
  expect(respond).not.toHaveBeenCalled();
  await act(() => find('Expand agent question').props.onPress());
  expect(find('Your answer to the agent').props.value).toBe('Bench');
  await act(() => find('Dismiss agent question').props.onPress());
  expect(respond).toHaveBeenCalledExactlyOnceWith(undefined);
});

it('guards repeated taps while a response is in flight', async () => {
  let finish!: () => void;
  respond.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await mount();
  await act(() => {
    find('Push-ups').props.onPress();
    find('Squats').props.onPress();
  });
  expect(respond).toHaveBeenCalledExactlyOnceWith('Push-ups');
  await act(() => finish());
});

it('renders above the current screen at the safe top-right corner and clears state for the next question', async () => {
  state.questions = [question];
  await act(() => {
    renderer = create(createElement(AgentQuestionPopup));
  });
  const overlay = renderer.root.findByProps({ pointerEvents: 'box-none' });
  expect(overlay.props.style).toMatchObject({ position: 'absolute', top: 56, right: 12 });
  await act(() => find('Your answer to the agent').props.onChangeText('Old answer'));
  state.questions = [{ ...question, _id: 'question-2' }];
  await act(() => renderer.update(createElement(AgentQuestionPopup)));
  expect(find('Your answer to the agent').props.value).toBe('');
  await act(() => find('Squats').props.onPress());
  expect(state.respond).toHaveBeenCalledWith({ id: 'question-2', answer: 'Squats' });
});
