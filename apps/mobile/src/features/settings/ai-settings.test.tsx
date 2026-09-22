import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AISettings as Settings } from '@fitness/ai/settings';
import { AISettings } from './ai-settings';

vi.mock('react-native', () => ({ Pressable: 'Pressable', Text: 'Text', View: 'View' }));
vi.mock('lucide-react-native', () => ({ Check: 'Check' }));
vi.mock('@fitness/ui', () => ({ Button: 'Button' }));
vi.mock('@/components/error-notice', () => import('../../components/error-notice'));
vi.mock('@/components/theme-provider', () => ({ useAppTheme: () => ({ colors: {} }) }));
vi.mock('@fitness/convex/api', () => ({
  api: { userProfiles: { current: 'current', updateAISettings: 'update' } },
}));
let profile: { aiSettings?: Settings } | undefined;
const update = vi.fn();
vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: () => profile,
  useMutation: () => update,
}));
let renderer: ReactTestRenderer;
const find = (label: string) => renderer.root.findByProps({ accessibilityLabel: label });
const save = () => renderer.root.findByProps({ children: 'Save AI preferences' });
async function mount() {
  await act(() => {
    renderer = create(createElement(AISettings));
  });
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  profile = {};
  update.mockReset().mockImplementation(async ({ settings }) => {
    profile = { aiSettings: settings };
  });
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});

describe('AI preferences', () => {
  it('shows Terra / Low defaults and waits for changes before saving', async () => {
    await mount();
    expect(find('GPT-5.6 Terra').props.accessibilityState.checked).toBe(true);
    expect(find('Low reasoning').props.accessibilityState.checked).toBe(true);
    expect(save().props.disabled).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it('saves both selections and restores them when reopened', async () => {
    await mount();
    await act(() => find('GPT-5.6 Sol').props.onPress());
    await act(() => find('High reasoning').props.onPress());
    await act(() => save().props.onPress());
    expect(update).toHaveBeenCalledExactlyOnceWith({
      settings: { model: 'openai/gpt-5.6-sol', reasoningEffort: 'high' },
    });
    await act(() => renderer.unmount());
    await mount();
    expect(find('GPT-5.6 Sol').props.accessibilityState.checked).toBe(true);
    expect(find('High reasoning').props.accessibilityState.checked).toBe(true);
  });

  it('preserves the selection on save failure so it can be retried', async () => {
    update.mockRejectedValueOnce(new Error('Offline'));
    await mount();
    await act(() => find('None reasoning').props.onPress());
    await act(() => save().props.onPress());
    expect(renderer.root.findByProps({ accessibilityRole: 'alert' })).toBeDefined();
    expect(find('None reasoning').props.accessibilityState.checked).toBe(true);
    await act(() => save().props.onPress());
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('does not expose editable defaults before the profile loads', async () => {
    profile = undefined;
    await mount();
    expect(() => find('GPT-5.6 Terra')).toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});
