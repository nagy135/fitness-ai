import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import colors from '../../../../packages/ui/src/theme.json';
import AnalysisMarkdownDOM from './analysis-markdown-dom';
import { renderMermaid } from './mermaid-renderer';

vi.mock('./mermaid-renderer', () => ({ renderMermaid: vi.fn() }));

const source = 'graph TD\n A --> B';
const markdown = `\`\`\`mermaid\n${source}\n\`\`\``;
let renderer: ReactTestRenderer;
let finishRender: (svg: string) => void;

function props() {
  // Match a freshly deserialized native DOM update, including new callbacks.
  return {
    text: markdown,
    colors: { ...colors.dark },
    isDark: true,
    onOpenLink: vi.fn(async () => undefined),
    onExpandDiagram: vi.fn(async () => undefined),
  };
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.mocked(renderMermaid)
    .mockReset()
    .mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRender = resolve;
        }),
    );
  await act(() => {
    renderer = create(createElement(AnalysisMarkdownDOM, props()));
  });
});

afterEach(async () => {
  await act(() => renderer.unmount());
  vi.unstubAllGlobals();
});

it('keeps the rendered SVG and zoom through native prop and surrounding text updates', async () => {
  await act(() => finishRender('<svg id="finished-diagram"></svg>'));
  const diagram = renderer.root.findByProps({ 'aria-label': 'Scrollable diagram' });
  // The native parent scrolls the whole diagram. A vertical height cap would
  // make the clipped portion unreachable when the parent handles the drag.
  expect(diagram.props.style?.maxHeight).toBeUndefined();
  const initialMarkup = diagram.find((node) => Boolean(node.props.dangerouslySetInnerHTML)).props
    .dangerouslySetInnerHTML;
  await act(() => renderer.root.findByProps({ 'aria-label': 'Zoom in diagram' }).props.onClick());

  for (let update = 0; update < 10; update++) {
    const next = { ...props(), text: `${markdown}\n\nUpdated answer ${update}` };
    await act(() => renderer.update(createElement(AnalysisMarkdownDOM, next)));
    expect(renderer.root.findByProps({ 'aria-label': 'Scrollable diagram' })).toBe(diagram);
    expect(renderer.root.findAllByProps({ role: 'status' })).toHaveLength(0);
    const svg = diagram.find((node) => Boolean(node.props.dangerouslySetInnerHTML));
    expect(svg.props.dangerouslySetInnerHTML.__html).toBe('<svg id="finished-diagram"></svg>');
    expect(svg.props.dangerouslySetInnerHTML).toBe(initialMarkup);
    expect(svg.props.style.width).toBe('125%');
    await act(() =>
      renderer.root
        .findAllByType('button')
        .find((button) => button.children.includes('Expand diagram'))!
        .props.onClick(),
    );
    expect(next.onExpandDiagram).toHaveBeenCalledWith(source);
  }
  expect(renderMermaid).toHaveBeenCalledOnce();
});

it('does not restart an in-flight render for equal props', async () => {
  await act(() => renderer.update(createElement(AnalysisMarkdownDOM, props())));
  expect(renderMermaid).toHaveBeenCalledOnce();
  await act(() => finishRender('<svg></svg>'));
  expect(renderer.root.findAllByProps({ role: 'status' })).toHaveLength(0);
});

it('renders new sources and actual theme changes and ignores stale results', async () => {
  const finishOld = finishRender;
  await act(() =>
    renderer.update(
      createElement(AnalysisMarkdownDOM, {
        ...props(),
        text: '```mermaid\ngraph TD\n C --> D\n```',
      }),
    ),
  );
  expect(renderMermaid).toHaveBeenCalledTimes(2);
  await act(() => finishOld('<svg id="stale"></svg>'));
  expect(renderer.root.findAllByProps({ 'aria-label': 'Scrollable diagram' })).toHaveLength(0);
  await act(() => finishRender('<svg id="new"></svg>'));
  expect(renderer.root.findByProps({ 'aria-label': 'Scrollable diagram' })).toBeDefined();

  await act(() =>
    renderer.update(
      createElement(AnalysisMarkdownDOM, {
        ...props(),
        text: '```mermaid\ngraph TD\n C --> D\n```',
        colors: { ...colors.light },
        isDark: false,
      }),
    ),
  );
  expect(renderMermaid).toHaveBeenCalledTimes(3);
  expect(vi.mocked(renderMermaid).mock.lastCall).toEqual([
    'graph TD\n C --> D',
    expect.objectContaining({ text: colors.light.text }),
    false,
  ]);
  await act(() => finishRender('<svg id="light"></svg>'));
});
