import { useEffect, useRef } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, MessageSquareText } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, type FitnessMode } from '@fitness/ui';
import type { AnalysisChart, ToolCallRecord } from '@fitness/ai';
import { useAppTheme } from './theme-provider';
import { ProgressChart } from './progress-chart';
import { DisplayText } from './display-text';
import { AnalysisMarkdown } from './analysis-markdown';
import { ToolCallPills } from './tool-call-pills';

type ConversationMessage = {
  _id: string;
  role: 'user' | 'assistant';
  text: string;
  chart?: AnalysisChart;
  toolCalls?: ToolCallRecord[];
  createdAt: number;
};

export function ConversationDrawer({
  messages,
  mode,
  onClose,
  visible,
  onLoadOlder,
  loadingOlder,
}: {
  messages: ConversationMessage[] | undefined;
  mode: FitnessMode;
  onClose: () => void;
  visible: boolean;
  onLoadOlder?: () => void;
  loadingOlder?: boolean;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const lastScrolledMessage = useRef<string | undefined>(undefined);
  const chronologicalMessages = [...(messages ?? [])].reverse();
  useEffect(() => {
    if (visible) {
      lastScrolledMessage.current = undefined;
      scrollRef.current?.scrollToEnd({ animated: false });
    }
  }, [visible]);

  return (
    <View
      className="flex-1 bg-canvas dark:bg-canvas-dark"
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <View className="mx-auto w-full max-w-3xl flex-1 px-5">
        <View className="min-h-[88px] flex-row items-center gap-3 py-3">
          <IconButton accessibilityLabel="Close conversation" onPress={onClose}>
            <ArrowLeft color={colors.text} size={22} />
          </IconButton>
          <View className="flex-1">
            <DisplayText accessibilityRole="header" className="text-[32px] leading-10">
              Conversation
            </DisplayText>
            <Text className="text-xs text-muted dark:text-muted-dark">
              {mode === 'workout' ? 'Current workout' : 'Current analysis'} · Swipe right to return
            </Text>
          </View>
        </View>
        {messages === undefined ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.accent} accessibilityLabel="Loading conversation" />
          </View>
        ) : chronologicalMessages.length || onLoadOlder || loadingOlder ? (
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-4 pb-6"
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            onContentSizeChange={() => {
              if (visible && lastScrolledMessage.current !== messages?.[0]?._id) {
                scrollRef.current?.scrollToEnd({ animated: false });
                lastScrolledMessage.current = messages?.[0]?._id;
              }
            }}
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {onLoadOlder || loadingOlder ? (
              <Button variant="ghost" loading={loadingOlder} onPress={onLoadOlder}>
                Load earlier messages
              </Button>
            ) : null}
            {chronologicalMessages.map((message) => {
              const fromUser = message.role === 'user';
              return (
                <View className={fromUser ? 'items-end' : 'items-start'} key={message._id}>
                  {!fromUser ? <ToolCallPills calls={message.toolCalls} layout="bubbles" /> : null}
                  <View
                    className={
                      fromUser
                        ? 'max-w-[88%] rounded-3xl rounded-br-lg bg-accent px-4 py-3 dark:bg-accent-dark'
                        : 'w-[94%] rounded-3xl rounded-bl-lg border border-line bg-panel px-4 py-3 dark:border-line-dark dark:bg-panel-dark'
                    }
                  >
                    {!fromUser ? (
                      <AnalysisMarkdown text={message.text} compact />
                    ) : (
                      <Text
                        selectable
                        className="text-[15px] leading-6 text-accent-ink dark:text-accent-ink-dark"
                      >
                        {message.text}
                      </Text>
                    )}
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
  );
}
