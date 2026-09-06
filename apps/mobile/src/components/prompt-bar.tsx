import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, TextInput, View } from 'react-native';
import { Send } from 'lucide-react-native';
import { useAppTheme } from './theme-provider';

export function PromptBar({
  placeholder,
  processing,
  onSubmit,
}: {
  placeholder: string;
  processing: boolean;
  onSubmit: (text: string) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const submitting = useRef(false);
  const { colors } = useAppTheme();
  async function submit() {
    const text = value.trim();
    if (!text || processing || submitting.current) return;
    submitting.current = true;
    setValue('');
    try {
      await onSubmit(text);
    } finally {
      submitting.current = false;
    }
  }
  return (
    <View className="border-t border-line bg-canvas px-4 pb-3 pt-3 dark:border-line-dark dark:bg-canvas-dark">
      <View className="min-h-14 flex-row items-end rounded-3xl border border-line bg-panel p-2 pl-4 dark:border-line-dark dark:bg-panel-dark">
        <TextInput
          className="max-h-28 flex-1 py-2 text-base text-ink dark:text-ink-dark"
          editable={!processing}
          multiline
          onChangeText={setValue}
          onKeyPress={(event) => {
            if (Platform.OS === 'web' && event.nativeEvent.key === 'Enter') {
              event.preventDefault();
              void submit();
            }
          }}
          onSubmitEditing={submit}
          placeholder={processing ? 'Processing…' : placeholder}
          placeholderTextColor={colors.muted}
          returnKeyType="send"
          submitBehavior="submit"
          value={value}
        />
        <Pressable
          accessibilityLabel="Send prompt"
          testID="send-prompt"
          className="h-10 w-10 items-center justify-center rounded-full bg-accent dark:bg-accent-dark"
          disabled={!value.trim() || processing}
          onPress={submit}
        >
          {processing ? (
            <ActivityIndicator color="#0B0D0F" size="small" />
          ) : (
            <Send color="#0B0D0F" size={18} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
