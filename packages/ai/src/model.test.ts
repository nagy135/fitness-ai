import { afterEach, expect, it, vi } from 'vitest';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { createFitnessModel } from './model';
import { DEFAULT_AI_SETTINGS } from './settings';

afterEach(() => vi.unstubAllGlobals());

it.each([
  { model: DEFAULT_AI_SETTINGS.model, reasoningEffort: undefined, expected: 'low' },
  { model: 'openai/gpt-6-astra' as const, reasoningEffort: 'high' as const, expected: 'high' },
  { model: 'openai/gpt-6-luna' as const, reasoningEffort: 'none' as const, expected: 'none' },
])(
  'sends $model / $expected through the actual OpenRouter adapter',
  async ({ model, reasoningEffort, expected }) => {
    const fetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            id: 'test-response',
            created_at: 1,
            model: model,
            output: [
              {
                type: 'message',
                role: 'assistant',
                id: 'message-1',
                content: [{ type: 'output_text', text: 'OK', annotations: [] }],
              },
            ],
            usage: { input_tokens: 5, output_tokens: 1, total_tokens: 6 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetch);
    const result = await generateText({
      model: createFitnessModel({
        provider: 'openrouter',
        model: model,
        apiKey: 'test-key',
        reasoningEffort,
      }),
      prompt: 'Reply OK',
      maxRetries: 0,
    });
    expect(result.text).toBe('OK');
    expect(String(fetch.mock.calls[0]?.[0])).toBe('https://openrouter.ai/api/v1/responses');
    const init = fetch.mock.calls[0]![1]!;
    expect(JSON.parse(String(init.body))).toMatchObject({
      model,
      reasoning: { effort: expected },
    });
  },
);

it('sends workout tools through Responses and reads a function call', async () => {
  const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(
      JSON.stringify({
        id: 'test-response',
        created_at: 1,
        model: 'openai/gpt-6-sol',
        output: [
          {
            type: 'function_call',
            id: 'call-item-1',
            call_id: 'call-1',
            name: 'add_set',
            arguments: '{"reps":5}',
          },
        ],
        usage: { input_tokens: 5, output_tokens: 1, total_tokens: 6 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  );
  vi.stubGlobal('fetch', fetch);
  const result = await generateText({
    model: createFitnessModel({
      provider: 'openrouter',
      model: 'openai/gpt-6-sol',
      apiKey: 'test-key',
    }),
    prompt: 'Add five reps',
    tools: { add_set: tool({ inputSchema: z.object({ reps: z.number() }) }) },
    maxRetries: 0,
  });
  const request = JSON.parse(String(fetch.mock.calls[0]![1]!.body));
  expect(request.tools).toEqual(
    expect.arrayContaining([expect.objectContaining({ type: 'function', name: 'add_set' })]),
  );
  expect(result.toolCalls).toEqual([
    expect.objectContaining({ toolName: 'add_set', input: { reps: 5 } }),
  ]);
});
