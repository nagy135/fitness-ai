import { expect, it } from 'vitest';
import { DEFAULT_AI_SETTINGS, resolveAISettings } from './settings';

it('upgrades saved model tiers without changing supported reasoning effort', () => {
  expect(resolveAISettings()).toEqual(DEFAULT_AI_SETTINGS);
  expect(
    resolveAISettings({ model: 'openai/gpt-5.6-luna', reasoningEffort: 'none' }),
  ).toEqual({ model: 'openai/gpt-6-luna', reasoningEffort: 'none' });
  expect(
    resolveAISettings({ model: 'openai/gpt-5.6-terra', reasoningEffort: 'high' }),
  ).toEqual({ model: 'openai/gpt-6-sol', reasoningEffort: 'high' });
  expect(
    resolveAISettings({ model: 'openai/gpt-5.6-sol', reasoningEffort: 'high' }),
  ).toEqual({ model: 'openai/gpt-6-astra', reasoningEffort: 'high' });
});

it('uses low reasoning for Astra when a saved preference selected none', () => {
  expect(resolveAISettings({ model: 'openai/gpt-5.6-sol', reasoningEffort: 'none' })).toEqual({
    model: 'openai/gpt-6-astra',
    reasoningEffort: 'low',
  });
  expect(resolveAISettings({ model: 'openai/gpt-6-astra', reasoningEffort: 'none' })).toEqual({
    model: 'openai/gpt-6-astra',
    reasoningEffort: 'low',
  });
});
