import { createElement, type ComponentProps } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useQuery } from 'convex/react';
import type { Id } from '@fitness/convex/data-model';
import { WorkoutTable } from './workout-table';

const motion = vi.hoisted(() => ({
  scrollTo: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  timing: vi.fn(),
  reduced: vi.fn(async () => false),
  measureLayout: vi.fn(),
  reduceListeners: new Set<(reduced: boolean) => void>(),
}));
vi.mock('react-native', () => ({
  AccessibilityInfo: {
    isReduceMotionEnabled: motion.reduced,
    addEventListener: (_event: string, listener: (reduced: boolean) => void) => {
      motion.reduceListeners.add(listener);
      return { remove: () => motion.reduceListeners.delete(listener) };
    },
  },
  Easing: { bezier: () => undefined },
  Animated: {
    View: 'AnimatedView',
    Value: class {
      setValue() {}
      stopAnimation() {}
      interpolate() {
        return 1;
      }
    },
    timing: motion.timing,
    sequence: () => ({ start: motion.start, stop: motion.stop }),
  },
  Pressable: 'Pressable',
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  Text: 'Text',
  View: 'View',
}));
vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Circle: 'Circle',
  Defs: 'Defs',
  RadialGradient: 'RadialGradient',
  Stop: 'Stop',
}));
vi.mock('lucide-react-native', () => ({
  Award: 'Award',
  Check: 'Check',
  ChevronDown: 'ChevronDown',
  ChevronUp: 'ChevronUp',
  List: 'List',
  Info: 'Info',
  Trash2: 'Trash2',
  Trophy: 'Trophy',
}));
vi.mock('./exercise-reorder-card', () => ({ ExerciseReorderCard: 'ExerciseReorderCard' }));
vi.mock('convex/react', () => ({ useQuery: vi.fn() }));
vi.mock('./exercise-records', () => ({ ExerciseRecords: 'ExerciseRecords' }));
vi.mock('@fitness/ui', () => ({ IconButton: 'IconButton', useThemeVariables: () => ({}) }));
vi.mock('@/components/theme-provider', () => ({
  useAppTheme: () => ({ colors: { danger: '#c14a4a' } }),
}));
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
  onReorder: vi.fn(),
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
  vi.mocked(useQuery).mockReturnValue(undefined);
  motion.reduced.mockResolvedValue(false);
  motion.timing.mockReturnValue({ start: motion.start, stop: motion.stop });
  motion.measureLayout.mockImplementation((_relative, success) => success(0, 240, 110, 44));
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
              measureLayout: motion.measureLayout,
            },
    });
  });
});
afterEach(async () => {
  await act(() => renderer.unmount());
  vi.unstubAllGlobals();
});

it('keeps the overview and exercise cards in the same vertical scroll', () => {
  const scroll = renderer.root.findByType('ScrollView' as never);
  expect(scroll.findByProps({ accessibilityLabel: 'Show all exercises' })).toBe(
    find('Show all exercises'),
  );
  expect(scroll.findByProps({ accessibilityLabel: 'Bench, 1 set' })).toBe(find('Bench, 1 set'));
});

