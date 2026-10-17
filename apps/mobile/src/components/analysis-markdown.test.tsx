import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import colors from '../../../../packages/ui/src/theme.json';
import { AnalysisMarkdown } from './analysis-markdown';

vi.mock('react-native', () => ({ View: 'View', ScrollView: 'ScrollView' }));
vi.mock('expo-web-browser', () => ({ openBrowserAsync: vi.fn() }));
vi.mock('./theme-provider', () => ({ useAppTheme: () => ({ colors: colors.dark, isDark: true }) }));
vi.mock('./drawer', () => ({ Drawer: 'Drawer' }));
vi.mock('./analysis-markdown-dom', () => ({ default: 'AnalysisMarkdownDOM' }));

let renderer: ReactTestRenderer;
afterEach(async () => {
  await act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});

it('leaves vertical drags to the native parent in both the analysis and expanded diagram', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  await act(() => {
    renderer = create(createElement(AnalysisMarkdown, { text: 'Answer' }));
  });
  const inline = renderer.root.findByType('AnalysisMarkdownDOM' as never);
  expect(inline.props.dom).toMatchObject({
    matchContents: true,
    scrollEnabled: false,
    nestedScrollEnabled: false,
  });
  await act(() => inline.props.onExpandDiagram('graph TD\n A --> B'));
  const expanded = renderer.root.findAllByType('AnalysisMarkdownDOM' as never)[1];
  expect(expanded.props.expanded).toBe(true);
  expect(expanded.props.dom).toMatchObject({
    matchContents: true,
    scrollEnabled: false,
    nestedScrollEnabled: false,
  });
});

it('keeps the native DOM props stable across parent rerenders and still updates changed answers', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  await act(() => {
    renderer = create(createElement(AnalysisMarkdown, { text: 'Saved answer' }));
  });
  const view = renderer.root.findByType('AnalysisMarkdownDOM' as never);
  const dom = view.props.dom;
  for (let update = 0; update < 5; update++) {
    await act(() => renderer.update(createElement(AnalysisMarkdown, { text: 'Saved answer' })));
    expect(view.props.dom).toBe(dom);
  }
  await act(() => renderer.update(createElement(AnalysisMarkdown, { text: 'Updated answer' })));
  expect(renderer.root.findByType('AnalysisMarkdownDOM' as never)).toBe(view);
  expect(view.props.text).toBe('Updated answer');
});
