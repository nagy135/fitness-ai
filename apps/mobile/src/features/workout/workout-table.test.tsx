import { createElement, type ComponentProps } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WorkoutTable } from './workout-table';

const motion = vi.hoisted(() => ({
  scrollTo: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  timing: vi.fn(),
  reduced: vi.fn(async () => false),
}));
vi.mock('react-native', () => ({
  AccessibilityInfo: { isReduceMotionEnabled: motion.reduced },
  Animated: {
    View: 'AnimatedView',
    Value: class {
      setValue() {}
      interpolate() {
        return 1;
      }
    },
    timing: motion.timing,
    sequence: () => ({ start: motion.start, stop: motion.stop }),
  },
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
  onAdjustSet: vi.fn(),
  onExample: vi.fn(),
};
async function update(next: Exercises, savingSets = false) {
  exercises = next;
  await act(() =>
    renderer.update(createElement(WorkoutTable, { ...props, exercises, savingSets })),
  );
}
beforeEach(async () => {
  vi.clearAllMocks();
  motion.reduced.mockResolvedValue(false);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    callback();
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  exercises = ['Bench', 'Squat'].map((name) => ({
    rowId: name,
    name,
    sets: [{ setId: `${name}-1`, reps: 8, weightKg: 80 }],
  }));
  await act(() => {
    renderer = create(createElement(WorkoutTable, { ...props, exercises }), {
      createNodeMock: (element) =>
        String(element.type) === 'ScrollView'
          ? { scrollTo: motion.scrollTo }
          : {
              measureLayout: (_relative: unknown, success: (x: number, y: number) => void) =>
                success(0, 240),
            },
    });
  });
});
afterEach(async () => {
  await act(() => renderer.unmount());
  vi.unstubAllGlobals();
});

it('unfolds changed exercises while keeping individual sets folded', async () => {
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
    ).toBe(false);
  }
  expect(motion.scrollTo).toHaveBeenCalledExactlyOnceWith({ y: 224, animated: false });
  expect(motion.start).toHaveBeenCalledTimes(4);
  expect(motion.timing.mock.calls.filter((call) => call[1].toValue === 1.025)).toHaveLength(2);
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'New or updated set' })).toHaveLength(
    2,
  );
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

it('scrolls and pulses again when values change in an already open exercise, but not on identical refreshes', async () => {
  await act(() => find('Bench, 1 set').props.onPress());
  await update(
    exercises.map((exercise, index) => (index ? exercise : { ...exercise, notes: 'Pause' })),
  );
  expect(motion.scrollTo).toHaveBeenCalledTimes(1);
  expect(motion.start).toHaveBeenCalledTimes(1);
  await update(structuredClone(exercises));
  expect(motion.scrollTo).toHaveBeenCalledTimes(1);
  expect(motion.start).toHaveBeenCalledTimes(1);
  await update(
    exercises.map((exercise, index) => (index ? exercise : { ...exercise, notes: 'Slow' })),
  );
  expect(motion.scrollTo).toHaveBeenCalledTimes(2);
  expect(motion.start).toHaveBeenCalledTimes(2);
});

it('scrolls without pulsing when reduced motion is enabled', async () => {
  motion.reduced.mockResolvedValue(true);
  await update(
    exercises.map((exercise, index) => (index ? exercise : { ...exercise, notes: 'Pause' })),
  );
  expect(motion.scrollTo).toHaveBeenCalledTimes(1);
  expect(motion.start).not.toHaveBeenCalled();
});

it('pulses only added or changed sets, without replaying on manual reopening', async () => {
  await update(
    exercises.map((exercise, index) =>
      index
        ? exercise
        : {
            ...exercise,
            sets: [...exercise.sets, { setId: 'Bench-2', reps: 12, weightKg: 80 }],
          },
    ),
  );
  expect(motion.start).toHaveBeenCalledTimes(2); // Exercise and new set, not the unchanged set.
  await update(structuredClone(exercises));
  expect(motion.start).toHaveBeenCalledTimes(2);
  await act(() => find('Bench, 2 sets').props.onPress());
  await act(() => find('Bench, 2 sets').props.onPress());
  expect(motion.start).toHaveBeenCalledTimes(2);
  await update(
    exercises.map((exercise, index) =>
      index
        ? exercise
        : {
            ...exercise,
            sets: exercise.sets.map((set, setIndex) => (setIndex ? set : { ...set, reps: 10 })),
          },
    ),
  );
  expect(motion.start).toHaveBeenCalledTimes(4);
});

it('accepts five rapid increments while saving without pulsing, scrolling or collapsing the controls', async () => {
  await act(() => find('Bench, 1 set').props.onPress());
  const setButton = renderer.root.findAll(
    (node) =>
      String(node.type) === 'Pressable' &&
      node.props.accessibilityLabel?.startsWith('Edit Bench set 1'),
  )[0];
  await act(() => setButton.props.onPress());
  await update(exercises, true);
  motion.start.mockClear();
  motion.scrollTo.mockClear();
  const increase = find('Increase Bench set 1 by 1 reps');
  expect(increase.props.disabled).toBe(false);
  expect(find('Delete Bench from current workout').props.disabled).toBe(true);
  await act(() => {
    for (let tap = 0; tap < 5; tap++) increase.props.onPress();
  });
  expect(props.onAdjustSet.mock.calls).toEqual(Array(5).fill(['Bench', 'Bench-1', 'reps', 1]));
  await update(
    exercises.map((exercise, index) =>
      index
        ? exercise
        : {
            ...exercise,
            sets: exercise.sets.map((set) => ({ ...set, reps: 13 })),
          },
    ),
    true,
  );
  expect(find('Increase Bench set 1 by 1 reps').props.disabled).toBe(false);
  expect(motion.start).not.toHaveBeenCalled();
  expect(motion.scrollTo).not.toHaveBeenCalled();
  await update(structuredClone(exercises));
  expect(find('Increase Bench set 1 by 1 reps').props.disabled).toBe(false);
  expect(motion.start).not.toHaveBeenCalled();
  // Later AI updates still reveal and pulse the changed set.
  await update(
    exercises.map((exercise, index) =>
      index
        ? exercise
        : {
            ...exercise,
            sets: exercise.sets.map((set) => ({ ...set, reps: 15 })),
          },
    ),
  );
  expect(motion.start).toHaveBeenCalledTimes(2);
});
