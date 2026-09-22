import { afterEach, expect, it, vi } from 'vitest';
import { createFitnessModel } from '@fitness/ai';
import { createUserModel } from './userModel';

vi.mock('@fitness/ai', async (original) => ({
  ...(await original<typeof import('@fitness/ai')>()),
  createFitnessModel: vi.fn(() => 'test-model'),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it('defaults existing users to Terra / Low even if a legacy global model is configured', () => {
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  vi.stubEnv('AI_MODEL', 'openai/gpt-5.6-luna');
  createUserModel();
  expect(createFitnessModel).toHaveBeenCalledWith({
    provider: 'openrouter',
    apiKey: 'test-key',
    model: 'openai/gpt-5.6-terra',
    reasoningEffort: 'low',
  });
});

it('uses the saved model and reasoning together', () => {
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  createUserModel({ model: 'openai/gpt-5.6-sol', reasoningEffort: 'high' });
  expect(createFitnessModel).toHaveBeenCalledWith(
    expect.objectContaining({
      model: 'openai/gpt-5.6-sol',
      reasoningEffort: 'high',
    }),
  );
});