it('removes a set from its folded row without opening the editor', async () => {
  await act(() => find('Bench, 1 set').props.onPress());
  expect(isOpen('Edit Bench set 1: 80 kg × 8 reps')).toBe(false);
  await act(() => find('Remove Bench set 1').props.onPress());
  expect(props.onRemoveSet).toHaveBeenCalledExactlyOnceWith('Bench', 'Bench-1');
  expect(isOpen('Edit Bench set 1: 80 kg × 8 reps')).toBe(false);
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
  expect(find('Remove Bench set 1').props.disabled).toBe(true);
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

it('selects a weight increment without editing, then applies half, one and five kilogram changes', async () => {
  await act(() => find('Bench, 1 set').props.onPress());
  const setButton = renderer.root.findAll(
    (node) =>
      String(node.type) === 'Pressable' &&
      node.props.accessibilityLabel?.startsWith('Edit Bench set 1'),
  )[0];
  await act(() => setButton.props.onPress());
  for (const step of [0.5, 1, 5]) {
    const selector = find(`Adjust Bench set 1 in steps of ${step} kg`);
    const calls = props.onAdjustSet.mock.calls.length;
    await act(() => selector.props.onPress());
    expect(props.onAdjustSet).toHaveBeenCalledTimes(calls);
    expect(
      find(`Adjust Bench set 1 in steps of ${step} kg`).props.accessibilityState.selected,
    ).toBe(true);
    for (const direction of [-1, 1]) {
      const button = find(`${direction < 0 ? 'Decrease' : 'Increase'} Bench set 1 by ${step} kg`);
      expect(button.props.disabled).toBe(false);
      await act(() => button.props.onPress());
    }
  }
  expect(props.onAdjustSet.mock.calls).toEqual(
    [-0.5, 0.5, -1, 1, -5, 5].map((delta) => ['Bench', 'Bench-1', 'weightKg', delta]),
  );
});

it('updates both exercise badges while logging, including optimistic edits and removals', async () => {
  const exerciseId = 'bench' as Id<'exercises'>;
  vi.mocked(useQuery).mockReturnValue([
    { exerciseId, trackingType: 'weight_reps', volume: 640, maxSet: { weightKg: 80, reps: 8 } },
  ]);
  const row = { ...exercises[0], exerciseId };
  const badges = () => ({
    volume: renderer.root.findAllByProps({ accessibilityLabel: 'Volume personal record for Bench' })
      .length,
    maxSet: renderer.root.findAllByProps({
      accessibilityLabel: 'Max set personal record for Bench',
    }).length,
  });
  await update([row], true);
  expect(useQuery).toHaveBeenLastCalledWith(expect.anything(), { exerciseIds: [exerciseId] });
  expect(badges()).toEqual({ volume: 0, maxSet: 0 });
  expect(isOpen('Bench, 1 set')).toBe(false);

  await update([{ ...row, sets: [{ ...row.sets[0], reps: 9 }] }], true);
  expect(badges()).toEqual({ volume: 1, maxSet: 1 });
  expect(isOpen('Bench, 1 set')).toBe(false);

  await update([{ ...row, sets: [{ ...row.sets[0], weightKg: 81, reps: 1 }] }], true);
  expect(badges()).toEqual({ volume: 0, maxSet: 1 });

  await update(
    [
      {
        ...row,
        sets: [
          { setId: 'first', weightKg: 70, reps: 5 },
          { setId: 'second', weightKg: 70, reps: 5 },
        ],
      },
    ],
    true,
  );
  expect(badges()).toEqual({ volume: 1, maxSet: 0 });

  await update([{ ...row, sets: [] }], true);
  expect(badges()).toEqual({ volume: 0, maxSet: 0 });
});

it('waits for saved baselines and combines duplicate rows for the same exercise', async () => {
  const exerciseId = 'bench' as Id<'exercises'>;
  const rows = exercises.map((row) => ({ ...row, exerciseId }));
  await update(rows, true);
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Volume PR');
  vi.mocked(useQuery).mockReturnValue([
    { exerciseId, trackingType: 'weight_reps', volume: 1000, maxSet: { weightKg: 100, reps: 5 } },
  ]);
  await update(rows, true);
  expect(useQuery).toHaveBeenLastCalledWith(expect.anything(), { exerciseIds: [exerciseId] });
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: 'Volume personal record for Bench' }),
  ).toHaveLength(1);
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: 'Volume personal record for Squat' }),
  ).toHaveLength(1);
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Max set PR');
});

const cards = () => renderer.root.findAllByType('ExerciseReorderCard' as never);
it('shows colored record comparisons beside settle and updates the open modal with edits', async () => {
  const exerciseId = 'bench' as Id<'exercises'>;
  const baseline = {
    exerciseId,
    trackingType: 'weight_reps',
    volume: 1000,
    maxSet: { weightKg: 50, reps: 7 },
  };
  vi.mocked(useQuery).mockReturnValue([baseline]);
  const row = {
    ...exercises[0],
    exerciseId,
    sets: [
      { setId: 'one', weightKg: 30, reps: 10 },
      { setId: 'two', weightKg: 50, reps: 7 },
      { setId: 'three', weightKg: 32.5, reps: 6 },
    ],
  };
  await update([row]);
  await act(() => find('Explain achievements for Bench').props.onPress());
  const text = () =>
    renderer.root
      .findAllByType('Text' as never)
      .map((node) => node.children.filter((child) => typeof child === 'string').join(''))
      .join('\n');
  expect(text()).toContain('845 kg');
  expect(text()).toContain('1000 kg');
  expect(text()).toContain('50 kg × 7 reps');
  expect(text()).not.toContain('Lift more');
  expect(find('Volume: 845 kg, below record').props.style.color).toBe('#c14a4a');
  expect(find('Max set: 50 kg × 7 reps, tied with record').props.style.color).toBe('#c14a4a');
  await act(() => find('Settle Bench').props.onPress());
  expect(find('Volume: 845 kg, below record').props.style.color).toBe('#c14a4a');
  await update([{ ...row, sets: [{ setId: 'one', weightKg: 50, reps: 21 }] }], true);
  expect(find('Volume: 1050 kg, above record').props.style.color).toBe('#15803d');
  expect(find('Max set: 50 kg × 21 reps, above record').props.style.color).toBe('#15803d');
  await act(() => renderer.root.findByType('Modal' as never).props.onRequestClose());
  expect(renderer.root.findAllByType('Modal' as never)).toHaveLength(0);
});

