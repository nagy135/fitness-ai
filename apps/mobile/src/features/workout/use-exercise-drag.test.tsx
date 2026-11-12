import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ScrollView } from 'react-native';
import { useExerciseDrag } from './use-exercise-drag';

const exercises = ['a', 'b', 'c'].map((rowId) => ({ rowId }));
const save = vi.fn();
const scrollTo = vi.fn();
const scroll = { current: { scrollTo } as unknown as ScrollView };
let drag: ReturnType<typeof useExerciseDrag>;
let renderer: ReactTestRenderer;
function Harness({ rows = exercises }: { rows?: typeof exercises }) {
  const current = useExerciseDrag(rows, scroll, save);
  useEffect(() => {
    drag = current;
  });
  return null;
}
beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  await act(() => {
    renderer = create(createElement(Harness));
  });
  exercises.forEach(({ rowId }, index) => drag.setLayout(rowId, { y: index * 56, height: 50 }));
  drag.setViewport(0, 100);
  drag.setContentHeight(300);
});
afterEach(async () => {
  await act(() => renderer.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('moves siblings aside and saves only the order on drop', async () => {
  await act(() => drag.start('a', 20));
  await act(() => drag.move(60, 80));
  expect(drag.offset('a')).toBe(60);
  expect(drag.offset('b')).toBe(-56);
  expect(save).not.toHaveBeenCalled();
  await act(() => drag.end());
  expect(save).toHaveBeenCalledExactlyOnceWith(['b', 'a', 'c']);
});
it('auto-scrolls at an edge and cancels without saving', async () => {
  await act(() => drag.start('a', 95));
  await act(() => {
    vi.advanceTimersByTime(64);
  });
  expect(scrollTo).toHaveBeenCalledWith({ y: 20, animated: false });
  expect(drag.offset('a')).toBe(20);
  await act(() => drag.cancel());
  await act(() => {
    vi.advanceTimersByTime(64);
  });
  expect(save).not.toHaveBeenCalled();
  expect(drag.activeId).toBeUndefined();
});
it('discards a stale gesture when another update replaces the draft', async () => {
  await act(() => drag.start('a', 20));
  await act(() => drag.move(60, 80));
  await act(() =>
    renderer.update(createElement(Harness, { rows: [...exercises, { rowId: 'new' }] })),
  );
  await act(() => drag.end());
  expect(save).not.toHaveBeenCalled();
  expect(drag.activeId).toBeUndefined();
});

it('refreshes drag geometry when collapsing cards reports new layout during the held gesture', async () => {
  drag.setLayout('a', { y: 0, height: 230 });
  drag.setLayout('b', { y: 236, height: 50 });
  drag.setLayout('c', { y: 292, height: 50 });
  await act(() => drag.start('a', 20));
  await act(() => {
    drag.setLayout('a', { y: 0, height: 50 });
    drag.setLayout('b', { y: 56, height: 50 });
    drag.setLayout('c', { y: 112, height: 50 });
    drag.move(60, 80);
  });
  expect(drag.offset('b')).toBe(-56);
  await act(() => drag.end());
  expect(save).toHaveBeenCalledExactlyOnceWith(['b', 'a', 'c']);
});
