export const AI_MODELS = [
  { id: 'openai/gpt-6-luna', name: 'GPT-6 Luna' },
  { id: 'openai/gpt-6-sol', name: 'GPT-6 Sol' },
  { id: 'openai/gpt-6-astra', name: 'GPT-6 Astra' },
] as const;

// Older saved preferences must remain readable while profiles are upgraded.
export const LEGACY_AI_MODEL_IDS = [
  'openai/gpt-5.6-luna',
  'openai/gpt-5.6-terra',
  'openai/gpt-5.6-sol',
] as const;

export const AI_REASONING_OPTIONS = [
  { id: 'none', name: 'None' },
  { id: 'low', name: 'Low' },
  { id: 'medium', name: 'Medium' },
  { id: 'high', name: 'High' },
  { id: 'xhigh', name: 'Extra high' },
] as const;

export type AIModelId = (typeof AI_MODELS)[number]['id'];
export type LegacyAIModelId = (typeof LEGACY_AI_MODEL_IDS)[number];
export type AIReasoningEffort = (typeof AI_REASONING_OPTIONS)[number]['id'];
export type AISettings = { model: AIModelId; reasoningEffort: AIReasoningEffort };
export type StoredAISettings = {
  model: AIModelId | LegacyAIModelId;
  reasoningEffort: AIReasoningEffort;
};

export const DEFAULT_AI_SETTINGS: AISettings = {
  model: 'openai/gpt-6-sol',
  reasoningEffort: 'low',
};

export function resolveAISettings(settings?: StoredAISettings): AISettings {
  if (!settings) return DEFAULT_AI_SETTINGS;
  const model: AIModelId =
    settings.model === 'openai/gpt-5.6-luna'
      ? 'openai/gpt-6-luna'
      : settings.model === 'openai/gpt-5.6-terra'
        ? 'openai/gpt-6-sol'
        : settings.model === 'openai/gpt-5.6-sol'
          ? 'openai/gpt-6-astra'
          : settings.model;
  return {
    model,
    reasoningEffort:
      model === 'openai/gpt-6-astra' && settings.reasoningEffort === 'none'
        ? 'low'
        : settings.reasoningEffort,
  };
}
