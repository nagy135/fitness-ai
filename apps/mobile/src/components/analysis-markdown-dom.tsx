'use dom';

import {
  createContext,
  isValidElement,
  useContext,
  type CSSProperties,
  type ReactNode,
} from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ThemeColors } from '@fitness/ui';
import { MermaidDiagram } from './mermaid-diagram';
import { isWebLink } from './markdown-links';

type Props = {
  text: string;
  colors: ThemeColors;
  isDark: boolean;
  compact?: boolean;
  expanded?: boolean;
  onOpenLink: (url: string) => Promise<void>;
  onExpandDiagram?: (source: string) => Promise<void>;
  dom?: import('expo/dom').DOMProps;
};

const MarkdownContext = createContext<Props | null>(null);

function MarkdownLink({ href, children }: { href?: string; children?: ReactNode }) {
  const context = useContext(MarkdownContext)!;
  return href ? (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        void context.onOpenLink(href).catch(() => undefined);
      }}
    >
      {children}
    </a>
  ) : (
    <span>{children}</span>
  );
}

function MarkdownPre({ children }: { children?: ReactNode }) {
  const { colors, isDark, expanded, onExpandDiagram } = useContext(MarkdownContext)!;
  if (
    isValidElement<{ className?: string; children?: ReactNode }>(children) &&
    children.props.className?.split(/\s+/).includes('language-mermaid') &&
    typeof children.props.children === 'string'
  ) {
    return (
      <MermaidDiagram
        source={children.props.children.trimEnd()}
        colors={colors}
        isDark={isDark}
        expanded={expanded}
        onExpand={onExpandDiagram}
      />
    );
  }
  return <pre tabIndex={0}>{children}</pre>;
}

// Keep component types stable across prop updates. Native DOM props are
// deserialized into fresh objects; inline renderers would remount diagrams.
const markdownComponents: Components = {
  img: ({ alt }) => <span>{alt}</span>,
  a: MarkdownLink,
  table: ({ children }) => (
    <div className="md-table-scroll" tabIndex={0} role="region" aria-label="Scrollable table">
      <table>{children}</table>
    </div>
  ),
  pre: MarkdownPre,
};

export default function AnalysisMarkdownDOM({
  text,
  colors,
  isDark,
  compact,
  expanded,
  onOpenLink,
  onExpandDiagram,
}: Props) {
  const style = {
    '--md-text': colors.text,
    '--md-muted': colors.muted,
    '--md-accent': colors.accent,
    '--md-panel': colors.panel,
    '--md-soft': colors.soft,
    '--md-line': colors.line,
    fontSize: compact ? 15 : 16,
    lineHeight: compact ? '24px' : '28px',
    colorScheme: isDark ? 'dark' : 'light',
  } as CSSProperties;

  return (
    <MarkdownContext.Provider
      value={{ text, colors, isDark, expanded, onOpenLink, onExpandDiagram }}
    >
      <div className="analysis-markdown" style={style}>
        <style>{markdownStyles}</style>
        <Markdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          urlTransform={(url) => (isWebLink(url) ? url : '')}
          components={markdownComponents}
        >
          {text}
        </Markdown>
      </div>
    </MarkdownContext.Provider>
  );
}

const markdownStyles = `
.analysis-markdown { width:100%; min-width:0; color:var(--md-text); font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; overflow-wrap:anywhere; user-select:text; -webkit-user-select:text; }
.analysis-markdown * { box-sizing:border-box; }
.analysis-markdown > :first-child:not(style), .analysis-markdown > style + * { margin-top:0; }
.analysis-markdown > :last-child { margin-bottom:0; }
.analysis-markdown p { margin:0 0 12px; }
.analysis-markdown h1,.analysis-markdown h2,.analysis-markdown h3,.analysis-markdown h4,.analysis-markdown h5,.analysis-markdown h6 { font-weight:700; line-height:1.3; margin:20px 0 10px; }
.analysis-markdown h1 { font-size:1.5em; } .analysis-markdown h2 { font-size:1.3em; } .analysis-markdown h3 { font-size:1.15em; } .analysis-markdown h4,.analysis-markdown h5,.analysis-markdown h6 { font-size:1em; }
.analysis-markdown strong { font-weight:700; } .analysis-markdown em { font-style:italic; }
.analysis-markdown ul,.analysis-markdown ol { margin:0 0 12px; padding-left:24px; }
.analysis-markdown ul { list-style:disc; } .analysis-markdown ol { list-style:decimal; }
.analysis-markdown li { margin:4px 0; } .analysis-markdown li > p { margin-bottom:4px; }
.analysis-markdown .contains-task-list { list-style:none; padding-left:4px; }
.analysis-markdown a { color:var(--md-accent); text-decoration:underline; }
.analysis-markdown blockquote { margin:12px 0; padding:4px 0 4px 12px; border-left:3px solid var(--md-accent); color:var(--md-muted); }
.analysis-markdown blockquote p:last-child { margin-bottom:0; }
.analysis-markdown code { font-family:ui-monospace,monospace; font-size:.88em; background:var(--md-soft); padding:2px 4px; border-radius:4px; }
.analysis-markdown pre { margin:12px 0; padding:12px; border-radius:12px; background:var(--md-soft); overflow:auto; white-space:pre; overflow-wrap:normal; }
.analysis-markdown pre code { padding:0; background:none; }
.analysis-markdown hr { margin:20px 0; border:0; border-top:1px solid var(--md-line); }
.analysis-markdown .md-table-scroll { width:100%; overflow-x:auto; margin:12px 0; }
.analysis-markdown table { border-collapse:collapse; min-width:100%; font-size:.9em; }
.analysis-markdown th,.analysis-markdown td { border:1px solid var(--md-line); padding:8px 12px; min-width:100px; text-align:left; }
.analysis-markdown th { font-weight:600; background:var(--md-soft); }
.analysis-markdown .md-diagram { margin:12px 0; padding:12px; border:1px solid var(--md-line); border-radius:12px; background:var(--md-panel); }
.analysis-markdown .md-diagram-controls { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:10px; font-size:13px; }
.analysis-markdown button { font:inherit; color:var(--md-text); background:var(--md-soft); border:1px solid var(--md-line); border-radius:8px; min-height:44px; min-width:44px; padding:4px 10px; cursor:pointer; }
.analysis-markdown button:disabled { opacity:.4; cursor:default; }
.analysis-markdown :focus-visible { outline:2px solid var(--md-accent); outline-offset:2px; }
.analysis-markdown .md-diagram-viewport { width:100%; overflow-x:auto; overflow-y:hidden; }
.analysis-markdown .md-diagram-viewport svg { display:block; width:100%; height:auto; max-width:none !important; }
.analysis-markdown summary { cursor:pointer; color:var(--md-muted); font-size:13px; margin-top:8px; }
`;
