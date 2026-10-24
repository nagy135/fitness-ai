import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Id } from '@fitness/convex/data-model';
import { AnalysisConversationDrawer } from './analysis-conversation-drawer';
import { WorkoutConversationDrawer } from './workout-conversation-drawer';

type Message = { _id: string; role: 'user' | 'assistant'; text: string; createdAt: number };
const state = vi.hoisted(() => ({
  messages: [] as Message[],
  query: vi.fn(),
  mount: vi.fn(),
  unmount: vi.fn(),
  render: vi.fn(),
}));
vi.mock('@fitness/convex/api', () => ({
  api: { aiMessages: { analysisConversation: 'analysis', workoutConversation: 'workout' } },
}));
vi.mock('convex/react', async () => {
  const { useState } = await import('react');
  return {
    usePaginatedQuery: function useQuery(ref: string, args: unknown) {
      // Like the real hook, changing query arguments (including "skip") resets
      // the pagination. The test must exercise this, not return a static list.
      const key = `${ref}:${JSON.stringify(args)}`;
      const [page, setPage] = useState({ key, count: 2 });
      let count = page.count;
      if (page.key !== key) {
        count = 2;
        setPage({ key, count });
      }
      state.query(ref, args);
      return {
        results: args === 'skip' ? [] : state.messages.slice(0, count),
        status:
          args === 'skip'
            ? 'LoadingFirstPage'
            : count < state.messages.length
              ? 'CanLoadMore'
              : 'Exhausted',
        loadMore: () => setPage((previous) => ({ key, count: previous.count + 2 })),
      };
    },
  };
});
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  ScrollView: 'ScrollView',
  Text: 'Text',
  View: 'View',
}));
vi.mock('lucide-react-native', () => ({
  ArrowLeft: 'ArrowLeft',
  MessageSquareText: 'MessageSquareText',
}));
vi.mock('@fitness/ui', () => ({ Button: 'Button', IconButton: 'IconButton' }));
vi.mock('expo-web-browser', () => ({ openBrowserAsync: vi.fn() }));
vi.mock('./drawer', () => ({ Drawer: 'Drawer' }));
vi.mock('./display-text', () => ({ DisplayText: 'DisplayText' }));
vi.mock('./progress-chart', () => ({ ProgressChart: 'ProgressChart' }));
vi.mock('./tool-call-pills', () => ({ ToolCallPills: 'ToolCallPills' }));
vi.mock('./theme-provider', () => ({ useAppTheme: () => ({ colors: {}, isDark: true }) }));
vi.mock('./analysis-markdown-dom', async () => {
  const { createElement, useEffect } = await import('react');
  return {
    default: function MarkdownDOM({ text }: { text: string }) {
      state.render(text);
      useEffect(() => {
        state.mount();
        return () => {
          state.unmount();
        };
      }, []);
      return createElement('MarkdownDOM', { text });
    },
  };
});

let renderer: ReactTestRenderer;
function panel(mode: 'workout' | 'analysis', visible: boolean, id = 'current') {
  return mode === 'workout'
    ? createElement(WorkoutConversationDrawer, {
        key: id,
        draftId: id as Id<'workoutDrafts'>,
        visible,
      })
    : createElement(AnalysisConversationDrawer, {
        key: id,
        sessionId: id as Id<'analysisSessions'>,
        visible,
      });
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  state.messages = [
    { _id: 'a2', role: 'assistant', text: 'Latest answer', createdAt: 4 },
    { _id: 'u2', role: 'user', text: 'Latest question', createdAt: 3 },
    { _id: 'a1', role: 'assistant', text: 'Earlier answer', createdAt: 2 },
    { _id: 'u1', role: 'user', text: 'Earlier question', createdAt: 1 },
  ];
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});

it.each(['workout', 'analysis'] as const)(
  'keeps %s pages and rendered replies through repeated closes and reopens',
  async (mode) => {
    await act(() => {
      renderer = create(panel(mode, false));
    });
    expect(state.mount).toHaveBeenCalledOnce(); // Prefetches before the first swipe.
    await act(() => renderer.update(panel(mode, true)));
    await act(() => renderer.root.findByType('Button' as never).props.onPress());
    expect(state.mount).toHaveBeenCalledTimes(2);
    const views = renderer.root.findAllByType('MarkdownDOM' as never);
    state.render.mockClear();
    for (let swipe = 0; swipe < 5; swipe++) {
      await act(() => renderer.update(panel(mode, false)));
      await act(() => renderer.update(panel(mode, true)));
    }
    expect(renderer.root.findAllByType('MarkdownDOM' as never)).toEqual(views);
    expect(state.mount).toHaveBeenCalledTimes(2);
    expect(state.unmount).not.toHaveBeenCalled();
    expect(state.render).not.toHaveBeenCalled();
    expect(state.query.mock.calls.every(([, args]) => args !== 'skip')).toBe(true);
    expect(renderer.root.findAllByType('Button' as never)).toHaveLength(0); // Older page stays loaded.
  },
);

it.each(['workout', 'analysis'] as const)(
  'keeps %s live while hidden without recreating an existing reply',
  async (mode) => {
    await act(() => {
      renderer = create(panel(mode, true));
    });
    const view = renderer.root.findByType('MarkdownDOM' as never);
    await act(() => renderer.update(panel(mode, false)));
    state.render.mockClear();
    state.messages = state.messages.map((message) =>
      message._id === 'a2' ? { ...message, text: 'Updated while hidden' } : message,
    );
    await act(() => renderer.update(panel(mode, false)));
    await act(() => renderer.update(panel(mode, true)));
    expect(renderer.root.findByType('MarkdownDOM' as never)).toBe(view);
    expect(view.props.text).toBe('Updated while hidden');
    expect(state.render).toHaveBeenCalledExactlyOnceWith('Updated while hidden');
    expect(state.mount).toHaveBeenCalledOnce();
    expect(state.unmount).not.toHaveBeenCalled();
  },
);

it.each(['workout', 'analysis'] as const)(
  'releases the previous %s view when selecting a different conversation',
  async (mode) => {
    await act(() => {
      renderer = create(panel(mode, true));
    });
    state.messages = [
      { _id: 'new-answer', role: 'assistant', text: 'Different conversation', createdAt: 5 },
    ];
    await act(() => renderer.update(panel(mode, true, 'other')));
    expect(state.unmount).toHaveBeenCalledOnce();
    expect(state.mount).toHaveBeenCalledTimes(2);
    expect(renderer.root.findByType('MarkdownDOM' as never).props.text).toBe(
      'Different conversation',
    );
  },
);
