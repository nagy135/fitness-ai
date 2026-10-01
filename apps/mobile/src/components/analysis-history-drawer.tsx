import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useMutation, usePaginatedQuery } from 'convex/react';
import { Pencil } from 'lucide-react-native';
import { api } from '@fitness/convex/api';
import type { Id } from '@fitness/convex/data-model';
import { Button, IconButton, Input } from '@fitness/ui';
import { Drawer } from './drawer';
import { ErrorNotice } from './error-notice';
import { useAppTheme } from './theme-provider';

export function AnalysisHistoryDrawer({
  visible,
  selectedId,
  onClose,
  onOpen,
  onNew,
  onLegacy,
}: {
  visible: boolean;
  selectedId?: Id<'analysisSessions'>;
  onClose: () => void;
  onOpen: (id: Id<'analysisSessions'>) => void;
  onNew: () => void;
  onLegacy: () => void;
}) {
  const { colors } = useAppTheme();
  const { results, status, loadMore } = usePaginatedQuery(
    api.aiMessages.analysisHistory,
    visible ? {} : 'skip',
    { initialNumItems: 20 },
  );
  const rename = useMutation(api.aiMessages.renameAnalysisSession);
  const [editingId, setEditingId] = useState<Id<'analysisSessions'>>();
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const close = () => {
    if (!saving) {
      setEditingId(undefined);
      setError(undefined);
      onClose();
    }
  };
  async function save() {
    if (!editingId || saving) return;
    setSaving(true);
    setError(undefined);
    try {
      await rename({ sessionId: editingId, title });
      setEditingId(undefined);
    } catch {
      setError('The name could not be saved. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Drawer
      title="Analysis history"
      subtitle="Saved automatically, ready to revisit."
      visible={visible}
      onClose={close}
    >
      <Button disabled={saving} onPress={onNew}>
        New analysis
      </Button>
      <ErrorNotice message={error} />
      {status === 'LoadingFirstPage' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} accessibilityLabel="Loading analysis history" />
        </View>
      ) : (
        <ScrollView
          className="mt-4 flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-3 pb-6"
        >
          {!results.length ? (
            <Text className="py-8 text-center text-base text-muted dark:text-muted-dark">
              No saved analyses yet. Ask about your training to start one.
            </Text>
          ) : null}
          {results.map((item) => (
            <View
              key={item._id}
              className="rounded-2xl border border-line bg-panel p-4 dark:border-line-dark dark:bg-panel-dark"
            >
              {editingId === item._id ? (
                <View className="gap-3">
                  <Input
                    label="Analysis name"
                    value={title}
                    onChangeText={setTitle}
                    maxLength={100}
                    editable={!saving}
                    autoFocus
                  />
                  <Button disabled={!title.trim()} loading={saving} onPress={() => void save()}>
                    Save name
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={saving}
                    onPress={() => {
                      setEditingId(undefined);
                      setError(undefined);
                    }}
                  >
                    Cancel
                  </Button>
                </View>
              ) : (
                <View className="flex-row items-center gap-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open analysis: ${item.title}`}
                    accessibilityState={{ selected: selectedId === item._id }}
                    disabled={saving}
                    onPress={() => onOpen(item._id)}
                    className="min-h-12 flex-1 justify-center gap-1"
                  >
                    <Text
                      numberOfLines={2}
                      className="text-base font-bold text-ink dark:text-ink-dark"
                    >
                      {item.title}
                    </Text>
                    <Text className="text-xs text-muted dark:text-muted-dark">
                      {selectedId === item._id ? 'Current · ' : ''}
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </Text>
                  </Pressable>
                  <IconButton
                    accessibilityLabel={`Rename analysis: ${item.title}`}
                    disabled={saving}
                    onPress={() => {
                      setEditingId(item._id);
                      setTitle(item.title);
                      setError(undefined);
                    }}
                  >
                    <Pencil color={colors.muted} size={18} />
                  </IconButton>
                </View>
              )}
            </View>
          ))}
          {status === 'CanLoadMore' || status === 'LoadingMore' ? (
            <Button
              variant="secondary"
              loading={status === 'LoadingMore'}
              onPress={() => loadMore(20)}
            >
              Load more
            </Button>
          ) : null}
          <Button variant="ghost" disabled={saving} onPress={onLegacy}>
            Earlier analysis messages
          </Button>
        </ScrollView>
      )}
    </Drawer>
  );
}
