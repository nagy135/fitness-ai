import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WorkoutHistoryDatePicker } from './workout-history-date-picker';

vi.mock('react-native', () => ({ Text: 'Text', View: 'View' }));
vi.mock('@fitness/ui', () => ({ Button: 'Button' }));
vi.mock('./workout-history-calendar', () => ({ WorkoutHistoryCalendar: 'Calendar' }));

let renderer: ReactTestRenderer;
const onReview = vi.fn();
const onCancel = vi.fn();
const review = () => renderer.root.findByProps({ children: 'Review date change' });
const calendar = () => renderer.root.findByType('Calendar' as never);

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  onReview.mockReset().mockResolvedValue(undefined);
  onCancel.mockReset();
  await act(() => {
    renderer = create(
      createElement(WorkoutHistoryDatePicker, {
        performedAt: new Date(2026, 8, 13, 8, 30).getTime(),
        onReview,
        onCancel,
      }),
    );
  });
});
afterEach(async () => {
  await act(() => renderer.unmount());
  vi.unstubAllGlobals();
});

it('waits for a changed date and allows cancellation without starting an edit', async () => {
  expect(review().props.disabled).toBe(true);
  await act(() => calendar().props.onSelectDate(new Date(2026, 8, 14)));
  expect(review().props.disabled).toBe(false);
  expect(onReview).not.toHaveBeenCalled();
  await act(() => renderer.root.findByProps({ children: 'Cancel date change' }).props.onPress());
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onReview).not.toHaveBeenCalled();
});

it('submits local noon once, freezes selection while saving, and allows retry after failure', async () => {
  let reject!: (error: Error) => void;
  onReview.mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  const selected = new Date(2026, 9, 25);
  await act(() => calendar().props.onSelectDate(selected));
  const press = review().props.onPress;
  await act(() => {
    press();
    press();
  });
  expect(onReview).toHaveBeenCalledExactlyOnceWith(new Date(2026, 9, 25, 12).getTime());
  expect(review().props.loading).toBe(true);
  await act(() => calendar().props.onSelectDate(new Date(2026, 9, 26)));
  expect(calendar().props.selectedDate).toEqual(selected);
  await act(() => reject(new Error('Offline')));
  expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain(
    'Could not change',
  );
  expect(review().props.loading).toBe(false);
  await act(() => review().props.onPress());
  expect(onReview).toHaveBeenCalledTimes(2);
});
