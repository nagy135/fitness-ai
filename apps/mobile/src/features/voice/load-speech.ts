import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export async function loadSpeech() {
  // Metro reports a missing native module even when a dynamic import is caught.
  // Probe first so Expo Go and older app builds never evaluate that package.
  if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoSpeechRecognition')) {
    return { engine: null, language: 'en-US' };
  }
  const { ExpoSpeechRecognitionModule: engine } = await import('expo-speech-recognition');
  const { getLocales } = await import('expo-localization');
  return { engine, language: getLocales()[0]?.languageTag ?? 'en-US' };
}
