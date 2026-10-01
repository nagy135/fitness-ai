import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import colors from '../../../../packages/ui/src/theme.json';
import { renderMermaid } from './mermaid-renderer';

const mermaid = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }));
const containers: {
  style: { cssText: string };
  setAttribute: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}[] = [];
vi.mock('mermaid', () => ({ default: mermaid }));
vi.mock('dompurify', () => ({ default: { sanitize: (svg: string) => svg } }));

beforeEach(() => {
  containers.length = 0;
  vi.stubGlobal('document', {
    createElement: () => {
      const container = { style: { cssText: '' }, setAttribute: vi.fn(), remove: vi.fn() };
      containers.push(container);
      return container;
    },
    body: { appendChild: vi.fn() },
  });
  mermaid.initialize.mockReset();
  mermaid.render.mockReset().mockResolvedValue({ svg: '<svg></svg>' });
});

afterEach(() => vi.unstubAllGlobals());

it('keeps Mermaid measurement nodes invisible and removes them after success or failure', async () => {
  await renderMermaid('graph TD\n A --> B', colors.dark, true);
  const container = containers[0];
  expect(container.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true');
  expect(container.style.cssText).toContain('visibility:hidden');
  expect(container.style.cssText).toContain('position:fixed');
  expect(container.style.cssText).not.toContain('display:none');
  expect(mermaid.render.mock.calls[0][2]).toBe(container);
  expect(container.remove).toHaveBeenCalledOnce();

  mermaid.render.mockRejectedValueOnce(new Error('bad diagram'));
  await expect(renderMermaid('invalid', colors.dark, true)).rejects.toThrow('bad diagram');
  expect(containers[1].remove).toHaveBeenCalledOnce();
});

it('rejects oversized diagrams and model-supplied Mermaid configuration before rendering', async () => {
  for (const source of [
    'a'.repeat(16_001),
    '%%{init: {"securityLevel":"loose"}}%%\ngraph TD\n A --> B',
    '---\nconfig:\n securityLevel: loose\n---\ngraph TD\n A --> B',
    'flowchart TD\n A@{ img: "https://example.com/image.png" }',
  ]) {
    await expect(renderMermaid(source, colors.dark, true)).rejects.toThrow();
  }
  expect(mermaid.render).not.toHaveBeenCalled();
});

it('serializes differently themed diagrams and continues after a failed diagram', async () => {
  let rejectFirst!: (error: Error) => void;
  mermaid.render.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectFirst = reject;
      }),
  );
  const first = renderMermaid('invalid', colors.dark, true);
  const firstFailure = expect(first).rejects.toThrow('bad diagram');
  const second = renderMermaid('graph TD\n A --> B', colors.light, false);
  await vi.waitFor(() => expect(mermaid.render).toHaveBeenCalledTimes(1));
  expect(mermaid.initialize).toHaveBeenCalledTimes(1);
  rejectFirst(new Error('bad diagram'));
  await firstFailure;
  await expect(second).resolves.toBe('<svg></svg>');
  expect(mermaid.initialize).toHaveBeenCalledTimes(2);
  expect(mermaid.initialize.mock.calls[0][0]).toMatchObject({
    securityLevel: 'strict',
    darkMode: true,
    htmlLabels: false,
  });
  expect(mermaid.initialize.mock.calls[1][0]).toMatchObject({
    securityLevel: 'strict',
    darkMode: false,
    themeVariables: { primaryTextColor: colors.light.text },
  });
  expect(mermaid.render.mock.calls[0][0]).not.toBe(mermaid.render.mock.calls[1][0]);
});
