import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';

// Checked in the same transaction as each draft write. Expired actions cannot
// write into a later request or a new draft, even if they resume after a timeout.
export async function assertWorkoutRequest(
  ctx: MutationCtx,
  userId: Id<'userProfiles'>,
  draftId: Id<'workoutDrafts'>,
  args: { source: 'ai' | 'user_ui'; requestId?: Id<'workoutRequests'> },
) {
  if (args.source === 'ai') {
    const request = args.requestId ? await ctx.db.get(args.requestId) : null;
    if (
      !request ||
      request.userId !== userId ||
      request.draftId !== draftId ||
      request.status !== 'running' ||
      request.expiresAt <= Date.now()
    )
      throw new Error('Workout request is no longer active');
  } else {
    if (args.requestId) throw new Error('Request IDs are reserved for AI writes');
    const requests = await ctx.db
      .query('workoutRequests')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    if (requests.some((request) => request.status === 'running' && request.expiresAt > Date.now()))
      throw new Error('Wait for the workout request to finish before editing or confirming');
  }
}
