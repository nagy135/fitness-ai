import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { MessageCircleQuestion, Minus, Send, X } from 'lucide-react-native';
import { api } from '@fitness/convex/api';
import type { Doc } from '@fitness/convex/data-model';
import { Button, IconButton, Input } from '@fitness/ui';
import { useAppTheme } from './theme-provider';

type Question = Pick<Doc<'aiQuestions'>, '_id' | 'question' | 'options' | 'expiresAt'>;

export function AgentQuestionCard({
  question,
  count,
  onRespond,
}: {
  question: Question;
  count: number;
  onRespond: (answer?: string) => Promise<unknown>;
}) {
  const { colors } = useAppTheme();
  const { height } = useWindowDimensions();
  const [answer, setAnswer] = useState('');
  const [minimized, setMinimized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const locked = useRef(false);

  async function respond(value?: string) {
    if (locked.current) return;
    locked.current = true;
    setSaving(true);
    setError(undefined);
    try {
      await onRespond(value);
    } catch {
      setError('Your answer wasn’t sent. Check your connection and try again.');
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }

  return (
    <View
      className="overflow-hidden rounded-3xl border border-line bg-panel dark:border-line-dark dark:bg-panel-dark"
      style={{
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.18)',
        maxHeight: Math.max(160, height * 0.65),
      }}
    >
      <View className="flex-row items-center gap-2 border-b border-line px-4 py-2 dark:border-line-dark">
        <MessageCircleQuestion size={19} color={colors.accent} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={minimized ? 'Expand agent question' : 'Minimize agent question'}
          accessibilityState={{ expanded: !minimized }}
          className="min-h-11 flex-1 justify-center"
          onPress={() => setMinimized(!minimized)}
        >
          <Text className="text-sm font-bold text-ink dark:text-ink-dark">
            {count > 1 ? `Quick question (${count})` : 'Quick question'}
          </Text>
          {minimized ? (
            <Text numberOfLines={1} className="text-xs text-muted dark:text-muted-dark">
              {question.question}
            </Text>
          ) : null}
        </Pressable>
        {!minimized ? (
          <IconButton
            accessibilityLabel="Minimize agent question"
            onPress={() => setMinimized(true)}
          >
            <Minus size={18} color={colors.muted} />
          </IconButton>
        ) : null}
        <IconButton
          accessibilityLabel="Dismiss agent question"
          disabled={saving}
          onPress={() => void respond()}
        >
          <X size={18} color={colors.muted} />
        </IconButton>
      </View>
      {!minimized ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-3 p-4">
          <Text
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            className="text-lg font-semibold leading-6 text-ink dark:text-ink-dark"
          >
            {question.question}
          </Text>
          {question.options.length ? (
            <View className="gap-2">
              {question.options.map((option) => (
                <Button
                  key={option}
                  variant="secondary"
                  className="justify-start rounded-xl px-3"
                  accessibilityLabel={option}
                  disabled={saving}
                  onPress={() => {
                    setAnswer(option);
                    void respond(option);
                  }}
                >
                  {option}
                </Button>
              ))}
            </View>
          ) : null}
          <Input
            accessibilityLabel="Your answer to the agent"
            placeholder={question.options.length ? 'Or type your own answer…' : 'Your answer…'}
            value={answer}
            onChangeText={setAnswer}
            editable={!saving}
            maxLength={2_000}
            multiline
            className="max-h-28 text-[15px]"
          />
          {error ? (
            <Text accessibilityRole="alert" className="text-sm text-danger dark:text-danger-dark">
              {error}
            </Text>
          ) : null}
          <Button
            accessibilityLabel="Send answer to agent"
            disabled={!answer.trim()}
            loading={saving}
            onPress={() => void respond(answer.trim())}
          >
            <View className="flex-row items-center gap-2">
              <Text className="font-bold text-accent-ink dark:text-accent-ink-dark">
                Send answer
              </Text>
              <Send size={15} color={colors.accentInk} />
            </View>
          </Button>
        </ScrollView>
      ) : null}
    </View>
  );
}

export function AgentQuestionPopup() {
  const questions = useQuery(api.aiQuestions.pending, {});
  const respond = useMutation(api.aiQuestions.respond);
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!questions?.length) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [questions?.length]);
  const live = questions?.filter((question) => question.expiresAt > now) ?? [];
  const question = live[0];
  if (!question) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + 12,
        right: insets.right + 12,
        left: insets.left + 12,
        alignItems: 'flex-end',
        zIndex: 100,
      }}
    >
      <View style={{ width: '100%', maxWidth: 360 }}>
        <AgentQuestionCard
          key={question._id}
          question={question}
          count={live.length}
          onRespond={(answer) => respond({ id: question._id, ...(answer ? { answer } : {}) })}
        />
      </View>
    </View>
  );
}
