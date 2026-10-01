import { loadEnvFile } from 'node:process';
import { getFunctionName } from 'convex/server';
import { it, vi } from 'vitest';
import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { respond } from './workout';

it.runIf(process.env.RUN_LIVE_AI_DIAGNOSTICS === '1')(
  'diagnoses the full workout action',
  async () => {
    loadEnvFile('.env.local');
    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init);
      if (String(input).includes('openrouter.ai')) {
        process.stdout.write(
          JSON.stringify({ status: response.status, body: await response.clone().text() }) + '\n',
        );
      }
      return response;
    });
    const ctx = {
      runMutation: async (ref: Parameters<typeof getFunctionName>[0]) =>
        getFunctionName(ref) === 'aiMessages:beginWorkoutRequest'
          ? { execute: true, request: { prompt: 'Reply OK.' } }
          : null,
      runQuery: async (ref: Parameters<typeof getFunctionName>[0]) => {
        switch (getFunctionName(ref)) {
          case 'userProfiles:current':
            return {
              units: 'metric',
              aiSettings: { model: 'openai/gpt-6-sol', reasoningEffort: 'low' },
            };
          case 'exercises:list':
            return [];
          case 'workoutDrafts:current':
            return { exercises: [] };
          default:
            return [];
        }
      },
    } as unknown as ActionCtx;
    const run = (respond as unknown as { _handler: typeof respond })._handler as unknown as (
      ctx: ActionCtx,
      args: { requestId: Id<'workoutRequests'> },
    ) => Promise<{ text: string }>;
    const result = await run(ctx, { requestId: 'diagnostic-request' as Id<'workoutRequests'> });
    process.stdout.write(JSON.stringify({ result: result.text }) + '\n');
    vi.unstubAllGlobals();
  },
);
