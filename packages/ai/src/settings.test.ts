import { expect, it } from 'vitest';
import {
  AI_MODELS,
  AI_REASONING_OPTIONS,
  DEFAULT_AI_SETTINGS,
  LEGACY_AI_MODEL_IDS,
  resolveAISettings,
  supportsReasoningEffort,
} from './settings';

it('offers only Sol and Luna and defaults to GPT-6.1 Sol / Low', () => {
  expect(AI_MODELS).toEqual([
    { id: 'openai/gpt-6-luna', name: 'GPT-6 Luna' },
    { id: 'openai/gpt-6.1-sol', name: 'GPT-6.1 Sol' },
  ]);
  expect(resolveAISettings()).toEqual({ model: 'openai/gpt-6.1-sol', reasoningEffort: 'low' });
  expect(resolveAISettings()).toEqual(DEFAULT_AI_SETTINGS);
});

it.each(LEGACY_AI_MODEL_IDS)(
  'upgrades saved %s without changing supported reasoning effort',
  (model) => {
    expect(resolveAISettings({ model, reasoningEffort: 'high' })).toEqual({
      model: model === 'openai/gpt-5.6-luna' ? 'openai/gpt-6-luna' : 'openai/gpt-6.1-sol',
      reasoningEffort: 'high',
    });
    expect(resolveAISettings({ model, reasoningEffort: 'none' })).toEqual({
      model: model === 'openai/gpt-5.6-luna' ? 'openai/gpt-6-luna' : 'openai/gpt-6.1-sol',
      reasoningEffort: model === 'openai/gpt-5.6-luna' ? 'none' : 'low',
    });
  },
);

it.each(AI_REASONING_OPTIONS)('normalizes GPT-6.1 Sol $id reasoning consistently', ({ id }) => {
  const settings = { model: 'openai/gpt-6.1-sol' as const, reasoningEffort: id };
  expect(supportsReasoningEffort(settings.model, id)).toBe(id !== 'none');
  expect(resolveAISettings(settings)).toEqual({
    ...settings,
    reasoningEffort: id === 'none' ? 'low' : id,
  });
});

it.each(AI_REASONING_OPTIONS)('preserves Luna $id reasoning', ({ id }) => {
  const settings = { model: 'openai/gpt-6-luna' as const, reasoningEffort: id };
  expect(supportsReasoningEffort(settings.model, id)).toBe(true);
  expect(resolveAISettings(settings)).toEqual(settings);
});
