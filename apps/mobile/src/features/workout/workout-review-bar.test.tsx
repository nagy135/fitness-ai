import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WorkoutReviewBar } from './workout-review-bar';

vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('@fitness/ui', () => ({ Button: 'Button' }));
let renderer: ReactTestRenderer;
const props = { busy: false, hasSets: true, editing: false, onChat: vi.fn(), onReview: vi.fn() };
const chat = () => renderer.root.findByProps({ accessibilityLabel: 'Open chat' });
const review = () => renderer.root.findAllByType('Button' as never)[1];
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  await act(() => {
    renderer = create(createElement(WorkoutReviewBar, props));
  });
});
afterEach(async () => {
  await act(() => renderer.unmount());
  vi.unstubAllGlobals();
});

it('opens Chat only when its button is pressed', async () => {
  expect(props.onChat).not.toHaveBeenCalled();
  await act(() => renderer.update(createElement(WorkoutReviewBar, { ...props, busy: true })));
  await act(() => renderer.update(createElement(WorkoutReviewBar, { ...props, editing: true })));
  expect(props.onChat).not.toHaveBeenCalled();
  await act(() => chat().props.onPress());
  expect(props.onChat).toHaveBeenCalledOnce();
});

it('keeps manual Chat available while processing and before any sets are logged', async () => {
  await act(() =>
    renderer.update(createElement(WorkoutReviewBar, { ...props, busy: true, hasSets: false })),
  );
  expect(chat().props.disabled).not.toBe(true);
  expect(review().props.disabled).toBe(true);
  await act(() => chat().props.onPress());
  expect(props.onChat).toHaveBeenCalledOnce();
});

it.each([
  { busy: false, hasSets: true, disabled: false },
  { busy: true, hasSets: true, disabled: true },
  { busy: false, hasSets: false, disabled: true },
])('gates review when busy=$busy and hasSets=$hasSets', async ({ busy, hasSets, disabled }) => {
  await act(() => renderer.update(createElement(WorkoutReviewBar, { ...props, busy, hasSets })));
  expect(review().props.disabled).toBe(disabled);
  expect(props.onChat).not.toHaveBeenCalled();
});

it('opens workout review and labels saved-workout edits correctly', async () => {
  expect(review().props.children).toBe('Review workout');
  await act(() => review().props.onPress());
  expect(props.onReview).toHaveBeenCalledOnce();
  await act(() => renderer.update(createElement(WorkoutReviewBar, { ...props, editing: true })));
  expect(review().props.children).toBe('Review changes');
});
