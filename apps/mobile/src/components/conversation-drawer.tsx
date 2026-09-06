import { useRef } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { MessageSquareText } from 'lucide-react-native';
import type { FitnessMode } from '@fitness/ui';
import type { AnalysisChart } from '@fitness/ai';
import { useAppTheme } from './theme-provider';
import { ProgressChart } from './progress-chart';
import { Drawer } from './drawer';

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
  messages: ConversationMessage[] | undefined;
  mode: FitnessMode;
  onClose: () => void;
  visible: boolean;
}) {
  const { colors } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const chronologicalMessages = [...(messages ?? [])].reverse();

  return (
    <Drawer
      title="Conversation"
      subtitle={`${mode === 'workout' ? 'Workout' : 'Analysis'} messages`}
      visible={visible}
      onClose={onClose}
    >
      {messages === undefined ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} accessibilityLabel="Loading conversation" />
        </View>
      ) : chronologicalMessages.length ? (
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
                        ? 'text-[15px] leading-6 text-accent-ink dark:text-accent-ink-dark'
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
    </Drawer>
  );
}
