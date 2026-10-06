import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { Dialog, IconButton } from '@fitness/ui';
import type { ToolCallRecord } from '@fitness/ai';
import { useAppTheme } from './theme-provider';

function parsePayload(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

function fullPayload(call: ToolCallRecord) {
  return JSON.stringify(
    {
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      input: parsePayload(call.input),
      ...(call.output !== undefined ? { output: parsePayload(call.output) } : {}),
      ...(call.error !== undefined ? { error: parsePayload(call.error) } : {}),
    },
    null,
    2,
  );
}

export function ToolCallPills({ calls }: { calls?: ToolCallRecord[] }) {
  const { colors } = useAppTheme();
  const [selected, setSelected] = useState<ToolCallRecord>();
  const close = () => setSelected(undefined);
  if (!calls?.length) return null;

  return (
    <View className="mt-2">
      <View className="flex-row flex-wrap gap-1">
        {calls.map((call, index) => (
          <Pressable
            key={`${call.toolCallId}-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`View ${call.toolName} tool call ${index + 1}`}
            accessibilityHint="Opens the full input and result in a dialog"
            hitSlop={4}
            onPress={() => setSelected(call)}
            className="max-w-full rounded-full border border-line bg-soft p-1 active:opacity-70 dark:border-line-dark dark:bg-soft-dark"
          >
            <Text className="text-[11px] font-medium leading-4 text-ink dark:text-ink-dark">
              {call.toolName}
            </Text>
          </Pressable>
        ))}
      </View>
      {selected ? (
        <Dialog
          visible
          title="Tool call"
          description={selected.toolName}
          onRequestClose={close}
          headerAction={
            <IconButton accessibilityLabel="Close tool call" onPress={close}>
              <X size={20} color={colors.text} />
            </IconButton>
          }
        >
          <View className="rounded-xl bg-soft p-3 dark:bg-soft-dark">
            <Text selectable className="font-mono text-xs leading-5 text-ink dark:text-ink-dark">
              {fullPayload(selected)}
            </Text>
          </View>
        </Dialog>
      ) : null}
    </View>
  );
}
