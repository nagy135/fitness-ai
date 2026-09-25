import { createElement, type ComponentProps } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WorkoutTable } from './workout-table';

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Text: 'Text',
  View: 'View',
}));
vi.mock('lucide-react-native', () => ({
  ChevronDown: 'ChevronDown',
  ChevronUp: 'ChevronUp',
  List: 'List',
  Trash2: 'Trash2',
}));
vi.mock('@fitness/ui', () => ({ IconButton: 'IconButton' }));
vi.mock('@/components/theme-provider', () => ({ useAppTheme: () => ({ colors: {} }) }));
vi.mock('@/components/display-text', () => ({ DisplayText: 'DisplayText' }));

type Exercises = ComponentProps<typeof WorkoutTable>['exercises'];
let renderer: ReactTestRenderer;
let exercises: Exercises;
const find = (label: string) => renderer.root.findByProps({ accessibilityLabel: label });
const isOpen = (label: string) => find(label).props.accessibilityState.expanded;
const props = {
  busy: false,
  onRemoveSet: vi.fn(),
  onRemoveExercise: vi.fn(),
  onUpdateSet: vi.fn(),
  onExample: vi.fn(),
};
async function update(next: Exercises) {
  exercises = next;
  await act(() => renderer.update(createElement(WorkoutTable, { ...props, exercises })));
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  exercises = ['Bench', 'Squat'].map((name) => ({
    rowId: name,
    name,
    sets: [{ setId: `${name}-1`, reps: 8, weightKg: 80 }],
  }));
  await act(() => {
    renderer = create(createElement(WorkoutTable, { ...props, exercises }));
  });
});
afterEach(async () => {
  await act(() => renderer.unmount());
  vi.unstubAllGlobals();
});

it('unfolds all exercises and set details changed in one update', async () => {
  expect(isOpen('Bench, 1 set')).toBe(false);
  await update(
    exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({ ...set, reps: 10, notes: 'Controlled tempo' })),
    })),
  );
  for (const name of ['Bench', 'Squat']) {
    expect(isOpen(`${name}, 1 set`)).toBe(true);
    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === 'Pressable' &&
          node.props.accessibilityLabel?.startsWith(`Edit ${name} set 1`),
      )[0].props.accessibilityState.expanded,
    ).toBe(true);
  }
});

it('respects manual collapse and unchanged query refreshes, then reopens on another edit', async () => {
  await update(
    exercises.map((exercise, index) => (index ? exercise : { ...exercise, notes: 'Pause' })),
  );
  expect(isOpen('Bench, 1 set')).toBe(true);
  expect(isOpen('Squat, 1 set')).toBe(false);
  await act(() => find('Bench, 1 set').props.onPress());
  await update(structuredClone(exercises));
  expect(isOpen('Bench, 1 set')).toBe(false);
  await update(exercises.map((exercise, index) => (index ? exercise : { ...exercise, sets: [] })));
  expect(isOpen('Bench, 0 sets')).toBe(true);
});

it('opens newly added exercises and lets All exercises collapse everything', async () => {
  await update([...exercises, { rowId: 'Row', name: 'Row', sets: [{ setId: 'row-1', reps: 12 }] }]);
  expect(isOpen('Row, 1 set')).toBe(true);
  await act(() => find('Show all exercises').props.onPress());
  await update(structuredClone(exercises));
  expect(isOpen('Row, 1 set')).toBe(false);
});
