import { tool } from 'ai';
import { AskUserSchema } from '@fitness/ai';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import type { ActionCtx } from '../_generated/server';

type Scope =
  | { mode: 'workout'; requestId: Id<'workoutRequests'> }
  | { mode: 'analysis'; sessionId: Id<'analysisSessions'> };
type QuestionResult = { question: string; status: string; answer?: string };

/** Keep the answer in this tool result so the next model step receives it directly. */
export function createAskUser(ctx: ActionCtx, scope: Scope) {
  // All questions in one generation share a wait budget below Convex's action limit.
  const deadline = Date.now() + 6 * 60_000;
  let active: Promise<QuestionResult> | undefined;
  let stopped = false;
  let stopText = '';
  return {
    stopped: () => stopped,
    stopText: () => stopText,
    tool: tool({
      description:
        'Ask the user one necessary clarification in a popup without opening Chat. Supply up to four short suggested answers, or no options for free text. This waits for and returns their actual answer; continue the original request using it. Ask only when the conversation, catalog, and tools cannot resolve missing information. Call by itself, before any changes that depend on the answer. If dismissed or expired, stop and preserve existing data; never guess an answer.',
      inputSchema: AskUserSchema,
      execute: async (input): Promise<QuestionResult> => {
        if (stopped) return { question: input.question, status: 'expired' };
        // Reject parallel asks rather than stacking blocking popups.
        if (active) throw new Error('Ask one question at a time');
        const wait = async (): Promise<QuestionResult> => {
          const expiresAt = Math.min(deadline, Date.now() + 3 * 60_000);
          if (expiresAt <= Date.now()) {
            stopped = true;
            stopText = 'The question timed out. Send a new message when you’re ready.';
            return { question: input.question, status: 'expired' };
          }
          const id = await ctx.runMutation(internal.aiQuestions.create, {
            ...scope,
            ...input,
            expiresAt,
          });
          try {
            while (true) {
              const question = await ctx.runQuery(internal.aiQuestions.read, { id });
              if (question.status !== 'pending') {
                stopped = question.status !== 'answered';
                stopText =
                  question.status === 'dismissed'
                    ? 'Question dismissed. Send a new message when you’re ready.'
                    : 'The question timed out. Send a new message when you’re ready.';
                return {
                  question: question.question,
                  status: question.status,
                  ...(question.answer ? { answer: question.answer } : {}),
                };
              }
              if (Date.now() >= expiresAt) {
                // Closing is transactional: an answer committed just before the
                // deadline wins, and is read on the next iteration.
                await ctx.runMutation(internal.aiQuestions.close, { id });
                continue;
              }
              await new Promise((resolve) => setTimeout(resolve, 1_000));
            }
          } finally {
            // Expiry is also scheduled durably. A cleanup outage must not turn
            // an already received answer into a failed tool result.
            await ctx.runMutation(internal.aiQuestions.close, { id }).catch(() => undefined);
          }
        };
        active = wait();
        try {
          return await active;
        } finally {
          active = undefined;
        }
      },
    }),
  };
}
