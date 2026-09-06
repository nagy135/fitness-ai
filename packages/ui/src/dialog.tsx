import type { PropsWithChildren } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

export interface DialogProps extends PropsWithChildren {
  visible: boolean;
  title: string;
  description?: string;
  onRequestClose: () => void;
}

export function Dialog({ visible, title, description, onRequestClose, children }: DialogProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onRequestClose}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <View className="flex-1 justify-end bg-black/70 px-4 pb-8">
        <Pressable className="absolute inset-0" onPress={onRequestClose} />
        <View className="rounded-[28px] border border-line bg-panel p-6 dark:border-line-dark dark:bg-panel-dark">
          <Text className="text-2xl font-bold text-ink dark:text-ink-dark">{title}</Text>
          {description ? (
            <Text className="mt-2 text-base leading-6 text-muted dark:text-muted-dark">
              {description}
            </Text>
          ) : null}
          <View className="mt-6 gap-3">{children}</View>
        </View>
      </View>
    </Modal>
  );
}
