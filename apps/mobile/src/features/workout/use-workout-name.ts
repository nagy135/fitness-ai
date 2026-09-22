import { useEffect, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@fitness/convex/api';
import type { Doc } from '@fitness/convex/data-model';

export function useWorkoutName(draft: Doc<'workoutDrafts'> | null | undefined) {
  const suggest = useAction(api.ai.workoutName.suggest);
  const draftId = draft?._id;
  const savedName = draft?.name ?? '';
  const exerciseKey = JSON.stringify(draft?.exercises.map(({ name }) => name) ?? []);
  const requestKey = JSON.stringify([draftId, exerciseKey]);
  const [manual, setManual] = useState<{ draftId: string; name: string }>();
  const [suggestion, setSuggestion] = useState<{ key: string; name: string; failed: boolean }>();
  const edited = !!draftId && manual?.draftId === draftId;

  useEffect(() => {
    if (!draftId || savedName || exerciseKey === '[]' || edited) return;
    let active = true;
    void suggest({ draftId }).then(
      (name) => {
        if (active) setSuggestion({ key: requestKey, name, failed: false });
      },
      () => {
        if (active) setSuggestion({ key: requestKey, name: '', failed: true });
      },
    );
    return () => {
      active = false;
    };
  }, [draftId, savedName, exerciseKey, requestKey, edited, suggest]);

  const currentSuggestion = suggestion?.key === requestKey ? suggestion : undefined;
  return {
    name: edited ? manual.name : savedName || currentSuggestion?.name || '',
    setName: (name: string) => {
      if (draftId) setManual({ draftId, name });
    },
    suggesting: !!draftId && !savedName && exerciseKey !== '[]' && !edited && !currentSuggestion,
    suggestionFailed: !edited && !!currentSuggestion?.failed,
  };
}
