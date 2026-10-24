import { tool } from 'ai';
import { z } from 'zod';
import { internal } from '../_generated/api';
import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';

type Scope = { requestId: Id<'workoutRequests'> } | { sessionId: Id<'analysisSessions'> };

export function createChatFocusTools(ctx: ActionCtx, scope: Scope) {
  const inputSchema = z.object({}).strict();
  const request = (
    open: boolean,
  ): Promise<{ status: 'requested'; open: boolean; version: number }> =>
    ctx.runMutation(internal.aiChatFocus.request, { ...scope, open });
  return {
    focusChat: tool({
      description:
        'Bring attention to this conversation by opening Chat in the current workout or analysis. In workout mode, you MUST call this before your final reply when no draft change succeeded in this request, including read-only answers, no-data results, and failed writes. In analysis, use when a substantive explanation deserves attention. Honor an explicit user request to open or close Chat. This is a live UI request; it does not change modes, workout data, or keyboard focus. Do not call while waiting for an askUser popup or together with defocusChat.',
      inputSchema,
      execute: () => request(true),
    }),
    defocusChat: tool({
      description:
        'Move attention away from Chat by closing it and returning to the current workout exercises or analysis overview. In workout mode, you MUST call this after successfully logging or changing reps, sets, or exercises in the active draft in this request, even if there were also read-only calls or later failures. A failed write or catalog-only change does not count as logging into the draft. In analysis, use to show the overview or chart. Honor an explicit user request to open or close Chat. Does not switch modes, erase messages, or dismiss an askUser popup. Do not call together with focusChat.',
      inputSchema,
      execute: () => request(false),
    }),
  };
}
