import { usePaginatedQuery } from 'convex/react';
import { api } from '@fitness/convex/api';
import type { Id } from '@fitness/convex/data-model';
import { ConversationDrawer } from './conversation-drawer';

export function WorkoutConversationDrawer({
  draftId,
  visible,
  onClose,
}: {
  draftId: Id<'workoutDrafts'>;
  visible: boolean;
  onClose: () => void;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.aiMessages.workoutConversation,
    visible ? { draftId } : 'skip',
    { initialNumItems: 20 },
  );
  return (
    <ConversationDrawer
      messages={status === 'LoadingFirstPage' ? undefined : results}
      mode="workout"
      visible={visible}
      onClose={onClose}
      loadingOlder={status === 'LoadingMore'}
      onLoadOlder={status === 'CanLoadMore' ? () => loadMore(20) : undefined}
    />
  );
}
