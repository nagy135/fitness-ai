import { createElement, useState, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExpoSpeechRecognitionNativeEventMap } from 'expo-speech-recognition';
import type { SpeechEngine } from './dictation';
import { useDictation } from './use-dictation';

const mocks = vi.hoisted(() => ({
  appState: 'active',
  appListeners: new Set<(state: string) => void>(),
  load: vi.fn(),
}));
vi.mock('./load-speech', () => ({ loadSpeech: mocks.load }));
vi.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return mocks.appState;
    },
    addEventListener: (_: string, callback: (state: string) => void) => {
      mocks.appListeners.add(callback);
      return {
        remove: () => {
          mocks.appListeners.delete(callback);
        },
      };
    },
  },
}));
vi.mock('expo-router', () => ({
  useFocusEffect: (callback: () => () => void) => useEffect(callback, [callback]),
}));

let renderer: ReactTestRenderer | undefined;
let voice: ReturnType<typeof useDictation>;
let currentText: string;
function Prompt({ enabled = true }: { enabled?: boolean }) {
  const [text, setText] = useState('Bench press');
  const result = useDictation(text, setText, enabled);
  useEffect(() => {
    currentText = text;
    voice = result;
  }, [text, result]);
  return null;
}

function engineMock() {
  const listeners = new Map<string, (event: never) => void>();
  const engine = {
    isRecognitionAvailable: () => true,
    getPermissionsAsync: vi.fn(async () => ({ granted: true })),
    requestPermissionsAsync: vi.fn(async () => ({ granted: true })),
    addListener: (name: string, listener: (event: never) => void) => {
      listeners.set(name, listener);
      return { remove: () => listeners.delete(name) };
    },
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
  };
  const emit = <K extends keyof ExpoSpeechRecognitionNativeEventMap>(
    name: K,
    event: ExpoSpeechRecognitionNativeEventMap[K],
  ) => listeners.get(name)?.(event as never);
  mocks.load.mockResolvedValue({ engine: engine as unknown as SpeechEngine, language: 'en-US' });
  return { engine, emit };
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  mocks.appState = 'active';
});
afterEach(async () => {
  if (renderer) await act(() => renderer?.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});

describe('dictation React lifecycle', () => {
  it('survives startup and transcript rerenders until the user stops', async () => {
    const { engine, emit } = engineMock();
    await act(() => {
      renderer = create(createElement(Prompt));
    });
    await act(() => voice.toggle());
    expect(engine.start).toHaveBeenCalledOnce();
    expect(engine.abort).not.toHaveBeenCalled();
    expect(voice.phase).toBe('starting');
    await act(() => emit('start', null));
    await act(() =>
      emit('result', {
        isFinal: false,
        results: [{ transcript: '80 kilograms', confidence: 1, segments: [] }],
      }),
    );
    expect(currentText).toBe('Bench press 80 kilograms');
    expect(voice.phase).toBe('listening');
    expect(engine.abort).not.toHaveBeenCalled();
    await act(() => voice.toggle());
    expect(engine.stop).toHaveBeenCalledOnce();
    await act(() => emit('end', null));
    expect(voice.active).toBe(false);
  });

  it('cancels when the app backgrounds and when input is disabled', async () => {
    const { engine } = engineMock();
    await act(() => {
      renderer = create(createElement(Prompt));
    });
    await act(() => voice.toggle());
    await act(() => {
      mocks.appState = 'background';
      mocks.appListeners.forEach((listener) => listener('background'));
    });
    expect(voice.active).toBe(false);
    expect(engine.abort).toHaveBeenCalledOnce();
    mocks.appState = 'active';
    await act(() => voice.toggle());
    await act(() => renderer?.update(createElement(Prompt, { enabled: false })));
    expect(voice.active).toBe(false);
    expect(engine.abort).toHaveBeenCalledTimes(2);
  });

  it('survives the Android permission dialog and starts only after the activity returns', async () => {
    const { engine, emit } = engineMock();
    engine.getPermissionsAsync.mockResolvedValueOnce({ granted: false });
    let grant!: (permission: { granted: boolean }) => void;
    engine.requestPermissionsAsync.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          grant = resolve;
        }),
    );
    await act(() => {
      renderer = create(createElement(Prompt));
    });
    await act(() => voice.toggle());
    await act(() => {
      mocks.appState = 'background';
      mocks.appListeners.forEach((listener) => listener('background'));
    });
    await act(() => grant({ granted: true }));
    expect(voice.phase).toBe('starting');
    expect(engine.start).not.toHaveBeenCalled();
    await act(() => {
      mocks.appState = 'active';
      mocks.appListeners.forEach((listener) => listener('active'));
    });
    expect(engine.start).toHaveBeenCalledOnce();
    await act(() => emit('end', null));
    await act(() => voice.toggle());
    expect(engine.start).toHaveBeenCalledTimes(2);
    expect(engine.requestPermissionsAsync).toHaveBeenCalledOnce();
  });

  it('does not open the microphone if the user stays in the background after permission', async () => {
    vi.useFakeTimers();
    try {
      const { engine } = engineMock();
      engine.getPermissionsAsync.mockResolvedValueOnce({ granted: false });
      engine.requestPermissionsAsync.mockImplementationOnce(async () => {
        mocks.appState = 'background';
        mocks.appListeners.forEach((listener) => listener('background'));
        return { granted: true };
      });
      await act(() => {
        renderer = create(createElement(Prompt));
      });
      await act(() => voice.toggle());
      await act(() => {
        vi.advanceTimersByTime(3_000);
      });
      expect(engine.start).not.toHaveBeenCalled();
      expect(voice.active).toBe(false);
      expect(voice.error).toContain('background');
    } finally {
      vi.useRealTimers();
    }
  });
});
