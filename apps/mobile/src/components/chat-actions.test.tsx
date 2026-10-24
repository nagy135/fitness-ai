import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatActions } from './chat-actions';

vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable' }));
vi.mock('lucide-react-native', () => ({
  MessageSquareText: 'ChatIcon',
  Dumbbell: 'TrackingIcon',
  ChartNoAxesCombined: 'AnalysisIcon',
  ChevronRight: 'ChevronRight',
}));
vi.mock('@fitness/ui', () => ({ IconButton: 'IconButton' }));
vi.mock('./theme-provider', () => ({ useAppTheme: () => ({ colors: { text: '#17322e' } }) }));

let renderer: ReactTestRenderer;
const props = {
  mode: 'workout' as const,
  chatOpen: false,
  busy: false,
  hasSets: true,
  editing: false,
  onToggleChat: vi.fn(),
  onReview: vi.fn(),
};
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});

it('switches the icon and accessible label between chat and tracking while keeping review mounted', async () => {
  await act(() => {
    renderer = create(createElement(ChatActions, props));
  });
  const toggle = renderer.root.findByType('IconButton' as never);
  const review = renderer.root.findByProps({ accessibilityLabel: 'Review workout' });
  expect(toggle.props.accessibilityLabel).toBe('Open chat');
  expect(toggle.findAllByType('ChatIcon' as never)).toHaveLength(1);
  await act(() => toggle.props.onPress());
  expect(props.onToggleChat).toHaveBeenCalledOnce();
  await act(() => renderer.update(createElement(ChatActions, { ...props, chatOpen: true })));
  expect(toggle.props.accessibilityLabel).toBe('Back to workout');
  expect(toggle.props.accessibilityState.expanded).toBe(true);
  expect(toggle.findAllByType('TrackingIcon' as never)).toHaveLength(1);
  expect(renderer.root.findByProps({ accessibilityLabel: 'Review workout' })).toBe(review);
  await act(() => review.props.onPress());
  expect(props.onReview).toHaveBeenCalledOnce();
});

it.each([
  { busy: false, hasSets: true, disabled: false },
  { busy: true, hasSets: true, disabled: true },
  { busy: false, hasSets: false, disabled: true },
])(
  'gates review but keeps the toggle available when busy=$busy and hasSets=$hasSets',
  async ({ busy, hasSets, disabled }) => {
    await act(() => {
      renderer = create(createElement(ChatActions, { ...props, busy, hasSets, chatOpen: true }));
    });
    expect(renderer.root.findByProps({ accessibilityLabel: 'Review workout' }).props.disabled).toBe(
      disabled,
    );
    const toggle = renderer.root.findByType('IconButton' as never);
    expect(toggle.props.disabled).not.toBe(true);
    await act(() => toggle.props.onPress());
    expect(props.onToggleChat).toHaveBeenCalledOnce();
  },
);

it('labels review correctly while editing saved history', async () => {
  await act(() => {
    renderer = create(createElement(ChatActions, { ...props, editing: true }));
  });
  expect(renderer.root.findByProps({ accessibilityLabel: 'Review changes' })).toBeTruthy();
});

it('uses the analysis icon to return to the overview and omits workout review in analysis', async () => {
  await act(() => {
    renderer = create(createElement(ChatActions, { ...props, mode: 'analysis', chatOpen: true }));
  });
  const toggle = renderer.root.findByType('IconButton' as never);
  expect(toggle.props.accessibilityLabel).toBe('Back to analysis');
  expect(toggle.findAllByType('AnalysisIcon' as never)).toHaveLength(1);
  expect(renderer.root.findAllByType('Pressable' as never)).toHaveLength(0);
});
