import { Canvas, type CanvasProps, type SkSize } from '@shopify/react-native-skia';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useInitialModelPaint } from './kit/useInitialModelPaint';
import type { RevealBeats } from './kit/useRevealBeats';

export type TrackProofCanvas = (index: number, size: SharedValue<SkSize> | null) => void;

export function ProofCanvas({ trackCanvas, canvasIndex = 0, ...props }: Omit<CanvasProps, 'onSize'> & {
  trackCanvas?: TrackProofCanvas; canvasIndex?: number;
}) {
  const size = useSharedValue({ width: 0, height: 0 });
  useLayoutEffect(() => {
    if (!trackCanvas) return;
    trackCanvas(canvasIndex, size);
    return () => trackCanvas(canvasIndex, null);
  }, [canvasIndex, size, trackCanvas]);
  return <Canvas {...props} onSize={trackCanvas ? size : undefined} />;
}

/** Skia reports size from its frame callback after the scene has been committed.
 * Wait one more frame so all the registered canvases have had time to draw. */
export function useProofCanvasPaint(beats: RevealBeats, layoutReady: boolean, canvasIndices: readonly number[]) {
  const sizes = useRef(new Map<number, SharedValue<SkSize>>());
  const trackCanvas = useCallback<TrackProofCanvas>((index, size) => {
    if (size) sizes.current.set(index, size);
    else sizes.current.delete(index);
  }, []);
  useInitialModelPaint(beats, layoutReady && canvasIndices.length > 0, async () => {
    const measured = canvasIndices.map(index => sizes.current.get(index));
    if (measured.some(size => {
      const dimensions = size?.get();
      return !dimensions || dimensions.width <= 0 || dimensions.height <= 0;
    })) return false;
    // Readiness belongs to the mounted canvas. Replay can remount the scene.
    return new Promise(resolve => requestAnimationFrame(() => resolve(
      canvasIndices.every((index, i) => sizes.current.get(index) === measured[i]),
    )));
  });
  return trackCanvas;
}
