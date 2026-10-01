import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePromptQueue } from './use-prompt-queue';

let queue: ReturnType<typeof usePromptQueue>;
let renderer: ReactTestRenderer;
const send = vi.fn<(text: string) => Promise<boolean>>();
let finish: (success: boolean) => void;
function Harness({ processing = false }: { processing?: boolean }) {
  const current = usePromptQueue(send, processing);
  useEffect(() => {
    queue = current;
  });
  return null;
}
async function enqueue(text: string) {
  let accepted = false;
  await act(async () => {
    accepted = await queue.enqueue(text);
  });
  return accepted;
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  send.mockReset().mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(() => {
    renderer = create(createElement(Harness));
  });
});
afterEach(async () => {
  await act(() => renderer.unmount());
  vi.unstubAllGlobals();
});
it('accepts three waiting prompts and sends them one at a time in order', async () => {
  expect(await enqueue('first')).toBe(true);
  for (const text of ['second', 'third', 'fourth']) expect(await enqueue(text)).toBe(true);
  expect(await enqueue('fifth')).toBe(false);
  expect(send.mock.calls).toEqual([['first']]);
  expect(queue.full).toBe(true);
  for (const text of ['second', 'third', 'fourth']) {
    await act(() => finish(true));
    expect(send).toHaveBeenLastCalledWith(text);
  }
  await act(() => finish(true));
  expect(queue.hasWork).toBe(false);
  expect(send).toHaveBeenCalledTimes(4);
});
it('waits for other work and allows removing queued messages', async () => {
  await act(() => renderer.update(createElement(Harness, { processing: true })));
  await enqueue('remove me');
  await enqueue('keep me');
  expect(send).not.toHaveBeenCalled();
  await act(() => queue.remove(queue.pending[0].id));
  await act(() => renderer.update(createElement(Harness)));
  expect(send).toHaveBeenCalledExactlyOnceWith('keep me');
});
it('pauses on failure and retries the same prompt before continuing', async () => {
  await enqueue('first');
  await enqueue('second');
  await act(() => finish(false));
  expect(queue.failed?.text).toBe('first');
  expect(send).toHaveBeenCalledTimes(1);
  await act(() => queue.retry());
  expect(send).toHaveBeenLastCalledWith('first');
  await act(() => finish(true));
  expect(send).toHaveBeenLastCalledWith('second');
});
it('can discard a failed prompt and continue without losing queued messages', async () => {
  send.mockRejectedValueOnce(new Error('offline'));
  await enqueue('first');
  await enqueue('second');
  expect(queue.failed?.text).toBe('first');
  await act(() => queue.discardFailed());
  expect(send).toHaveBeenLastCalledWith('second');
});
it('does not send waiting messages after unmount', async () => {
  await enqueue('first');
  await enqueue('second');
  await act(() => renderer.unmount());
  await act(() => finish(true));
  expect(send).toHaveBeenCalledTimes(1);
});
