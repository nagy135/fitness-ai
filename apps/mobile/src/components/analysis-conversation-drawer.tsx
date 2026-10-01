import { usePaginatedQuery } from 'convex/react';
import { api } from '@fitness/convex/api';
import type { Id } from '@fitness/convex/data-model';
import { ConversationDrawer } from './conversation-drawer';

export function AnalysisConversationDrawer({
  sessionId,
  legacy = false,
  visible,
  onClose,
}: {
  sessionId?: Id<'analysisSessions'>;
  legacy?: boolean;
  visible: boolean;
  onClose: () => void;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.aiMessages.analysisConversation,
    visible && (sessionId || legacy) ? { sessionId } : 'skip',
    { initialNumItems: 20 },
  );
  return (
    <ConversationDrawer
      messages={!sessionId && !legacy ? [] : status === 'LoadingFirstPage' ? undefined : results}
      mode="analysis"
      visible={visible}
      onClose={onClose}
      loadingOlder={status === 'LoadingMore'}
      onLoadOlder={status === 'CanLoadMore' ? () => loadMore(20) : undefined}
    />
  );
}
