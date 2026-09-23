import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react-native';
import { api } from '@fitness/convex/api';
import { Button, Dialog, IconButton } from '@fitness/ui';
import {
  AI_MODELS,
  AI_REASONING_OPTIONS,
  resolveAISettings,
  type AISettings,
} from '@fitness/ai/settings';
import { ErrorNotice } from '@/components/error-notice';
import { useAppTheme } from '@/components/theme-provider';

function SettingsSelect<T extends string>({
  label,
  value,
  options,
  expanded,
  onToggle,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { id: T; name: string }[];
  expanded: boolean;
  onToggle: () => void;
  onChange: (value: T) => void;
}) {
  const { colors } = useAppTheme();
  const selectedName = options.find((option) => option.id === value)?.name;
  const Chevron = expanded ? ChevronUp : ChevronDown;
  return (
    <View>
      <Text className="mb-2 text-sm font-semibold text-ink dark:text-ink-dark">{label}</Text>
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={label}
        accessibilityValue={{ text: selectedName }}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        className="min-h-12 flex-row items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-3 py-3 dark:border-line-dark dark:bg-canvas-dark"
      >
        <Text className="flex-1 text-base text-ink dark:text-ink-dark">{selectedName}</Text>
        <Chevron size={18} color={colors.muted} />
      </Pressable>
      {expanded ? (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={`${label} options`}
          className="mt-2 overflow-hidden rounded-xl border border-line dark:border-line-dark"
        >
          {options.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityLabel={`${label}: ${option.name}`}
              accessibilityState={{ checked: value === option.id }}
              onPress={() => onChange(option.id)}
              className="min-h-12 flex-row items-center justify-between gap-3 px-3 py-3 active:opacity-70"
              style={{ backgroundColor: value === option.id ? colors.soft : colors.panel }}
            >
              <Text className="flex-1 text-base text-ink dark:text-ink-dark">{option.name}</Text>
              {value === option.id ? <Check size={18} color={colors.accent} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function QuickModelSettings({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.userProfiles.current, isAuthenticated ? {} : 'skip');
  const update = useMutation(api.userProfiles.updateAISettings);
  const [expanded, setExpanded] = useState<'model' | 'reasoning'>();
  const [draft, setDraft] = useState<AISettings>();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const desired = useRef<AISettings | undefined>(undefined);
  const pendingSave = useRef(Promise.resolve());
  const revision = useRef(0);
  const current = resolveAISettings(profile?.aiSettings);
  const selected = draft ?? current;

  function save(patch: Partial<AISettings>) {
    if (!profile) return;
    const settings = { ...(desired.current ?? current), ...patch };
    desired.current = settings;
    setDraft(settings);
    setExpanded(undefined);
    setStatus('saving');
    const version = ++revision.current;
    // Keep rapid model/reasoning changes together and persist them in order.
    pendingSave.current = pendingSave.current
      .then(() => update({ settings }))
      .then(() => {
        if (version !== revision.current) return;
        desired.current = undefined;
        setDraft(undefined);
        setStatus('saved');
      })
      .catch(() => {
        if (version === revision.current) setStatus('error');
      });
  }

  function close() {
    setExpanded(undefined);
    onClose();
  }

  return (
    <Dialog
      visible={visible}
      title="AI model"
      onRequestClose={close}
      headerAction={
        <IconButton accessibilityLabel="Close model settings" onPress={close}>
          <X size={20} color={colors.text} />
        </IconButton>
      }
    >
      {profile === undefined ? (
        <Text accessibilityLiveRegion="polite" className="text-sm text-muted dark:text-muted-dark">
          Loading model settings…
        </Text>
      ) : (
        <>
          <SettingsSelect
            label="Model"
            value={selected.model}
            options={AI_MODELS}
            expanded={expanded === 'model'}
            onToggle={() => setExpanded(expanded === 'model' ? undefined : 'model')}
            onChange={(model) => save({ model })}
          />
          <SettingsSelect
            label="Reasoning"
            value={selected.reasoningEffort}
            options={AI_REASONING_OPTIONS}
            expanded={expanded === 'reasoning'}
            onToggle={() => setExpanded(expanded === 'reasoning' ? undefined : 'reasoning')}
            onChange={(reasoningEffort) => save({ reasoningEffort })}
          />
          {status === 'error' ? (
            <>
              <ErrorNotice message="Your model settings could not be saved. Try again." />
              <Button variant="secondary" onPress={() => save({})}>
                Retry save
              </Button>
            </>
          ) : (
            <Text
              accessibilityLiveRegion="polite"
              className="text-sm text-muted dark:text-muted-dark"
            >
              {status === 'saving'
                ? 'Saving…'
                : status === 'saved'
                  ? 'Saved. Applies to your next request.'
                  : 'Saves automatically for your next request.'}
            </Text>
          )}
        </>
      )}
    </Dialog>
  );
}
