import { useEffect, useRef } from 'react';
import type { Doc } from '@fitness/convex/data-model';
import type { FitnessMode } from '@fitness/ui';

export function useAgentChatFocus({
  command,
  mode,
  draftId,
  sessionId,
  onChange,
}: {
  command: Doc<'aiChatFocus'> | null | undefined;
  mode: FitnessMode;
  draftId?: string;
  sessionId?: string;
  onChange: (open: boolean) => void;
}) {
  const previousVersion = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (command === undefined) return;
    const version = command?.version ?? 0;
    const previous = previousVersion.current;
    previousVersion.current = version;
    // The first subscription snapshot is history, not a new navigation request.
    // Home waits for that snapshot before enabling its prompt composer.
    if (previous === undefined || version <= previous || !command) return;
    if (command.mode !== mode) return;
    if (mode === 'workout' ? command.draftId !== draftId : command.sessionId !== sessionId) return;
    onChange(command.open);
  }, [command, draftId, mode, onChange, sessionId]);
}
