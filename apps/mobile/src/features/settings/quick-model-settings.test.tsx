import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AISettings } from '@fitness/ai/settings';
import { QuickModelSettings } from './quick-model-settings';

vi.mock('react-native', () => ({ Pressable: 'Pressable', Text: 'Text', View: 'View' }));
vi.mock('lucide-react-native', () => ({
  Check: 'Check',
  ChevronDown: 'ChevronDown',
  ChevronUp: 'ChevronUp',
  X: 'X',
}));
vi.mock('@fitness/ui', () => ({ Button: 'Button', Dialog: 'Dialog', IconButton: 'IconButton' }));
vi.mock('@/components/error-notice', () => import('../../components/error-notice'));
vi.mock('@/components/theme-provider', () => ({ useAppTheme: () => ({ colors: {} }) }));
vi.mock('@fitness/convex/api', () => ({
  api: { userProfiles: { current: 'current', updateAISettings: 'update' } },
}));
let profile: { aiSettings?: AISettings } | undefined;
const update = vi.fn();
vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: () => profile,
  useMutation: () => update,
}));
let renderer: ReactTestRenderer;
const onClose = vi.fn();
const find = (label: string) => renderer.root.findByProps({ accessibilityLabel: label });
async function mount() {
  await act(() => {
    renderer = create(createElement(QuickModelSettings, { visible: true, onClose }));
  });
}
async function choose(label: string, option: string) {
  await act(() => find(label).props.onPress());
  await act(() => find(`${label}: ${option}`).props.onPress());
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  profile = {};
  onClose.mockReset();
  update.mockReset().mockImplementation(async ({ settings }) => {
    profile = { aiSettings: settings };
  });
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});

describe('quick model settings', () => {
  it('loads saved preferences and saves each choice without a save button', async () => {
    profile = { aiSettings: { model: 'openai/gpt-5.6-luna', reasoningEffort: 'medium' } };
    await mount();
    expect(find('Model').props.accessibilityValue.text).toBe('GPT-5.6 Luna');
    expect(find('Reasoning').props.accessibilityValue.text).toBe('Medium');
    expect(update).not.toHaveBeenCalled();
    await choose('Model', 'GPT-5.6 Sol');
    expect(update).toHaveBeenLastCalledWith({
      settings: { model: 'openai/gpt-5.6-sol', reasoningEffort: 'medium' },
    });
    await choose('Reasoning', 'High');
    expect(update).toHaveBeenLastCalledWith({
      settings: { model: 'openai/gpt-5.6-sol', reasoningEffort: 'high' },
    });
    expect(find('Reasoning').props.accessibilityState.expanded).toBe(false);
    await act(() => renderer.unmount());
    await mount();
    expect(find('Model').props.accessibilityValue.text).toBe('GPT-5.6 Sol');
    expect(find('Reasoning').props.accessibilityValue.text).toBe('High');
  });

  it('preserves rapid changes and saves them in order even after closing', async () => {
    let finish!: () => void;
    update.mockImplementationOnce(
      ({ settings }) =>
        new Promise<void>((resolve) => {
          finish = () => {
            profile = { aiSettings: settings };
            resolve();
          };
        }),
    );
    await mount();
    await choose('Model', 'GPT-5.6 Sol');
    await choose('Reasoning', 'High');
    expect(find('Model').props.accessibilityValue.text).toBe('GPT-5.6 Sol');
    expect(find('Reasoning').props.accessibilityValue.text).toBe('High');
    expect(update).toHaveBeenCalledTimes(1);
    await act(() => renderer.root.findByProps({ title: 'AI model' }).props.onRequestClose());
    expect(onClose).toHaveBeenCalledOnce();
    await act(() => finish());
    expect(update).toHaveBeenNthCalledWith(2, {
      settings: { model: 'openai/gpt-5.6-sol', reasoningEffort: 'high' },
    });
    expect(profile?.aiSettings).toEqual({ model: 'openai/gpt-5.6-sol', reasoningEffort: 'high' });
  });

  it('keeps failed selections available for retry', async () => {
    update.mockRejectedValueOnce(new Error('Offline'));
    await mount();
    await choose('Reasoning', 'Extra high');
    expect(renderer.root.findByProps({ accessibilityRole: 'alert' })).toBeDefined();
    expect(find('Reasoning').props.accessibilityValue.text).toBe('Extra high');
    await act(() => renderer.root.findByProps({ children: 'Retry save' }).props.onPress());
    expect(profile?.aiSettings?.reasoningEffort).toBe('xhigh');
    expect(renderer.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(0);
  });

  it('still saves the latest complete selection if an earlier write fails', async () => {
    let fail!: (error: Error) => void;
    update.mockImplementationOnce(
      () =>
        new Promise<void>((_, reject) => {
          fail = reject;
        }),
    );
    await mount();
    await choose('Model', 'GPT-5.6 Luna');
    await choose('Reasoning', 'None');
    await act(() => fail(new Error('Offline')));
    expect(profile?.aiSettings).toEqual({ model: 'openai/gpt-5.6-luna', reasoningEffort: 'none' });
    expect(renderer.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(0);
  });

  it('waits for the profile before exposing editable preferences', async () => {
    profile = undefined;
    await mount();
    expect(() => find('Model')).toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});
