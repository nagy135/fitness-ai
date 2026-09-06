import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';

export type AIProviderName = 'openrouter';

export interface AIModelConfig {
  provider: AIProviderName;
  model: string;
  apiKey: string;
}

export function createFitnessModel(config: AIModelConfig): LanguageModel {
  switch (config.provider) {
    case 'openrouter':
      return createOpenRouter({ apiKey: config.apiKey, appName: 'Fitness AI' })(config.model);
    default: {
      const neverProvider: never = config.provider;
      throw new Error(`Unsupported AI provider: ${String(neverProvider)}`);
    }
  }
}
