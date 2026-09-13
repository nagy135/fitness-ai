import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useThemeVariables } from './theme-context';

export interface DialogProps extends PropsWithChildren {
  visible: boolean;
  title: string;
  description?: string;
  headerAction?: ReactNode;
  onRequestClose: () => void;
}

export function Dialog({
  visible,
  title,
  description,
  onRequestClose,
  children,
  headerAction,
}: DialogProps) {
  const variables = useThemeVariables();
  return (
    <Modal
      animationType="none"
      onRequestClose={onRequestClose}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: 'height' })}
        className="justify-center bg-black/50 px-5 py-10"
        // Keep flex native so Android keyboard avoidance can override it.
        style={[variables, { flex: 1 }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
          className="absolute inset-0"
          onPress={onRequestClose}
        />
        <ScrollView
          accessibilityViewIsModal
          className="mx-auto max-h-full w-full max-w-md grow-0 rounded-3xl border border-line bg-panel dark:border-line-dark dark:bg-panel-dark"
          contentContainerClassName="p-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-row flex-wrap items-center justify-between gap-3">
            <Text className="text-2xl font-bold text-ink dark:text-ink-dark">{title}</Text>
            {headerAction}
          </View>
          {description ? (
            <Text className="mt-2 text-base leading-6 text-muted dark:text-muted-dark">
              {description}
            </Text>
          ) : null}
          <View className="mt-6 gap-3">{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
