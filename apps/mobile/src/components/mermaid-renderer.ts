import DOMPurify from 'dompurify';
import type { ThemeColors } from '@fitness/ui';

let renderQueue = Promise.resolve();
let nextId = 0;

export function renderMermaid(
  source: string,
  colors: Pick<ThemeColors, 'panel' | 'soft' | 'text' | 'accent' | 'muted'>,
  isDark: boolean,
): Promise<string> {
  // Mermaid has global configuration. Serialize renders so different themes and
  // concurrent conversation messages cannot change an in-flight render.
  const task = renderQueue.then(async () => {
    if (
      source.length > 16_000 ||
      /%%\s*\{/.test(source) ||
      /^\s*---/.test(source) ||
      /@\s*\{[^}]*\bimg\s*:/.test(source)
    ) {
      throw new Error('Unsupported diagram configuration or size');
    }
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      maxTextSize: 16_000,
      maxEdges: 200,
      theme: 'base',
      darkMode: isDark,
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      themeVariables: {
        darkMode: isDark,
        background: colors.panel,
        primaryColor: colors.soft,
        primaryTextColor: colors.text,
        primaryBorderColor: colors.accent,
        secondaryColor: colors.panel,
        secondaryTextColor: colors.text,
        tertiaryColor: colors.soft,
        tertiaryTextColor: colors.text,
        lineColor: colors.muted,
        textColor: colors.text,
        fontFamily: 'system-ui, sans-serif',
      },
    });
    // Mermaid needs attached DOM nodes for SVG measurements. Keep its working
    // SVG outside the visible content and matchContents height calculations.
    const container = document.createElement('div');
    container.setAttribute('aria-hidden', 'true');
    container.style.cssText =
      'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;';
    document.body.appendChild(container);
    try {
      const { svg } = await mermaid.render(`fitness-diagram-${++nextId}`, source, container);
      return DOMPurify.sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: ['foreignObject', 'image', 'a'],
      });
    } finally {
      container.remove();
    }
  });
  renderQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}
