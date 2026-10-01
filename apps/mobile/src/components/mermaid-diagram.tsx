import { useEffect, useMemo, useState } from 'react';
import type { ThemeColors } from '@fitness/ui';
import { renderMermaid } from './mermaid-renderer';

export function MermaidDiagram({
  source,
  colors,
  isDark,
  expanded,
  onExpand,
}: {
  source: string;
  colors: ThemeColors;
  isDark: boolean;
  expanded?: boolean;
  onExpand?: (source: string) => Promise<void>;
}) {
  const [result, setResult] = useState<{
    source: string;
    theme: ReturnType<typeof useMermaidTheme>;
    isDark: boolean;
    svg?: string;
    failed?: boolean;
  }>();
  const theme = useMermaidTheme(colors);
  const [zoom, setZoom] = useState(1);
  const current =
    result?.source === source && result.theme === theme && result.isDark === isDark
      ? result
      : undefined;
  const svgMarkup = useMemo(() => ({ __html: current?.svg ?? '' }), [current?.svg]);

  useEffect(() => {
    let active = true;
    void renderMermaid(source, theme, isDark).then(
      (svg) => {
        if (active) setResult({ source, theme, isDark, svg });
      },
      () => {
        if (active) setResult({ source, theme, isDark, failed: true });
      },
    );
    return () => {
      active = false;
    };
  }, [source, theme, isDark]);

  return (
    <section className="md-diagram" aria-label="Mermaid diagram">
      {current?.svg ? (
        <>
          <div className="md-diagram-controls">
            <button
              type="button"
              aria-label="Zoom out diagram"
              disabled={zoom <= 0.5}
              onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
            >
              −
            </button>
            <button type="button" aria-label="Reset diagram zoom" onClick={() => setZoom(1)}>
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              aria-label="Zoom in diagram"
              disabled={zoom >= 3}
              onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
            >
              +
            </button>
            {!expanded && onExpand ? (
              <button type="button" onClick={() => void onExpand(source)}>
                Expand diagram
              </button>
            ) : null}
          </div>
          <div
            className="md-diagram-viewport"
            tabIndex={0}
            role="region"
            aria-label="Scrollable diagram"
          >
            <div style={{ width: `${zoom * 100}%` }} dangerouslySetInnerHTML={svgMarkup} />
          </div>
        </>
      ) : (
        <p role="status">
          {current?.failed
            ? 'This diagram could not be rendered. You can read its source below.'
            : 'Rendering diagram…'}
        </p>
      )}
      <details open={current?.failed || undefined}>
        <summary>Diagram source</summary>
        <pre tabIndex={0}>
          <code>{source}</code>
        </pre>
      </details>
    </section>
  );
}

function useMermaidTheme({ panel, soft, text, accent, muted }: ThemeColors) {
  // The native bridge recreates colors even when their values are unchanged.
  return useMemo(() => ({ panel, soft, text, accent, muted }), [panel, soft, text, accent, muted]);
}
