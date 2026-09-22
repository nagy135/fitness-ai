import { afterEach, expect, it, vi } from 'vitest';
import { generateText } from 'ai';
import { createFitnessModel } from './model';
import { DEFAULT_AI_SETTINGS } from './settings';

afterEach(() => vi.unstubAllGlobals());

it.each([
  { model: DEFAULT_AI_SETTINGS.model, reasoningEffort: undefined, expected: 'low' },
  { model: 'openai/gpt-5.6-sol', reasoningEffort: 'high' as const, expected: 'high' },
  { model: 'openai/gpt-5.6-luna', reasoningEffort: 'none' as const, expected: 'none' },
])(
  'sends $model / $expected through the actual OpenRouter adapter',
  async ({ model, reasoningEffort, expected }) => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: 'test-response',
            created: 1,
            model: model,
            choices: [
              { index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' },
            ],
            usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
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
    const init = (fetch.mock.calls[0] as unknown as [unknown, RequestInit])[1];
    expect(JSON.parse(String(init.body))).toMatchObject({
      model,
      reasoning: { effort: expected },
    });
  },
);
