import { beforeEach, expect, it, vi } from 'vitest';
import type { MutationCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { requireUserProfile } from './lib/auth';
import { updateAISettings } from './userProfiles';
import type { AISettings } from '@fitness/ai/settings';

vi.mock('./lib/auth', () => ({ requireUserProfile: vi.fn() }));
const run = (
  updateAISettings as unknown as {
    _handler: (ctx: MutationCtx, args: { settings: AISettings }) => Promise<void>;
  }
)._handler;
const patch = vi.fn();
const ctx = { db: { patch } } as unknown as MutationCtx;
const settings: AISettings = { model: 'openai/gpt-5.6-terra', reasoningEffort: 'low' };
beforeEach(() => vi.resetAllMocks());

it('persists both preferences on the authenticated profile', async () => {
  vi.mocked(requireUserProfile).mockResolvedValue({
    _id: 'authenticated-user',
  } as Doc<'userProfiles'>);
  await run(ctx, { settings });
  expect(patch).toHaveBeenCalledExactlyOnceWith('authenticated-user', { aiSettings: settings });
});

it('cannot save preferences without authentication', async () => {
  vi.mocked(requireUserProfile).mockRejectedValue(new Error('Unauthenticated'));
  await expect(run(ctx, { settings })).rejects.toThrow('Unauthenticated');
  expect(patch).not.toHaveBeenCalled();
});
