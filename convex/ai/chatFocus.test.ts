import { expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { createChatFocusTools } from './chatFocus';

it.each(['workout', 'analysis'] as const)(
  'binds both tools to the server-selected %s context',
  async (mode) => {
    const runMutation = vi.fn(async (_ref, args) => ({
      status: 'requested',
      open: args.open,
      version: 1,
    }));
    const ctx = { runMutation } as unknown as ActionCtx;
    const scope =
      mode === 'workout'
        ? { requestId: 'request' as Id<'workoutRequests'> }
        : { sessionId: 'session' as Id<'analysisSessions'> };
    const tools = createChatFocusTools(ctx, scope);
    const options = { toolCallId: 'focus', messages: [], context: {} };
    expect(await tools.focusChat.execute!({}, options)).toMatchObject({
      status: 'requested',
      open: true,
    });
    expect(await tools.defocusChat.execute!({}, options)).toMatchObject({
      status: 'requested',
      open: false,
    });
    expect(runMutation.mock.calls.map(([ref, args]) => [getFunctionName(ref), args])).toEqual([
      ['aiChatFocus:request', { ...scope, open: true }],
      ['aiChatFocus:request', { ...scope, open: false }],
    ]);
  },
);
