import { useRef } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { ArrowUp, Mic, Square } from 'lucide-react-native';
import { useAppTheme } from './theme-provider';
import { useDictation } from '@/features/voice/use-dictation';
import { ErrorNotice } from './error-notice';

export function PromptBar({
  placeholder,
  processing,
  onSubmit,
  value,
  onChangeText,
  voiceEnabled = true,
}: {
  placeholder: string;
  processing: boolean;
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: (text: string) => Promise<boolean>;
  voiceEnabled?: boolean;
}) {
  const submitting = useRef(false);
  const { colors } = useAppTheme();
  const voice = useDictation(value, onChangeText, !processing && voiceEnabled);
  async function submit() {
    const text = value.trim();
    if (!text || processing || submitting.current || voice.isActive()) return;
    submitting.current = true;
    try {
      if (await onSubmit(text)) onChangeText('');
    } finally {
      submitting.current = false;
    }
  }
  const disabled = !value.trim() || processing || voice.active;
  const voiceDisabled = processing || !voiceEnabled || voice.phase === 'stopping';
  return (
    <View className="border-t border-line bg-canvas px-5 pb-4 pt-3 dark:border-line-dark dark:bg-canvas-dark">
      <View className="min-h-16 flex-row items-end rounded-2xl border border-line bg-panel p-2 pl-4 dark:border-line-dark dark:bg-panel-dark">
        <TextInput
          accessibilityLabel={placeholder}
          className="max-h-28 min-h-11 flex-1 py-3 text-base text-ink dark:text-ink-dark"
          editable={!processing && !voice.active}
          multiline
          onChangeText={onChangeText}
          onSubmitEditing={() => void submit()}
          placeholder={processing ? 'Working on it…' : placeholder}
          placeholderTextColor={colors.muted}
          returnKeyType="send"
          submitBehavior="submit"
          value={value}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={voice.active ? 'Stop voice input' : 'Start voice input'}
          accessibilityHint="Dictates into the prompt for you to review before sending"
          accessibilityState={{
            disabled: voiceDisabled,
            busy: voice.phase === 'starting' || voice.phase === 'stopping',
          }}
          testID="voice-prompt"
          className={`mr-1 h-11 w-11 items-center justify-center rounded-xl ${voice.active ? 'bg-accent dark:bg-accent-dark' : 'bg-soft dark:bg-soft-dark'} ${voiceDisabled ? 'opacity-40' : ''}`}
          disabled={voiceDisabled}
          onPress={voice.toggle}
        >
          {voice.phase === 'starting' || voice.phase === 'stopping' ? (
            <ActivityIndicator color={colors.accentInk} size="small" />
          ) : voice.active ? (
            <Square color={colors.accentInk} size={19} fill={colors.accentInk} />
          ) : (
            <Mic color={colors.text} size={22} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send prompt"
          accessibilityState={{ disabled, busy: processing }}
          testID="send-prompt"
          className={`h-11 w-11 items-center justify-center rounded-xl bg-accent dark:bg-accent-dark ${disabled && !processing ? 'opacity-40' : ''}`}
          disabled={disabled}
          onPress={() => void submit()}
        >
          {processing ? (
            <ActivityIndicator color={colors.accentInk} size="small" />
          ) : (
            <ArrowUp color={colors.accentInk} size={22} />
          )}
        </Pressable>
      </View>
      {voice.active ? (
        <Text
          accessibilityLiveRegion="polite"
          className="mt-2 text-sm text-muted dark:text-muted-dark"
        >
          {voice.phase === 'starting'
            ? 'Starting microphone…'
            : voice.phase === 'stopping'
              ? 'Finishing transcription…'
              : 'Listening… Tap stop when you’re done.'}
        </Text>
      ) : null}
      <ErrorNotice message={voice.error} />
    </View>
  );
}
