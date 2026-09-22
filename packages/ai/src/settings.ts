export const AI_MODELS = [
  { id: 'openai/gpt-5.6-luna', name: 'GPT-5.6 Luna' },
  { id: 'openai/gpt-5.6-terra', name: 'GPT-5.6 Terra' },
  { id: 'openai/gpt-5.6-sol', name: 'GPT-5.6 Sol' },
] as const;

export const AI_REASONING_OPTIONS = [
  { id: 'none', name: 'None' },
  { id: 'low', name: 'Low' },
  { id: 'medium', name: 'Medium' },
  { id: 'high', name: 'High' },
  { id: 'xhigh', name: 'Extra high' },
] as const;

export type AIModelId = (typeof AI_MODELS)[number]['id'];
export type AIReasoningEffort = (typeof AI_REASONING_OPTIONS)[number]['id'];
export type AISettings = { model: AIModelId; reasoningEffort: AIReasoningEffort };

export const DEFAULT_AI_SETTINGS: AISettings = {
  model: 'openai/gpt-5.6-terra',
  reasoningEffort: 'low',
};

export function resolveAISettings(settings?: AISettings): AISettings {
  return settings ?? DEFAULT_AI_SETTINGS;
}
