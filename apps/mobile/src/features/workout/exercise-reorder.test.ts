import { expect, it } from 'vitest';
import { dragTarget, moveExercise } from './exercise-reorder';

const ids = ['expanded', 'collapsed', 'last'];
const layouts = new Map([
  ['expanded', { y: 0, height: 230 }],
  ['collapsed', { y: 236, height: 46 }],
  ['last', { y: 288, height: 46 }],
]);
it('crosses sibling centers in either direction with mixed card heights', () => {
  expect(dragTarget(ids, layouts, 0, 28)).toBe(0);
  expect(dragTarget(ids, layouts, 0, 30)).toBe(1);
  expect(dragTarget(ids, layouts, 0, 85)).toBe(2);
  expect(dragTarget(ids, layouts, 2, -30)).toBe(1);
  expect(dragTarget(ids, layouts, 2, -180)).toBe(0);
  expect(moveExercise(ids, 0, 2)).toEqual(['collapsed', 'last', 'expanded']);
  expect(ids).toEqual(['expanded', 'collapsed', 'last']);
});
