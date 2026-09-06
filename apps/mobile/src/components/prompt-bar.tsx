import { useRef } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { ArrowUp } from 'lucide-react-native';
import { useAppTheme } from './theme-provider';

export function PromptBar({
  placeholder,
  processing,
  onSubmit,
  value,
  onChangeText,
}: {
  placeholder: string;
  processing: boolean;
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: (text: string) => Promise<boolean>;
}) {
  const submitting = useRef(false);
  const { colors } = useAppTheme();
  async function submit() {
    const text = value.trim();
    if (!text || processing || submitting.current) return;
    submitting.current = true;
    try {
      if (await onSubmit(text)) onChangeText('');
    } finally {
      submitting.current = false;
    }
  }
  const disabled = !value.trim() || processing;
  return (
    <View className="border-t border-line bg-canvas px-5 pb-4 pt-3 dark:border-line-dark dark:bg-canvas-dark">
      <View className="min-h-16 flex-row items-end rounded-2xl border border-line bg-panel p-2 pl-4 dark:border-line-dark dark:bg-panel-dark">
        <TextInput
          accessibilityLabel={placeholder}
          className="max-h-28 min-h-11 flex-1 py-3 text-base text-ink dark:text-ink-dark"
          editable={!processing}
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
    </View>
  );
}
