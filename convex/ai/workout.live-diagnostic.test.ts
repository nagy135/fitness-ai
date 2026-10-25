import { loadEnvFile } from 'node:process';
import { getFunctionName } from 'convex/server';
import { expect, it, vi } from 'vitest';
import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { respond } from './workout';

it
  .runIf(process.env.RUN_LIVE_WORKOUT_SHORTHAND_TESTS === '1')
  .each(['squats 10x17.5 10x18', 'squats 10×17.5 10×18', 'squats 10 x 17.5, 10 x 18'])(
  'logs every shorthand set with the live model: %s',
  async (prompt) => {
    loadEnvFile('.env.local');
    let providerStatus: number | undefined;
    let failed: unknown;
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const response = await originalFetch(input, init);
      providerStatus = response.status;
      return response;
    });
    // Only the model is live. All workout reads and writes use synthetic state.
    const draft = {
      exercises: [
        {
          rowId: 'squat-row',
          exerciseId: 'squat-exercise',
          name: 'Squats',
          sets: [{ setId: 'warmup', reps: 5, weightKg: 10 }],
        },
      ],
    };
    const receipts = new Map<string, string[]>();
    const ctx = {
      runMutation: async (
        ref: Parameters<typeof getFunctionName>[0],
        args: Record<string, unknown>,
      ) => {
        switch (getFunctionName(ref)) {
          case 'aiMessages:beginWorkoutRequest':
            return { execute: true, request: { prompt } };
          case 'workoutDrafts:addExercises': {
            const key = args.additionKey as string;
            if (receipts.has(key)) return receipts.get(key);
            const additions = args.exercises as {
              exerciseId: string;
              sets: { reps: number; weightKg: number }[];
            }[];
            for (const exercise of additions) {
              expect(exercise.exerciseId).toBe('squat-exercise');
              draft.exercises[0].sets.push(
                ...exercise.sets.map((set) => ({
                  setId: crypto.randomUUID(),
                  ...set,
                })),
              );
            }
            const rowIds = ['squat-row'];
            receipts.set(key, rowIds);
            return rowIds;
          }
          case 'aiChatFocus:request':
            return { status: 'requested', open: args.open, version: 1 };
          case 'aiMessages:finishWorkoutRequest':
            failed = args.failed;
            return null;
          default:
            throw new Error(`Unexpected synthetic mutation: ${getFunctionName(ref)}`);
        }
      },
      runQuery: async (ref: Parameters<typeof getFunctionName>[0]) => {
        switch (getFunctionName(ref)) {
          case 'userProfiles:current':
            return { units: 'metric' };
          case 'exercises:list':
            return [{ _id: 'squat-exercise', name: 'Squats', trackingType: 'weight_reps' }];
          case 'workoutDrafts:current':
            return draft;
          case 'aiMessages:workoutContext':
            return [];
          default:
            throw new Error(`Unexpected synthetic query: ${getFunctionName(ref)}`);
        }
      },
    } as unknown as ActionCtx;
    const run = (
      respond as unknown as {
        _handler: (ctx: ActionCtx, args: { requestId: Id<'workoutRequests'> }) => Promise<unknown>;
      }
    )._handler;
    try {
      await run(ctx, { requestId: 'synthetic-shorthand-request' as Id<'workoutRequests'> });
    } finally {
      fetchSpy.mockRestore();
    }
    expect(failed, `Live provider HTTP status: ${providerStatus ?? 'no response'}`).toBe(false);
    expect(draft.exercises[0].sets.map(({ setId, ...set }) => set)).toEqual([
      { reps: 5, weightKg: 10 },
      { reps: 10, weightKg: 17.5 },
      { reps: 10, weightKg: 18 },
    ]);
  },
  60_000,
);

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
