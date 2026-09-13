import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExpoSpeechRecognitionNativeEventMap } from 'expo-speech-recognition';
import { Dictation, type SpeechEngine } from './dictation';

function setup() {
  const listeners = new Map<string, (event: never) => void>();
  const engine = {
    isRecognitionAvailable: vi.fn(() => true),
    getPermissionsAsync: vi.fn(async () => ({ granted: false })),
    requestPermissionsAsync: vi.fn(async () => ({ granted: true })),
    addListener: vi.fn((name: string, callback: (event: never) => void) => {
      listeners.set(name, callback);
      return { remove: () => listeners.delete(name) };
    }),
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
  };
  const onState = vi.fn();
  const onText = vi.fn();
  const load = vi.fn(async () => ({
    engine: engine as unknown as SpeechEngine,
    language: 'de-DE',
  }));
  const dictation = new Dictation(load, onState);
  const emit = <K extends keyof ExpoSpeechRecognitionNativeEventMap>(
    name: K,
    event: ExpoSpeechRecognitionNativeEventMap[K],
  ) => listeners.get(name)?.(event as never);
  const result = (transcript: string, isFinal = false) =>
    emit('result', {
      isFinal,
      results: [{ transcript, confidence: 1, segments: [] }],
    });
  return { dictation, engine, onState, onText, load, emit, result, listeners };
}

afterEach(() => vi.useRealTimers());

describe('prompt dictation', () => {
  it('replaces partial results, accepts the final result after stop, and appends a second utterance', async () => {
    const s = setup();
    await s.dictation.start('Bench press', s.onText);
    expect(s.engine.start).toHaveBeenCalledWith(
      expect.objectContaining({ lang: 'de-DE', continuous: false }),
    );
    s.result('eighty');
    s.result('eighty kilograms');
    s.dictation.stop();
    expect(s.dictation.active).toBe(true);
    s.result('80 kilograms, 8 reps', true);
    s.emit('end', null);
    expect(s.onText.mock.calls.map(([text]) => text)).toEqual([
      'Bench press eighty',
      'Bench press eighty kilograms',
      'Bench press 80 kilograms, 8 reps',
    ]);
    expect(s.dictation.active).toBe(false);
    expect(s.listeners.size).toBe(0);
    await s.dictation.start(s.dictation.expectedText, s.onText);
    s.result('then 6 reps', true);
    s.emit('end', null);
    expect(s.onText).toHaveBeenLastCalledWith('Bench press 80 kilograms, 8 reps then 6 reps');
  });

  it('does not start twice or record after cancellation while permissions are pending', async () => {
    const s = setup();
    let resolvePermission!: (permission: { granted: boolean }) => void;
    s.engine.requestPermissionsAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePermission = resolve;
        }),
    );
    const pending = s.dictation.start('', s.onText);
    await Promise.resolve();
    await s.dictation.start('', s.onText);
    s.dictation.cancel();
    resolvePermission({ granted: true });
    await pending;
    expect(s.load).toHaveBeenCalledTimes(1);
    expect(s.engine.start).not.toHaveBeenCalled();
    expect(s.dictation.active).toBe(false);
  });

  it('ignores late results from a canceled session after switching prompts', async () => {
    const s = setup();
    await s.dictation.start('Workout:', s.onText);
    const oldResult = s.listeners.get('result');
    const oldEnd = s.listeners.get('end');
    s.dictation.cancel();
    await s.dictation.start('Analysis:', s.onText);
    oldResult?.({ results: [{ transcript: 'wrong mode' }] } as never);
    oldEnd?.(null as never);
    expect(s.onText).not.toHaveBeenCalled();
    expect(s.dictation.active).toBe(true);
    s.result('weekly volume', true);
    s.emit('end', null);
    expect(s.onText).toHaveBeenLastCalledWith('Analysis: weekly volume');
    expect(s.engine.abort).toHaveBeenCalledTimes(1);
  });

  it('preserves the prompt and unlocks typing when permission is denied', async () => {
    const s = setup();
    s.engine.requestPermissionsAsync.mockResolvedValue({ granted: false });
    await s.dictation.start('Keep this', s.onText);
    expect(s.engine.start).not.toHaveBeenCalled();
    expect(s.onText).not.toHaveBeenCalled();
    expect(s.onState).toHaveBeenLastCalledWith({
      phase: 'idle',
      error: expect.stringContaining('Settings'),
    });
  });

  it('recovers when the module or recognition service is unavailable', async () => {
    const s = setup();
    s.load.mockRejectedValueOnce(new Error('Missing native module'));
    await s.dictation.start('', s.onText);
    expect(s.dictation.active).toBe(false);
    expect(s.onState).toHaveBeenLastCalledWith({
      phase: 'idle',
      error: expect.stringContaining('keyboard dictation'),
    });
    s.engine.isRecognitionAvailable.mockReturnValue(false);
    await s.dictation.start('', s.onText);
    expect(s.engine.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(s.dictation.active).toBe(false);
  });

  it('retains recognized text on network failure and reports silence', async () => {
    const s = setup();
    await s.dictation.start('', s.onText);
    s.result('Squat 60');
    s.emit('error', { error: 'network', message: 'Network unavailable' });
    expect(s.onText).toHaveBeenLastCalledWith('Squat 60');
    expect(s.onState).toHaveBeenLastCalledWith({
      phase: 'idle',
      error: expect.stringContaining('connection'),
    });
    await s.dictation.start('Squat 60', s.onText);
    s.emit('end', null);
    expect(s.onState).toHaveBeenLastCalledWith({
      phase: 'idle',
      error: expect.stringContaining('No speech'),
    });
    expect(s.onText).toHaveBeenCalledTimes(1);
  });

  it('limits recording and recovers if the recognizer never ends', async () => {
    vi.useFakeTimers();
    const s = setup();
    await s.dictation.start('', s.onText);
    vi.advanceTimersByTime(60_000);
    expect(s.engine.stop).toHaveBeenCalledTimes(1);
    expect(s.dictation.active).toBe(true);
    vi.advanceTimersByTime(5_000);
    expect(s.engine.abort).toHaveBeenCalledTimes(1);
    expect(s.dictation.active).toBe(false);
    expect(s.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
