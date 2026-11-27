import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RevealBeats } from './useRevealBeats';

/** Wait for all progress-zero assets and the renderer's own paint acknowledgement.
 * confirmPaint returns true once the complete submitted drawing can be presented.
 * For a native-only Surface the kit already handles this step. */
export function useInitialModelPaint(
  beats: Pick<RevealBeats, 'runId' | 'preparing' | 'onInitialModelPainted'>,
  modelReady: boolean,
  confirmPaint: () => Promise<boolean>,
) {
  const { runId, preparing, onInitialModelPainted } = beats;
  const confirm = useRef(confirmPaint);
  useLayoutEffect(() => { confirm.current = confirmPaint; });
  useEffect(() => {
    if (!preparing || !modelReady || !onInitialModelPainted) return;
    let active = true;
    let frame = requestAnimationFrame(inspect);
    async function inspect() {
      let painted = false;
      try { painted = await confirm.current(); }
      catch { /* A canvas can be temporarily unavailable during the native commit. */ }
      if (!active) return;
      if (painted) onInitialModelPainted?.(runId);
      else frame = requestAnimationFrame(inspect);
    }
    return () => { active = false; cancelAnimationFrame(frame); };
  }, [modelReady, onInitialModelPainted, preparing, runId]);
}
