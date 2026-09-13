import type { PropsWithChildren } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { IconButton, useThemeVariables } from '@fitness/ui';
import { useAppTheme } from './theme-provider';
import { ThemeToggle } from './theme-toggle';
import { DisplayText } from './display-text';

export function Drawer({
  title,
  subtitle,
  visible,
  onClose,
  children,
}: PropsWithChildren<{ title: string; subtitle: string; visible: boolean; onClose: () => void }>) {
  const { colors } = useAppTheme();
  const variables = useThemeVariables();
  const insets = useSafeAreaInsets();
  return (
    <Modal animationType="none" onRequestClose={onClose} transparent visible={visible}>
      <View style={variables} className="flex-1 flex-row justify-end bg-black/50">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${title.toLowerCase()}`}
          className="absolute inset-0"
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          className="h-full w-[92%] max-w-lg border-l border-line bg-canvas px-5 dark:border-line-dark dark:bg-canvas-dark"
          style={{
            paddingTop: Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 20),
          }}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <ThemeToggle />
            <IconButton accessibilityLabel={`Close ${title.toLowerCase()}`} onPress={onClose}>
              <X color={colors.text} size={21} />
            </IconButton>
          </View>
          <View className="mb-6 flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <DisplayText className="text-[40px] leading-[46px]">{title}</DisplayText>
              <Text className="mt-1 text-sm text-muted dark:text-muted-dark">{subtitle}</Text>
            </View>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}
