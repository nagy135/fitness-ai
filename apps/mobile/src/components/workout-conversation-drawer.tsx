import { usePaginatedQuery } from 'convex/react';
import { api } from '@fitness/convex/api';
import type { Id } from '@fitness/convex/data-model';
import { ConversationDrawer } from './conversation-drawer';

export function WorkoutConversationDrawer({
  draftId,
  visible,
}: {
  draftId: Id<'workoutDrafts'>;
  visible: boolean;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.aiMessages.workoutConversation,
    // Keep the current draft warm offscreen, including any earlier pages.
    { draftId },
    { initialNumItems: 20 },
  );
  return (
    <ConversationDrawer
      messages={status === 'LoadingFirstPage' ? undefined : results}
      mode="workout"
      visible={visible}
      loadingOlder={status === 'LoadingMore'}
      onLoadOlder={status === 'CanLoadMore' ? () => loadMore(20) : undefined}
    />
  );
}
