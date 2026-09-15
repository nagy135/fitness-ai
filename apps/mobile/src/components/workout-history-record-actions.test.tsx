import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkoutHistoryRecordActions } from './workout-history-record-actions';

vi.mock('react-native', () => ({ Pressable: 'Pressable', Text: 'Text', View: 'View' }));
vi.mock('lucide-react-native', () => ({
  Trash2: 'Trash2',
  Pencil: 'Pencil',
  ChevronDown: 'ChevronDown',
  ChevronUp: 'ChevronUp',
}));
vi.mock('@fitness/ui', () => ({ Button: 'Button', IconButton: 'IconButton' }));
vi.mock('./theme-provider', () => ({ useAppTheme: () => ({ colors: { danger: 'red' } }) }));

let renderer: ReactTestRenderer;
const onDelete = vi.fn<() => Promise<unknown>>();
const find = (label: string) => renderer.root.findByProps({ accessibilityLabel: label });
const trash = () => find('Delete workout from 13 September');
const confirm = () => find('Confirm delete workout');

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  onDelete.mockReset().mockResolvedValue(undefined);
  await act(() => {
    renderer = create(
      createElement(WorkoutHistoryRecordActions, {
        dateLabel: '13 September',
        onDelete,
      }),
    );
  });
});
afterEach(async () => {
  await act(() => renderer.unmount());
  vi.unstubAllGlobals();
});

describe('workout deletion confirmation', () => {
  it('requires a second press and lets the user cancel without deleting', async () => {
    expect(() => confirm()).toThrow();
    await act(() => trash().props.onPress());
    expect(onDelete).not.toHaveBeenCalled();
    expect(confirm()).toBeDefined();
    const cancel = renderer.root.findByProps({ children: 'Cancel' });
    await act(() => cancel.props.onPress());
    expect(onDelete).not.toHaveBeenCalled();
    expect(() => confirm()).toThrow();
  });

  it('prevents duplicate submissions while the deletion is pending', async () => {
    let finish!: () => void;
    onDelete.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await act(() => trash().props.onPress());
    const press = confirm().props.onPress;
    await act(() => {
      press();
      press();
    });
    expect(onDelete).toHaveBeenCalledOnce();
    expect(confirm().props.loading).toBe(true);
    expect(renderer.root.findByProps({ children: 'Cancel' }).props.disabled).toBe(true);
    await act(() => finish());
    expect(() => confirm()).toThrow();
  });

  it('shows a failure and allows a confirmed retry', async () => {
    onDelete.mockRejectedValueOnce(new Error('Offline'));
    await act(() => trash().props.onPress());
    await act(() => confirm().props.onPress());
    expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain(
      'Could not delete',
    );
    expect(confirm().props.loading).toBe(false);
    await act(() => confirm().props.onPress());
    expect(onDelete).toHaveBeenCalledTimes(2);
    expect(() => confirm()).toThrow();
  });
});

describe('history edit action', () => {
  it('opens the shared editor, blocks duplicate taps, and shows retryable failures', async () => {
    let reject!: (error: Error) => void;
    const onEdit = vi.fn(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        }),
    );
    await act(() =>
      renderer.update(
        createElement(WorkoutHistoryRecordActions, {
          dateLabel: '13 September',
          onDelete,
          onEdit,
        }),
      ),
    );
    const edit = () => find('Edit workout from 13 September');
    const press = edit().props.onPress;
    await act(() => {
      press();
      press();
    });
    expect(onEdit).toHaveBeenCalledOnce();
    expect(edit().props.disabled).toBe(true);
    expect(trash().props.disabled).toBe(true);
    await act(() => reject(new Error('Offline')));
    expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain(
      'Could not open',
    );
    expect(edit().props.disabled).toBe(false);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
