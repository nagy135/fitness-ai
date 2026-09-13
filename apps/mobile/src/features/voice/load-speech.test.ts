import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  platform: { OS: 'android' },
  nativeModule: vi.fn<() => object | null>(),
  importSpeech: vi.fn(),
  locales: vi.fn(() => [{ languageTag: 'de-DE' }]),
}));
vi.mock('expo', () => ({ requireOptionalNativeModule: mocks.nativeModule }));
vi.mock('react-native', () => ({ Platform: mocks.platform }));
vi.mock('expo-speech-recognition', () => {
  mocks.importSpeech();
  return { ExpoSpeechRecognitionModule: { isRecognitionAvailable: () => true } };
});
vi.mock('expo-localization', () => ({ getLocales: mocks.locales }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.platform.OS = 'android';
  mocks.nativeModule.mockReturnValue(null);
});

describe('speech module loading', () => {
  it('never imports the native speech package in Expo Go or an old build', async () => {
    const { loadSpeech } = await import('./load-speech');
    expect((await loadSpeech()).engine).toBeNull();
    expect(mocks.importSpeech).not.toHaveBeenCalled();
    expect(mocks.locales).not.toHaveBeenCalled();
  });

  it('loads the speech package and device language when the native module exists', async () => {
    mocks.nativeModule.mockReturnValue({});
    const { loadSpeech } = await import('./load-speech');
    expect(await loadSpeech()).toEqual({ engine: expect.any(Object), language: 'de-DE' });
    expect(mocks.importSpeech).toHaveBeenCalledOnce();
  });

  it('allows the browser adapter without a native module', async () => {
    mocks.platform.OS = 'web';
    const { loadSpeech } = await import('./load-speech');
    expect((await loadSpeech()).engine).not.toBeNull();
    expect(mocks.nativeModule).not.toHaveBeenCalled();
  });
});
