import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';
import { DEFAULT_AI_SETTINGS, type AIReasoningEffort } from './settings';

export type AIProviderName = 'openrouter';

export interface AIModelConfig {
  provider: AIProviderName;
  model: string;
  apiKey: string;
  reasoningEffort?: AIReasoningEffort;
}

export function createFitnessModel(config: AIModelConfig): LanguageModel {
  switch (config.provider) {
    case 'openrouter':
      return createOpenRouter({ apiKey: config.apiKey, appName: 'Fitness AI' })(config.model, {
        reasoning: { effort: config.reasoningEffort ?? DEFAULT_AI_SETTINGS.reasoningEffort },
      });
    default: {
      const neverProvider: never = config.provider;
      throw new Error(`Unsupported AI provider: ${String(neverProvider)}`);
    }
  }
}
