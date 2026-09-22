import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateText, stepCountIs, tool } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { z } from 'zod';
import { observeAI } from './telemetry';

afterEach(() => vi.restoreAllMocks());

describe('AI timing logs', () => {
  it('separates real SDK model/tool steps and excludes request, tool, and response contents', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const usage = {
      inputTokens: { total: 100, noCache: 80, cacheRead: 20, cacheWrite: 0 },
      outputTokens: { total: 15, text: 5, reasoning: 10 },
    };
    const model = new MockLanguageModelV3({
      doGenerate: [
        {
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'lookup',
              input: '{"query":"PRIVATE_INPUT"}',
            },
          ],
          finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
          usage,
          warnings: [],
        },
        {
          content: [{ type: 'text', text: 'PRIVATE_RESPONSE' }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage,
          warnings: [],
        },
      ],
    });
    const result = await observeAI('analysis', async (trace) => {
      await trace.time('load_context', async () => 'PRIVATE_CONTEXT');
      return trace.time('generate_response', () =>
        generateText({
          model,
          prompt: 'PRIVATE_PROMPT',
          ...trace.generation('response'),
          tools: {
            lookup: tool({
              inputSchema: z.object({ query: z.string() }),
              execute: async () => 'PRIVATE_TOOL_RESULT',
            }),
          },
          stopWhen: stepCountIs(2),
        }),
      );
    });
    expect(result.text).toBe('PRIVATE_RESPONSE');
    const events = log.mock.calls.map(([line]) => JSON.parse(line));
    expect(new Set(events.map((event) => event.traceId)).size).toBe(1);
    expect(events.filter((event) => event.event === 'model_end')).toEqual([
      expect.objectContaining({
        step: 0,
        inputTokens: 100,
        outputTokens: 15,
        reasoningTokens: 10,
        cachedInputTokens: 20,
      }),
      expect.objectContaining({ step: 1, inputTokens: 100 }),
    ]);
    expect(events.find((event) => event.event === 'tool_end')).toMatchObject({
      tool: 'lookup',
      status: 'success',
    });
    expect(events.at(-1)).toMatchObject({
      event: 'request_end',
      status: 'success',
      modelCalls: 2,
      toolCalls: 1,
    });
    expect(events.at(-1).modelMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(events)).not.toContain('PRIVATE_');
  });

  it('retains failure timing and rethrows the original error without logging its contents', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const error = new Error('PRIVATE_ERROR');
    await expect(
      observeAI('workout', (trace) =>
        trace.time('generate_response', async () => {
          throw error;
        }),
      ),
    ).rejects.toBe(error);
    const events = log.mock.calls.map(([line]) => JSON.parse(line));
    expect(events.at(-2)).toMatchObject({ event: 'stage_end', status: 'failed' });
    expect(events.at(-1)).toMatchObject({ event: 'request_end', status: 'failed' });
    expect(JSON.stringify(events)).not.toContain('PRIVATE_ERROR');
  });

  it('does not fail the action if the logging sink throws', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {
      throw new Error('sink unavailable');
    });
    await expect(
      observeAI('workoutName', async (trace) => {
        trace.status = 'skipped';
        return trace.time('load_naming_context', async () => '');
      }),
    ).resolves.toBe('');
  });
});
