import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useQuery } from 'convex/react';
import type { Id } from '@fitness/convex/data-model';
import { ExerciseRecords } from './exercise-records';

vi.mock('react-native', () => ({ Pressable: 'Pressable', Text: 'Text', View: 'View' }));
vi.mock('convex/react', () => ({ useQuery: vi.fn() }));
let renderer: ReactTestRenderer;
const onExample = vi.fn();
async function render(busy = false) {
  await act(() => {
    renderer = create(
      createElement(ExerciseRecords, {
        exerciseId: 'bench' as Id<'exercises'>,
        name: 'Bench press',
        busy,
        onExample,
      }),
    );
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});
it('shows loading and empty history without a copy action', async () => {
  vi.mocked(useQuery).mockReturnValue(undefined);
  await render();
  expect(JSON.stringify(renderer.toJSON())).toContain('Loading saved records');
  vi.mocked(useQuery).mockReturnValue({ previous: null, maximums: [] });
  await act(() =>
    renderer.update(
      createElement(ExerciseRecords, {
        exerciseId: 'bench' as Id<'exercises'>,
        name: 'Bench press',
        busy: false,
        onExample,
      }),
    ),
  );
  expect(JSON.stringify(renderer.toJSON())).toContain('No saved records yet');
  expect(renderer.root.findAllByProps({ accessibilityRole: 'button' })).toHaveLength(0);
});
it('shows all previous sets and fills an exercise-specific copy prompt', async () => {
  vi.mocked(useQuery).mockReturnValue({
    previous: {
      performedAt: 0,
      sets: [
        { weightKg: 80, reps: 8 },
        { weightKg: 70, reps: 10 },
      ],
    },
    maximums: [{ metric: 'weightKg', performedAt: 0, set: { weightKg: 100, reps: 3 } }],
  });
  await render();
  const text = JSON.stringify(renderer.toJSON());
  expect(text).toContain('80 kg × 8 reps');
  expect(text).toContain('70 kg × 10 reps');
  expect(text).toContain('100 kg × 3 reps');
  await act(() =>
    renderer.root
      .findByProps({ accessibilityLabel: 'Log previous record for Bench press' })
      .props.onPress(),
  );
  expect(onExample).toHaveBeenCalledWith('Log previous record for Bench press');
});
it('disables copying a session when a tracking change removes a set’s measurements', async () => {
  vi.mocked(useQuery).mockReturnValue({
    previous: { performedAt: 0, sets: [{ reps: 8 }, { notes: 'Old timed set' }] },
    maximums: [],
  });
  await render();
  const action = renderer.root.findByProps({ accessibilityLabel: 'Log previous record for Bench press' });
  expect(action.props.disabled).toBe(true);
  expect(JSON.stringify(renderer.toJSON())).toContain('no longer match');
});
