import { useRef } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MessageSquareText, X } from 'lucide-react-native';
import type { FitnessMode } from '@fitness/ui';
import type { AnalysisChart } from '@fitness/ai';
import { useAppTheme } from './theme-provider';
import { ProgressChart } from './progress-chart';

type ConversationMessage = {
  _id: string;
  role: 'user' | 'assistant';
  text: string;
  chart?: AnalysisChart;
  createdAt: number;
};

export function ConversationDrawer({
  messages,
  mode,
  onClose,
  visible,
}: {
  messages: ConversationMessage[];
  mode: FitnessMode;
  onClose: () => void;
  visible: boolean;
}) {
  const { colors } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const chronologicalMessages = [...messages].reverse();

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View className="flex-1 flex-row bg-black/50">
        <Pressable accessibilityLabel="Close conversation" className="flex-1" onPress={onClose} />
        <View className="h-full w-[88%] max-w-md border-l border-line bg-canvas px-5 pb-8 pt-14 dark:border-line-dark dark:bg-canvas-dark">
          <View className="mb-6 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-2xl font-black text-ink dark:text-ink-dark">Conversation</Text>
              <Text className="mt-1 text-sm capitalize text-muted dark:text-muted-dark">
                {mode} history
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close conversation"
              className="h-11 w-11 items-center justify-center rounded-2xl border border-line bg-panel dark:border-line-dark dark:bg-panel-dark"
              onPress={onClose}
            >
              <X color={colors.text} size={20} />
            </Pressable>
          </View>

          {chronologicalMessages.length ? (
            <ScrollView
              contentContainerClassName="gap-4 pb-6"
              onContentSizeChange={() => {
                if (visible) scrollRef.current?.scrollToEnd({ animated: false });
              }}
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
            >
              {chronologicalMessages.map((message) => {
                const fromUser = message.role === 'user';
                return (
                  <View className={fromUser ? 'items-end' : 'items-start'} key={message._id}>
                    <View
                      className={
                        fromUser
                          ? 'max-w-[88%] rounded-3xl rounded-br-lg bg-accent px-4 py-3 dark:bg-accent-dark'
                          : 'max-w-[94%] rounded-3xl rounded-bl-lg border border-line bg-panel px-4 py-3 dark:border-line-dark dark:bg-panel-dark'
                      }
                    >
                      <Text
                        className={
                          fromUser
                            ? 'text-[15px] leading-6 text-accent-ink'
                            : 'text-[15px] leading-6 text-ink dark:text-ink-dark'
                        }
                      >
                        {message.text}
                      </Text>
                      {!fromUser && message.chart ? (
                        <ProgressChart chart={message.chart} compact />
                      ) : null}
                    </View>
                    <Text className="mt-1 px-1 text-[11px] text-muted dark:text-muted-dark">
                      {new Date(message.createdAt).toLocaleString([], {
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View className="flex-1 items-center justify-center px-5">
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-panel dark:bg-panel-dark">
                <MessageSquareText color={colors.muted} size={24} />
              </View>
              <Text className="mt-4 text-center text-lg font-bold text-ink dark:text-ink-dark">
                No prompts yet
              </Text>
              <Text className="mt-2 text-center text-sm leading-5 text-muted dark:text-muted-dark">
                Your {mode} conversation will appear here after you send a prompt.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
