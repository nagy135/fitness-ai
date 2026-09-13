import type {
  ExpoSpeechRecognitionModule,
  ExpoSpeechRecognitionErrorCode,
} from 'expo-speech-recognition';

export type SpeechEngine = Pick<
  typeof ExpoSpeechRecognitionModule,
  | 'isRecognitionAvailable'
  | 'getPermissionsAsync'
  | 'requestPermissionsAsync'
  | 'addListener'
  | 'start'
  | 'stop'
  | 'abort'
>;
export type DictationState = {
  phase: 'idle' | 'starting' | 'listening' | 'stopping';
  error?: string;
};

const noSpeech = 'No speech detected. Tap the microphone to try again.';
const errors: Partial<Record<ExpoSpeechRecognitionErrorCode, string>> = {
  'not-allowed': 'Allow microphone and speech recognition access in Settings to use voice input.',
  'service-not-allowed': 'Speech recognition is unavailable. You can still type your prompt.',
  'language-not-supported':
    'Speech recognition does not support your phone’s language. You can still type your prompt.',
  'audio-capture': 'The microphone is unavailable. Close other recording apps and try again.',
  network: 'Speech recognition could not connect. Check your connection and try again.',
  interrupted: 'Voice input was interrupted. Review the text or tap the microphone to continue.',
  'no-speech': noSpeech,
  'speech-timeout': noSpeech,
};

// One short utterance per tap. Partial results replace one another; each new
// dictation appends to the existing prompt without submitting it.
export class Dictation {
  private session?: {
    engine?: SpeechEngine;
    subscriptions: { remove: () => void }[];
    timer?: ReturnType<typeof setTimeout>;
    receivedText: boolean;
    requestingPermission?: boolean;
  };
  private phase: DictationState['phase'] = 'idle';
  expectedText = '';

  constructor(
    private load: () => Promise<{ engine: SpeechEngine | null; language: string }>,
    private onState: (state: DictationState) => void,
    private waitForForeground: () => Promise<boolean> = async () => true,
  ) {}

  get active() {
    return this.session !== undefined;
  }

  get requestingPermission() {
    return this.session?.requestingPermission === true;
  }

  private update(phase: DictationState['phase'], error?: string) {
    this.phase = phase;
    this.onState({ phase, error });
  }

  async start(text: string, onText: (text: string) => void) {
    if (this.active) return;
    const session: NonNullable<Dictation['session']> = { subscriptions: [], receivedText: false };
    this.session = session;
    this.expectedText = text;
    this.update('starting');
    try {
      const { engine, language } = await this.load();
      if (this.session !== session) return;
      if (!engine) {
        this.finish(
          'Voice input needs an updated Fitness AI app. For now, use your keyboard’s microphone to dictate.',
        );
        return;
      }
      if (!engine.isRecognitionAvailable()) {
        this.finish('Speech recognition is unavailable here. You can still type your prompt.');
        return;
      }
      let permission = await engine.getPermissionsAsync();
      if (this.session !== session) return;
      if (!permission.granted) {
        // Android can report background on every permission request, even if
        // permission is immediately granted. Do not request it again needlessly.
        session.requestingPermission = true;
        permission = await engine.requestPermissionsAsync();
      }
      if (this.session !== session) return;
      if (!permission.granted) {
        this.finish(errors['not-allowed']);
        return;
      }
      // The permission result may arrive before Android restores the activity.
      // Never start the microphone while the app is still in the background.
      const foreground = await this.waitForForeground();
      if (this.session !== session) return;
      session.requestingPermission = false;
      if (!foreground) {
        this.finish(
          'Voice input was canceled while the app was in the background. Tap the microphone to try again.',
        );
        return;
      }
      session.engine = engine;
      session.subscriptions = [
        engine.addListener('start', () => {
          if (this.session === session && this.phase === 'starting') this.update('listening');
        }),
        engine.addListener('result', (event) => {
          if (this.session !== session) return;
          const transcript = event.results[0]?.transcript.trim();
          if (!transcript) return;
          session.receivedText = true;
          this.expectedText = text + (text && !/\s$/.test(text) ? ' ' : '') + transcript;
          onText(this.expectedText);
        }),
        engine.addListener('error', (event) => {
          if (this.session !== session) return;
          this.finish(
            event.error === 'aborted'
              ? undefined
              : (errors[event.error] ??
                  'Voice input did not finish. Review the text and try again.'),
          );
        }),
        engine.addListener('end', () => {
          if (this.session === session)
            this.finish(session.receivedText ? undefined : noSpeech, false);
        }),
      ];
      // Bound recording even if the platform never sends a final result.
      session.timer = setTimeout(() => this.stop(), 60_000);
      engine.start({
        lang: language,
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        contextualStrings: [
          'bench press',
          'deadlift',
          'squat',
          'reps',
          'kilograms',
          'Bankdrücken',
          'Kreuzheben',
          'Kniebeugen',
        ],
        recordingOptions: { persist: false },
      });
    } catch {
      if (this.session === session) {
        this.finish(
          'Voice input is unavailable in this app or browser. You can still type or use keyboard dictation.',
        );
      }
    }
  }

  stop() {
    const session = this.session;
    if (!session || this.phase === 'stopping') return;
    if (!session.engine) {
      this.cancel();
      return;
    }
    clearTimeout(session.timer);
    this.update('stopping');
    // Keep accepting the final transcript after stop, but do not leave the UI
    // locked if the platform fails to emit end.
    session.timer = setTimeout(() => {
      if (this.session === session)
        this.finish('Voice input stopped. Review the text before sending.');
    }, 5_000);
    try {
      session.engine.stop();
    } catch {
      this.finish('Voice input stopped. Review the text before sending.');
    }
  }

  cancel() {
    if (this.active) {
      this.finish();
    }
  }

  private finish(error?: string, abort = true) {
    const session = this.session;
    this.session = undefined;
    clearTimeout(session?.timer);
    session?.subscriptions.forEach((subscription) => subscription.remove());
    if (abort) {
      try {
        session?.engine?.abort();
      } catch {
        /* The recognizer may already be unavailable. */
      }
    }
    this.update('idle', error);
  }
}
