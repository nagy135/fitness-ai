import { afterEach, expect, it, vi } from 'vitest';
import { generateText, stepCountIs, tool } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { z } from 'zod';
import { ToolCallRecorder } from './toolCallRecorder';
import { observeAI } from './telemetry';

afterEach(() => vi.restoreAllMocks());

it('records real SDK calls in invocation order with results/errors and keeps timing logs private', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const calls = new ToolCallRecorder();
  const usage = {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 5, text: 5, reasoning: 0 },
  };
  const model = new MockLanguageModelV3({
    doGenerate: [
      {
        content: ['first', 'second', 'failed'].map((query) => ({
          type: 'tool-call' as const,
          toolCallId: query,
          toolName: 'lookup',
          input: JSON.stringify({ query: `PRIVATE_${query}` }),
        })),
        finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
        usage,
        warnings: [],
      },
      {
        content: [{ type: 'text', text: 'Done' }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage,
        warnings: [],
      },
    ],
  });
  await observeAI('analysis', async (trace) =>
    generateText({
      ...calls.generation(trace.generation('response')),
      model,
      prompt: 'Look up my records',
      tools: {
        lookup: tool({
          inputSchema: z.object({ query: z.string() }),
          execute: async ({ query }) => {
            if (query === 'PRIVATE_failed') throw new Error('PRIVATE_ERROR');
            return { query, sets: [{ reps: 10, weightKg: 80 }] };
          },
        }),
      },
      stopWhen: stepCountIs(2),
    }),
  );
  expect(calls.calls.map((call) => call.toolCallId)).toEqual(['first', 'second', 'failed']);
  expect(calls.calls.every((call) => call.toolName === 'lookup')).toBe(true);
  expect(JSON.parse(calls.calls[1].input)).toEqual({ query: 'PRIVATE_second' });
  expect(JSON.parse(calls.calls[1].output!)).toEqual({
    query: 'PRIVATE_second',
    sets: [{ reps: 10, weightKg: 80 }],
  });
  expect(JSON.parse(calls.calls[2].error!)).toEqual({ name: 'Error', message: 'PRIVATE_ERROR' });
  expect(calls.calls[2].output).toBeUndefined();
  const events = log.mock.calls.map(([line]) => JSON.parse(line));
  expect(events.at(-1)).toMatchObject({ toolCalls: 3, modelCalls: 2 });
  expect(JSON.stringify(events)).not.toContain('PRIVATE_');
});