it('cancels a delayed settle ripple on undo and skips motion when reduced motion changes', async () => {
  await act(() => find('Bench, 1 set').props.onPress());
  const pending: (() => void)[] = [];
  motion.measureLayout.mockImplementation((_relative, success) =>
    pending.push(() => success(160, 320, 110, 44)),
  );
  await act(() => find('Settle Bench').props.onPress());
  expect(find('Unsettle Bench').props.accessibilityState.selected).toBe(true);
  await act(() => find('Unsettle Bench').props.onPress());
  motion.timing.mockClear();
  await act(() => pending.forEach((finish) => finish()));
  expect(motion.timing).not.toHaveBeenCalled();
  pending.length = 0;
  await act(() => find('Settle Bench').props.onPress());
  await act(() => pending.forEach((finish) => finish()));
  expect(motion.timing).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ duration: 580, useNativeDriver: true }),
  );
  await act(() => motion.reduceListeners.forEach((listener) => listener(true)));
  await act(() => find('Unsettle Bench').props.onPress());
  motion.timing.mockClear();
  await act(() => find('Settle Bench').props.onPress());
  expect(motion.timing).not.toHaveBeenCalled();
  expect(find('Bench settled')).toBeTruthy();
});

it('collapses every exercise for staged reordering and Cancel restores the original view', async () => {
  await act(() => find('Bench, 1 set').props.onPress());
  await act(() => find('Settle Bench').props.onPress());
  await act(() => cards()[0].props.onEnter());
  expect(cards().every((card) => card.props.reordering)).toBe(true);
  expect(isOpen('Bench, 1 set')).toBe(false);
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: 'Delete Bench from current workout' }),
  ).toHaveLength(0);
  await act(() => cards()[0].props.onStep(1));
  expect(cards().map((card) => card.props.name)).toEqual(['Squat', 'Bench']);
  expect(props.onReorder).not.toHaveBeenCalled();
  await act(() => find('Cancel reordering').props.onPress());
  expect(cards().map((card) => card.props.name)).toEqual(['Bench', 'Squat']);
  expect(isOpen('Bench, 1 set')).toBe(true);
  expect(find('Unsettle Bench').props.accessibilityState.selected).toBe(true);
  expect(props.onReorder).not.toHaveBeenCalled();
});

it('saves only the final order when Done is chosen', async () => {
  props.onReorder.mockResolvedValue(true);
  await act(() => cards()[0].props.onEnter());
  await act(() => cards()[0].props.onStep(1));
  expect(props.onReorder).not.toHaveBeenCalled();
  await act(async () => {
    await find('Save exercise order').props.onPress();
  });
  expect(props.onReorder).toHaveBeenCalledExactlyOnceWith(['Squat', 'Bench']);
  expect(cards().every((card) => !card.props.reordering)).toBe(true);
});

it('keeps the order preview open if saving fails', async () => {
  props.onReorder.mockResolvedValue(false);
  await act(() => cards()[0].props.onEnter());
  await act(() => cards()[0].props.onStep(1));
  await act(async () => {
    await find('Save exercise order').props.onPress();
  });
  expect(cards().every((card) => card.props.reordering)).toBe(true);
  expect(cards().map((card) => card.props.name)).toEqual(['Squat', 'Bench']);
});

it('discards a stale preview when exercises change on another device', async () => {
  await act(() => cards()[0].props.onEnter());
  await act(() => cards()[0].props.onStep(1));
  await update([...exercises, { rowId: 'New', name: 'New exercise', sets: [] }]);
  expect(cards().every((card) => !card.props.reordering)).toBe(true);
  expect(props.onReorder).not.toHaveBeenCalled();
});

it('retains the preview across equivalent query results after a save failure', async () => {
  props.onReorder.mockResolvedValue(false);
  await act(() => cards()[0].props.onEnter());
  await act(() => cards()[0].props.onStep(1));
  await act(async () => {
    await find('Save exercise order').props.onPress();
  });
  await update(exercises.map((exercise) => ({ ...exercise })));
  expect(cards().every((card) => card.props.reordering)).toBe(true);
  expect(cards().map((card) => card.props.name)).toEqual(['Squat', 'Bench']);
});
