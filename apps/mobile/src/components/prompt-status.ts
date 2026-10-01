export type VoicePhase = 'idle' | 'starting' | 'listening' | 'stopping';

/** Waits shorter than this feel instant, so the timer stays hidden to avoid flicker. */
const elapsedThresholdSeconds = 3;

export function formatElapsed(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
}

export function promptStatus({
  processing,
  processingLabel,
  voicePhase,
  elapsedSeconds,
}: {
  processing: boolean;
  processingLabel: string;
  voicePhase: VoicePhase;
  elapsedSeconds: number;
}): { label: string; elapsed?: string } | null {
  if (processing) {
    return {
      label: processingLabel,
      elapsed:
        elapsedSeconds >= elapsedThresholdSeconds ? formatElapsed(elapsedSeconds) : undefined,
    };
  }
  if (voicePhase === 'starting') return { label: 'Starting microphone…' };
  if (voicePhase === 'stopping') return { label: 'Finishing transcription…' };
  if (voicePhase === 'listening') return { label: 'Listening… Tap stop when you’re done.' };
  return null;
}

/** Plates per sleeve, innermost first: heaviest plates sit against the collar. */
export const plates = [
  { width: 4, height: 14 },
  { width: 4, height: 11 },
  { width: 3, height: 8 },
] as const;

export const plateGap = 2;

/** Distance from the collar to a plate's inner edge. */
export function plateOffset(index: number) {
  return plates.slice(0, index).reduce((sum, plate) => sum + plate.width + plateGap, plateGap);
}

/** Share of one loading cycle during which each plate slides onto the sleeve. */
export function plateWindow(index: number): [number, number] {
  const start = 0.08 + index * 0.16;
  return [start, start + 0.14];
}
