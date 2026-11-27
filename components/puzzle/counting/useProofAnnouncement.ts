import { useEffect } from 'react';
import type { RevealBeats } from '../kit/useRevealBeats';

/** Share nearby automatic counts. A paused step and the final caption speak immediately. */
export function useProofAnnouncement({ announce, landed, settled, paused, runId }: RevealBeats, message: string, playing: boolean) {
  useEffect(() => {
    if (playing && (landed > 0 || settled)) announce?.(message, paused || settled ? 0 : 240);
  }, [announce, landed, message, paused, playing, runId, settled]);
}
