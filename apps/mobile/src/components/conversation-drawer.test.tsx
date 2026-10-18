import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConversationDrawer } from './conversation-drawer';

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  ScrollView: 'ScrollView',
  Text: 'Text',
  View: 'View',
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));
vi.mock('lucide-react-native', () => ({
  ArrowLeft: 'ArrowLeft',
  MessageSquareText: 'MessageSquareText',
}));
vi.mock('@fitness/ui', () => ({ Button: 'Button', IconButton: 'IconButton' }));
vi.mock('./display-text', () => ({ DisplayText: 'DisplayText' }));
vi.mock('./analysis-markdown', () => ({ AnalysisMarkdown: 'AnalysisMarkdown' }));
vi.mock('./progress-chart', () => ({ ProgressChart: 'ProgressChart' }));
vi.mock('./tool-call-pills', () => ({ ToolCallPills: 'ToolCallPills' }));
vi.mock('./theme-provider', () => ({
  useAppTheme: () => ({ colors: { accent: '#ffb38c', text: '#fff', muted: '#aaa' } }),
}));

let renderer: ReactTestRenderer;
beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));
afterEach(async () => {
  await act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});

it.each(['workout', 'analysis'] as const)(
  'uses the shared compact tool pills between the matching question and answer in %s',
  async (mode) => {
    const toolCalls = [
      { toolCallId: 'lookup', toolName: 'getExerciseHistory', input: '{}', output: '[]' },
    ];
    const onClose = vi.fn();
    await act(() => {
      renderer = create(
        createElement(ConversationDrawer, {
          mode,
          visible: true,
          onClose,
          messages: [
            { _id: 'answer', role: 'assistant', text: 'Latest answer', toolCalls, createdAt: 3 },
            { _id: 'question', role: 'user', text: 'Latest question', createdAt: 2 },
            { _id: 'old', role: 'assistant', text: 'Earlier answer without tools', createdAt: 1 },
          ],
        }),
      );
    });
    const rendered = JSON.stringify(renderer.toJSON());
    expect(rendered.indexOf('Earlier answer without tools')).toBeLessThan(
      rendered.indexOf('Latest question'),
    );
    expect(rendered.indexOf('Latest question')).toBeLessThan(
      rendered.indexOf('getExerciseHistory'),
    );
    expect(rendered.indexOf('getExerciseHistory')).toBeLessThan(rendered.indexOf('Latest answer'));
    expect(renderer.root.findAllByType('ToolCallPills' as never)).toHaveLength(1);
    expect(renderer.root.findByType('ToolCallPills' as never).props).toEqual({ calls: toolCalls });
    await act(() =>
      renderer.root
        .findByProps({
          accessibilityLabel: mode === 'workout' ? 'Back to workout' : 'Back to analysis',
        })
        .props.onPress(),
    );
    expect(onClose).toHaveBeenCalledOnce();
  },
);
