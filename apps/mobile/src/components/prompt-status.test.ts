import { expect, it } from 'vitest';
import { formatElapsed, plateOffset, plateWindow, plates, promptStatus } from './prompt-status';

const base = { processing: false, processingLabel: 'Updating your draft…', elapsedSeconds: 0 };

it('hides the status when idle', () => {
  expect(promptStatus({ ...base, voicePhase: 'idle' })).toBeNull();
});

it('shows the processing label and reveals elapsed time only on longer waits', () => {
  expect(
    promptStatus({ ...base, processing: true, voicePhase: 'idle', elapsedSeconds: 2 }),
  ).toEqual({ label: 'Updating your draft…', elapsed: undefined });
  expect(
    promptStatus({ ...base, processing: true, voicePhase: 'idle', elapsedSeconds: 7 }),
  ).toEqual({ label: 'Updating your draft…', elapsed: '7s' });
});

it('prefers processing over voice phases', () => {
  expect(promptStatus({ ...base, processing: true, voicePhase: 'stopping' })?.label).toBe(
    'Updating your draft…',
  );
  expect(promptStatus({ ...base, voicePhase: 'listening' })?.label).toBe(
    'Listening… Tap stop when you’re done.',
  );
});

it('formats minutes with padded seconds', () => {
  expect(formatElapsed(59)).toBe('59s');
  expect(formatElapsed(65)).toBe('1m 05s');
});

it('stacks plates outward from the collar in sequence', () => {
  expect(plateOffset(0)).toBe(2);
  expect(plateOffset(1)).toBe(8);
  expect(plateOffset(2)).toBe(14);
  for (let index = 1; index < plates.length; index++) {
    expect(plateWindow(index)[0]).toBeGreaterThanOrEqual(plateWindow(index - 1)[1]);
  }
  expect(plateWindow(plates.length - 1)[1]).toBeLessThan(0.78);
});
