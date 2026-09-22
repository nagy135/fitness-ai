import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { Check } from 'lucide-react-native';
import { api } from '@fitness/convex/api';
import { Button } from '@fitness/ui';
import {
  AI_MODELS,
  AI_REASONING_OPTIONS,
  resolveAISettings,
  type AISettings as Settings,
} from '@fitness/ai/settings';
import { ErrorNotice } from '@/components/error-notice';
import { useAppTheme } from '@/components/theme-provider';

export function AISettings() {
  const { colors } = useAppTheme();
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.userProfiles.current, isAuthenticated ? {} : 'skip');
  const update = useMutation(api.userProfiles.updateAISettings);
  const [draft, setDraft] = useState<Settings>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const locked = useRef(false);
  const current = resolveAISettings(profile?.aiSettings);
  const selected = draft ?? current;
  const changed =
    selected.model !== current.model || selected.reasoningEffort !== current.reasoningEffort;

  function select(patch: Partial<Settings>) {
    setDraft({ ...selected, ...patch });
    setError(undefined);
    setSaved(false);
  }

  async function save() {
    if (locked.current || !profile || !changed) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await update({ settings: selected });
      setDraft(undefined);
      setSaved(true);
    } catch {
      setError('Your AI settings could not be saved. Try again.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return (
    <View className="mt-8">
      <Text className="text-lg font-semibold text-ink dark:text-ink-dark">AI preferences</Text>
      <Text className="mt-1 text-sm leading-5 text-muted dark:text-muted-dark">
        Used for workout logging, analysis, and workout names. Saved to your account.
      </Text>
      {profile === undefined ? (
        <Text
          accessibilityLiveRegion="polite"
          className="mt-4 text-sm text-muted dark:text-muted-dark"
        >
          Loading AI preferences…
        </Text>
      ) : (
        <>
          <Text className="mb-2 mt-4 text-base font-semibold text-ink dark:text-ink-dark">
            Model
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="AI model" className="gap-2">
            {AI_MODELS.map((model) => (
              <Pressable
                key={model.id}
                accessibilityRole="radio"
                accessibilityLabel={model.name}
                accessibilityState={{ checked: selected.model === model.id, disabled: busy }}
                aria-checked={selected.model === model.id}
                disabled={busy}
                onPress={() => select({ model: model.id })}
                className="min-h-14 flex-row items-center justify-between rounded-2xl border px-4 py-3 active:opacity-80"
                style={{
                  backgroundColor: selected.model === model.id ? colors.soft : colors.panel,
                  borderColor: selected.model === model.id ? colors.accent : colors.line,
                }}
              >
                <Text className="text-base text-ink dark:text-ink-dark">{model.name}</Text>
                {selected.model === model.id ? <Check color={colors.accent} size={20} /> : null}
              </Pressable>
            ))}
          </View>
          <Text className="mb-1 mt-5 text-base font-semibold text-ink dark:text-ink-dark">
            Reasoning effort
          </Text>
          <Text className="mb-3 text-sm leading-5 text-muted dark:text-muted-dark">
            Higher effort gives the model more time to think and can take longer.
          </Text>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Reasoning effort"
            className="flex-row flex-wrap gap-2"
          >
            {AI_REASONING_OPTIONS.map((effort) => (
              <Pressable
                key={effort.id}
                accessibilityRole="radio"
                accessibilityLabel={`${effort.name} reasoning`}
                accessibilityState={{
                  checked: selected.reasoningEffort === effort.id,
                  disabled: busy,
                }}
                aria-checked={selected.reasoningEffort === effort.id}
                disabled={busy}
                onPress={() => select({ reasoningEffort: effort.id })}
                className="min-h-12 flex-row items-center gap-2 rounded-full border px-4 py-3 active:opacity-80"
                style={{
                  backgroundColor:
                    selected.reasoningEffort === effort.id ? colors.soft : colors.panel,
                  borderColor: selected.reasoningEffort === effort.id ? colors.accent : colors.line,
                }}
              >
                {selected.reasoningEffort === effort.id ? (
                  <Check color={colors.accent} size={16} />
                ) : null}
                <Text className="text-sm font-semibold text-ink dark:text-ink-dark">
                  {effort.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text className="mb-4 mt-3 text-xs text-muted dark:text-muted-dark">
            Default: GPT-5.6 Terra · Low
          </Text>
          <ErrorNotice message={error} />
          <Button loading={busy} disabled={!changed} onPress={() => void save()}>
            Save AI preferences
          </Button>
          {saved ? (
            <Text
              accessibilityLiveRegion="polite"
              className="mt-2 text-sm text-muted dark:text-muted-dark"
            >
              Saved. Applies to your next request.
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}
