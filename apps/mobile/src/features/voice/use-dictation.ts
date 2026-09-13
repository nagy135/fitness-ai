import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Dictation, type DictationState } from './dictation';
import { loadSpeech } from './load-speech';
import { waitForForeground } from './wait-for-foreground';

export function useDictation(
  value: string,
  onChangeText: (text: string) => void,
  enabled: boolean,
) {
  const [state, setState] = useState<DictationState>({ phase: 'idle' });
  const [dictation] = useState(() => new Dictation(loadSpeech, setState, waitForForeground));

  useFocusEffect(useCallback(() => () => dictation.cancel(), [dictation]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      // Android permission dialogs also background the activity. The controller
      // waits for it to return before starting the microphone.
      if (next === 'background' && !dictation.requestingPermission) {
        dictation.cancel();
      }
    });
    return () => {
      subscription.remove();
      dictation.cancel();
    };
  }, [dictation]);

  useEffect(() => {
    // A suggestion or mode change must not be overwritten by a late transcript.
    if (!enabled) dictation.cancel();
    else if (dictation.active && value !== dictation.expectedText) dictation.cancel();
  }, [dictation, enabled, value]);

  return {
    ...state,
    active: state.phase !== 'idle',
    isActive: () => dictation.active,
    toggle: () => {
      if (dictation.active) dictation.stop();
      else if (enabled) void dictation.start(value, onChangeText);
    },
  };
}
