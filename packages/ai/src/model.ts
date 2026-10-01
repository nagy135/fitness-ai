import { createOpenAI } from '@ai-sdk/openai';
import { defaultSettingsMiddleware, wrapLanguageModel, type LanguageModel } from 'ai';
import {
  DEFAULT_AI_SETTINGS,
  resolveAISettings,
  type AIModelId,
  type AIReasoningEffort,
} from './settings';

export type AIProviderName = 'openrouter';

export interface AIModelConfig {
  provider: AIProviderName;
  model: AIModelId;
  apiKey: string;
  reasoningEffort?: AIReasoningEffort;
}

export function createFitnessModel(config: AIModelConfig): LanguageModel {
  switch (config.provider) {
    case 'openrouter':
      return wrapLanguageModel({
        model: createOpenAI({
          baseURL: 'https://openrouter.ai/api/v1',
          apiKey: config.apiKey,
          headers: { 'X-OpenRouter-Title': 'Fitness AI' },
        }).responses(config.model),
        middleware: defaultSettingsMiddleware({
          settings: {
            providerOptions: {
              openai: {
                // OpenRouter's provider prefix prevents the OpenAI adapter from recognizing GPT-6.
                forceReasoning: true,
                reasoningEffort: resolveAISettings({
                  model: config.model,
                  reasoningEffort: config.reasoningEffort ?? DEFAULT_AI_SETTINGS.reasoningEffort,
                }).reasoningEffort,
              },
            },
          },
        }),
      });
    default: {
      const neverProvider: never = config.provider;
      throw new Error(`Unsupported AI provider: ${String(neverProvider)}`);
    }
  }
}
