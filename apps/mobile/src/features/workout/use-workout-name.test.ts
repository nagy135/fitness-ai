import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Doc } from '@fitness/convex/data-model';
import { useWorkoutName } from './use-workout-name';

const suggest = vi.fn();
vi.mock('convex/react', () => ({ useAction: () => suggest }));
vi.mock('@fitness/convex/api', () => ({ api: { ai: { workoutName: { suggest: 'suggest' } } } }));
let result: ReturnType<typeof useWorkoutName>;
let renderer: ReactTestRenderer;
const draft = { _id: 'draft-1', exercises: [{ name: 'Squat' }] } as Doc<'workoutDrafts'>;
function Harness({ value = draft }: { value?: Doc<'workoutDrafts'> }) {
  const current = useWorkoutName(value);
  useEffect(() => {
    result = current;
  });
  return null;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  suggest.mockReset();
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});
async function mount(value = draft) {
  await act(() => {
    renderer = create(createElement(Harness, { value }));
  });
}

describe('confirmation workout name', () => {
  it('prefills a suggestion and permits clearing it', async () => {
    suggest.mockResolvedValue('Legs A');
    await mount();
    expect(result.name).toBe('Legs A');
    await act(() => result.setName(''));
    expect(result.name).toBe('');
    expect(suggest).toHaveBeenCalledTimes(1);
  });

  it('never overwrites typing with a late suggestion', async () => {
    let resolve!: (name: string) => void;
    suggest.mockImplementation(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    await mount();
    expect(result.suggesting).toBe(true);
    await act(() => result.setName('My session'));
    await act(() => resolve('Legs A'));
    expect(result.name).toBe('My session');
    expect(result.suggesting).toBe(false);
  });

  it('starts history edits with the saved name without generating a replacement', async () => {
    await mount({ ...draft, name: 'My old name' });
    expect(result.name).toBe('My old name');
    expect(suggest).not.toHaveBeenCalled();
    await act(() => result.setName(''));
    expect(result.name).toBe('');
  });

  it('leaves a failed suggestion blank and editable', async () => {
    suggest.mockRejectedValue(new Error('Offline'));
    await mount();
    expect(result.name).toBe('');
    expect(result.suggestionFailed).toBe(true);
    expect(result.suggesting).toBe(false);
    await act(() => result.setName('Manual name'));
    expect(result.name).toBe('Manual name');
  });

  it('discards suggestions for a previous draft', async () => {
    let resolve!: (name: string) => void;
    suggest.mockImplementationOnce(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    await mount();
    suggest.mockResolvedValue('Push');
    await act(() =>
      renderer.update(
        createElement(Harness, {
          value: { ...draft, _id: 'draft-2' as Doc<'workoutDrafts'>['_id'] },
        }),
      ),
    );
    await act(() => resolve('Legs'));
    expect(result.name).toBe('Push');
  });
});
