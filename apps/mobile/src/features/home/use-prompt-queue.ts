import { useEffect, useRef, useState } from 'react';

export interface QueuedPrompt {
  id: number;
  text: string;
}

export function usePromptQueue(send: (text: string) => Promise<boolean>, processing: boolean) {
  const [pending, setPending] = useState<QueuedPrompt[]>([]);
  const pendingRef = useRef(pending);
  const [active, setActive] = useState<QueuedPrompt>();
  const [failed, setFailed] = useState(false);
  const running = useRef(false);
  const nextId = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function replacePending(next: QueuedPrompt[]) {
    pendingRef.current = next;
    setPending(next);
  }

  useEffect(() => {
    if (processing || running.current || failed) return;
    const next = active ?? pendingRef.current[0];
    if (!next) return;
    running.current = true;
    setActive(next);
    if (!active) replacePending(pendingRef.current.slice(1));
    void (async () => {
      let success = false;
      try {
        success = await send(next.text);
      } catch {
        // Keep the original message available even if the caller throws.
      }
      running.current = false;
      if (!mounted.current) return;
      if (success) setActive(undefined);
      else setFailed(true);
    })();
  }, [active, failed, pending, processing, send]);

  return {
    pending,
    failed: failed ? active : undefined,
    full: pending.length >= 3,
    hasWork: !!active || pending.length > 0,
    enqueue: async (text: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed || pendingRef.current.length >= 3) return false;
      replacePending([...pendingRef.current, { id: nextId.current++, text: trimmed }]);
      return true;
    },
    remove: (id: number) => replacePending(pendingRef.current.filter((item) => item.id !== id)),
    retry: () => setFailed(false),
    discardFailed: () => {
      setActive(undefined);
      setFailed(false);
    },
  };
}
