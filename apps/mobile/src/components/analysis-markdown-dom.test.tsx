import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import colors from '../../../../packages/ui/src/theme.json';
import AnalysisMarkdownDOM from './analysis-markdown-dom';
import { isWebLink } from './markdown-links';

function render(text: string) {
  return renderToStaticMarkup(
    createElement(AnalysisMarkdownDOM, {
      text,
      colors: colors.dark,
      isDark: true,
      onOpenLink: async () => undefined,
    }),
  ).replace(/<style>[\s\S]*?<\/style>/, '');
}

it('renders headings, emphasis, nested lists, quotes, code, and scrollable GFM tables', () => {
  const html = render(
    '# Progress\n\n**Stronger** and *consistent*.\n\n1. Train\n   - Recover\n\n> Keep going\n\n`weight`\n\n| Lift | Weight |\n| --- | --- |\n| Squat | 80 kg |',
  );
  expect(html).toContain('<h1>Progress</h1>');
  expect(html).toContain('<strong>Stronger</strong>');
  expect(html).toContain('<em>consistent</em>');
  expect(html).toContain('<ol>');
  expect(html).toContain('<ul>');
  expect(html).toContain('<blockquote>');
  expect(html).toContain('<code>weight</code>');
  expect(html).toContain('aria-label="Scrollable table"');
  expect(html).toContain('<td>80 kg</td>');
});

it('routes Mermaid fences to diagrams, including nested and incomplete fences', () => {
  for (const text of [
    'Before\n\n```mermaid\ngraph TD\n A --> B\n```\n\nAfter',
    '> ```mermaid\n> graph TD\n> A --> B\n> ```',
    '```mermaid\ngraph TD\n A --> B',
  ]) {
    const html = render(text);
    expect(html).toContain('aria-label="Mermaid diagram"');
    expect(html).toContain('Diagram source');
  }
  expect(render('```typescript\nconst a = 1;\n```')).toContain('class="language-typescript"');
  expect(render('`mermaid`')).not.toContain('aria-label="Mermaid diagram"');
});

it('ignores raw HTML and remote images and only enables absolute HTTP(S) links', () => {
  const html = render(
    '<script>alert(1)</script>\n\n<img src="https://example.com/tracker">\n\n![Progress](https://example.com/image.png)\n\n[Safe](https://example.com) [Unsafe](javascript:alert%281%29) [Relative](/settings)',
  );
  expect(html).not.toContain('<script');
  expect(html).not.toContain('<img');
  expect(html).not.toContain('image.png');
  expect(html).toContain('Progress');
  expect(html).toContain('href="https://example.com"');
  expect(html).not.toContain('href="javascript:');
  expect(html).not.toContain('href="/settings"');
  expect(isWebLink('https://example.com')).toBe(true);
  expect(isWebLink('http://example.com')).toBe(true);
  for (const url of [
    'file:///secret',
    'data:text/html,test',
    'javascript:alert(1)',
    '/settings',
    'fitai://settings',
  ]) {
    expect(isWebLink(url)).toBe(false);
  }
});
