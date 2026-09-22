'use node';

import { createFitnessModel, resolveAISettings, type AISettings } from '@fitness/ai';

export function createUserModel(settings?: AISettings) {
  const provider = process.env.AI_PROVIDER ?? 'openrouter';
  if (provider !== 'openrouter')
    throw new Error(`AI_PROVIDER ${provider} is not configured in this build`);
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');
  return createFitnessModel({ provider, apiKey, ...resolveAISettings(settings) });
}
