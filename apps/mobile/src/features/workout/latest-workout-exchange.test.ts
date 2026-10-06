import { expect, it } from 'vitest';
import { latestWorkoutExchange } from './latest-workout-exchange';
it('keeps the last complete exchange while a newer prompt is pending', () => {
  expect(
    latestWorkoutExchange([
      { _id: 'new', role: 'user', text: 'Next set' },
      { _id: 'reply', role: 'assistant', text: 'Logged' },
      { _id: 'prompt', role: 'user', text: 'Bench press' },
    ]),
  ).toEqual({ id: 'reply', prompt: 'Bench press', text: 'Logged' });
});
it('waits until both sides of an exchange exist', () => {
  expect(latestWorkoutExchange(undefined)).toBeUndefined();
  expect(latestWorkoutExchange([{ _id: 'p', role: 'user', text: 'Bench' }])).toBeUndefined();
  expect(latestWorkoutExchange([{ _id: 'r', role: 'assistant', text: 'Logged' }])).toBeUndefined();
});

it('keeps the tools attached to the matching answer while a new prompt is pending', () => {
  const toolCalls = [
    { toolCallId: 'call-1', toolName: 'updateSet', input: '{"reps":12}', output: 'null' },
  ];
  expect(
    latestWorkoutExchange([
      { _id: 'pending', role: 'user', text: 'Another set' },
      { _id: 'reply', role: 'assistant', text: 'Updated', toolCalls },
      { _id: 'prompt', role: 'user', text: 'Twelve reps' },
    ]),
  ).toEqual({ id: 'reply', prompt: 'Twelve reps', text: 'Updated', toolCalls });
});
