import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PromptBar } from './prompt-bar';

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));
vi.mock('lucide-react-native', () => ({
  ArrowUp: 'ArrowUp',
  Mic: 'Mic',
  Square: 'Square',
  X: 'X',
}));
vi.mock('./theme-provider', () => ({ useAppTheme: () => ({ colors: {} }) }));
vi.mock('./water-ripple-progress', () => ({ WaterRippleProgress: 'WaterRippleProgress' }));
vi.mock('./display-text', () => ({ DisplayText: 'DisplayText' }));
vi.mock('./error-notice', () => ({ ErrorNotice: 'ErrorNotice' }));
vi.mock('@/features/voice/use-dictation', () => ({
  useDictation: () => ({ active: false, phase: 'idle', isActive: () => false, toggle: vi.fn() }),
}));
let renderer: ReactTestRenderer;
const onSubmit = vi.fn<() => Promise<boolean>>();
const onChangeText = vi.fn();
const props = {
  placeholder: 'Log workout',
  processing: true,
  value: 'Another set',
  onSubmit,
  onChangeText,
};
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  onSubmit.mockReset().mockResolvedValue(true);
  onChangeText.mockReset();
});
afterEach(async () => {
  await act(() => renderer.unmount());
  vi.unstubAllGlobals();
});
it('keeps typing and sending enabled during processing and clears accepted messages immediately', async () => {
  await act(() => {
    renderer = create(createElement(PromptBar, props));
  });
  expect(renderer.root.findByProps({ accessibilityLabel: 'Log workout' }).props.editable).toBe(
    true,
  );
  const send = renderer.root.findByProps({ testID: 'send-prompt' });
  expect(send.props.disabled).toBe(false);
  expect(send.props.accessibilityLabel).toBe('Queue prompt');
  await act(async () => send.props.onPress());
  expect(onSubmit).toHaveBeenCalledWith('Another set');
  expect(onChangeText).toHaveBeenCalledWith('');
});
it('disables sending at capacity but keeps the draft editable and shows queued messages', async () => {
  await act(() => {
    renderer = create(
      createElement(PromptBar, {
        ...props,
        queueFull: true,
        queued: [{ id: 1, text: 'Next set' }],
      }),
    );
  });
  expect(renderer.root.findByProps({ testID: 'send-prompt' }).props.disabled).toBe(true);
  expect(renderer.root.findByProps({ accessibilityLabel: 'Log workout' }).props.editable).toBe(
    true,
  );
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Remove queued message 1' }),
  ).toBeDefined();
});
