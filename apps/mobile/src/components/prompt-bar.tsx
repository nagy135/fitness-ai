import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { ArrowUp, Mic, Square, X } from 'lucide-react-native';
import { useAppTheme } from './theme-provider';
import { useDictation } from '@/features/voice/use-dictation';
import { ErrorNotice } from './error-notice';
import { WaterRippleProgress } from './water-ripple-progress';
import { DisplayText } from './display-text';
import { promptStatus } from './prompt-status';
import type { QueuedPrompt } from '@/features/home/use-prompt-queue';

export function PromptBar({
  placeholder,
  processing,
  processingLabel = 'Working on it…',
  onSubmit,
  value,
  onChangeText,
  voiceEnabled = true,
  queued = [],
  queueFull = false,
  failedPrompt,
  onRemoveQueued,
  onRetryFailed,
  onDiscardFailed,
}: {
  placeholder: string;
  processing: boolean;
  processingLabel?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: (text: string) => Promise<boolean>;
  voiceEnabled?: boolean;
  queued?: QueuedPrompt[];
  queueFull?: boolean;
  failedPrompt?: QueuedPrompt;
  onRemoveQueued?: (id: number) => void;
  onRetryFailed?: () => void;
  onDiscardFailed?: () => void;
}) {
  const submitting = useRef(false);
  const { colors } = useAppTheme();
  const voice = useDictation(value, onChangeText, voiceEnabled);
  const [focused, setFocused] = useState(false);
  async function submit() {
    const text = value.trim();
    if (!text || queueFull || submitting.current || voice.isActive()) return;
    submitting.current = true;
    try {
      if (await onSubmit(text)) onChangeText('');
    } finally {
      submitting.current = false;
    }
  }
  const disabled = !value.trim() || queueFull || voice.active;
  const voiceDisabled = !voiceEnabled || voice.phase === 'stopping';
  const status = promptStatus({
    processing: false,
    processingLabel,
    voicePhase: voice.phase,
    elapsedSeconds: 0,
  });
  return (
    <View className="relative bg-canvas px-4 pb-4 pt-3 dark:bg-canvas-dark">
      {status ? (
        <View
          accessibilityLiveRegion="polite"
          className="mb-2 flex-row items-baseline justify-between gap-3 px-1"
        >
          <DisplayText
            className="flex-1 text-[17px] leading-5 text-muted dark:text-muted-dark"
            numberOfLines={1}
          >
            {status.label}
          </DisplayText>
        </View>
      ) : null}
      {failedPrompt ? (
        <View
          className="mb-2 rounded-xl bg-soft p-3 dark:bg-soft-dark"
          accessibilityLiveRegion="polite"
        >
          <Text className="text-sm font-semibold text-danger dark:text-danger-dark">
            Queue paused · message failed
          </Text>
          <Text numberOfLines={2} className="mt-1 text-sm text-ink dark:text-ink-dark">
            {failedPrompt.text}
          </Text>
          <View className="flex-row gap-4">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry failed prompt"
              onPress={onRetryFailed}
              className="min-h-11 justify-center"
            >
              <Text className="font-semibold text-accent dark:text-accent-dark">Retry</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Discard failed prompt and continue queue"
              onPress={onDiscardFailed}
              className="min-h-11 justify-center"
            >
              <Text className="text-muted dark:text-muted-dark">Discard and continue</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {queued.length ? (
        <View
          className="mb-2 rounded-xl bg-soft px-3 py-1 dark:bg-soft-dark"
          accessibilityLiveRegion="polite"
        >
          <Text className="pt-2 text-xs font-semibold text-muted dark:text-muted-dark">
            Queued · {queued.length}/3
          </Text>
          {queued.map((item, index) => (
            <View key={item.id} className="min-h-11 flex-row items-center gap-2">
              <Text numberOfLines={2} className="flex-1 text-sm text-ink dark:text-ink-dark">
                {index + 1}. {item.text}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove queued message ${index + 1}`}
                onPress={() => onRemoveQueued?.(item.id)}
                className="h-11 w-11 items-center justify-center"
              >
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View
        className={`min-h-14 flex-row items-end rounded-[26px] border bg-panel py-1.5 pl-4 pr-1.5 dark:bg-panel-dark ${focused ? 'border-accent dark:border-accent-dark' : 'border-line dark:border-line-dark'}`}
      >
        <TextInput
          accessibilityLabel={placeholder}
          className={`max-h-28 min-h-11 flex-1 py-3 pr-2 text-base leading-5 text-ink dark:text-ink-dark`}
          editable={!voice.active}
          multiline
          onBlur={() => setFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onSubmitEditing={() => void submit()}
          placeholder={queueFull ? 'Queue full — 3 messages waiting' : placeholder}
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
          className={`mr-1 h-11 w-11 items-center justify-center rounded-full active:bg-soft dark:active:bg-soft-dark ${voice.active ? 'bg-accent dark:bg-accent-dark' : ''} ${voiceDisabled ? 'opacity-40' : ''}`}
          disabled={voiceDisabled}
          onPress={voice.toggle}
        >
          {voice.phase === 'starting' || voice.phase === 'stopping' ? (
            <ActivityIndicator color={colors.accentInk} size="small" />
          ) : voice.active ? (
            <Square color={colors.accentInk} size={17} fill={colors.accentInk} />
          ) : (
            <Mic color={colors.muted} size={22} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={processing || queued.length ? 'Queue prompt' : 'Send prompt'}
          accessibilityState={{ disabled, busy: processing }}
          accessibilityHint={processing ? processingLabel : undefined}
          testID="send-prompt"
          className={`h-11 w-11 items-center justify-center rounded-full bg-accent active:opacity-80 dark:bg-accent-dark ${disabled && !processing ? 'opacity-40' : ''}`}
          disabled={disabled}
          onPress={() => void submit()}
        >
          {processing ? (
            <WaterRippleProgress />
          ) : (
            <ArrowUp color={colors.accentInk} size={22} strokeWidth={2.5} />
          )}
        </Pressable>
      </View>
      <ErrorNotice message={voice.error} />
    </View>
  );
}
