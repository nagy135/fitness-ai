import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Id } from '@fitness/convex/data-model';
import { AnalysisConversationDrawer } from './analysis-conversation-drawer';

const query = vi.hoisted(() => vi.fn());
vi.mock('convex/react', () => ({ usePaginatedQuery: query }));
vi.mock('@fitness/convex/api', () => ({
  api: { aiMessages: { analysisConversation: 'conversation' } },
}));
vi.mock('./conversation-drawer', () => ({ ConversationDrawer: 'ConversationDrawer' }));
let renderer: ReactTestRenderer;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  query
    .mockReset()
    .mockReturnValue({
      results: [{ _id: 'older-message' }],
      status: 'Exhausted',
      loadMore: vi.fn(),
    });
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});

it('shows an empty conversation for a new analysis without loading legacy messages', async () => {
  await act(() => {
    renderer = create(
      createElement(AnalysisConversationDrawer, { visible: true, onClose: vi.fn() }),
    );
  });
  expect(query).toHaveBeenCalledWith('conversation', 'skip', { initialNumItems: 20 });
  expect(renderer.root.findByProps({ mode: 'analysis' }).props.messages).toEqual([]);
});

it('loads legacy history only when explicitly opened', async () => {
  await act(() => {
    renderer = create(
      createElement(AnalysisConversationDrawer, { visible: true, legacy: true, onClose: vi.fn() }),
    );
  });
  expect(query).toHaveBeenCalledWith(
    'conversation',
    { sessionId: undefined },
    { initialNumItems: 20 },
  );
  expect(renderer.root.findByProps({ mode: 'analysis' }).props.messages).toHaveLength(1);
});

it('scopes an opened conversation to its saved session and supports older pages', async () => {
  const loadMore = vi.fn();
  query.mockReturnValue({ results: [], status: 'CanLoadMore', loadMore });
  await act(() => {
    renderer = create(
      createElement(AnalysisConversationDrawer, {
        sessionId: 'session-1' as Id<'analysisSessions'>,
        visible: true,
        onClose: vi.fn(),
      }),
    );
  });
  expect(query).toHaveBeenCalledWith(
    'conversation',
    { sessionId: 'session-1' },
    { initialNumItems: 20 },
  );
  await act(() => renderer.root.findByProps({ mode: 'analysis' }).props.onLoadOlder());
  expect(loadMore).toHaveBeenCalledWith(20);
});
