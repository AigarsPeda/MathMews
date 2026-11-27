import { AlphaType, ColorType, makeImageFromView, type CanvasRef, type SkImage } from '@shopify/react-native-skia';
import { useRef, type RefObject } from 'react';
import { Platform, View } from 'react-native';
import { useInitialModelPaint } from '../kit/useInitialModelPaint';
import type { RevealBeats } from '../kit/useRevealBeats';

export const canSnapshotModel = Platform.OS === 'ios' || Platform.OS === 'android';
export const canSnapshotCanvas = canSnapshotModel || Platform.OS === 'web';

/** Read the renderer once per attempt. Probe layout points for dark ink or a specific opaque RGB color. */
export function modelInk(image: SkImage, width: number, height: number) {
  const w = image.width(), h = image.height();
  const pixels = image.readPixels(0, 0, { width: w, height: h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
  return (x: number, y: number, rgb?: number) => {
    if (!pixels || x < 0 || y < 0 || x >= width || y >= height) return false;
    const i = 4 * (Math.floor(y * h / height) * w + Math.floor(x * w / width));
    if (pixels[i + 3] <= 120) return false;
    if (rgb === undefined) return Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 180;
    return Math.abs(pixels[i] - (rgb >>> 16)) <= 8 && Math.abs(pixels[i + 1] - ((rgb >>> 8) & 255)) <= 8 &&
      Math.abs(pixels[i + 2] - (rgb & 255)) <= 8;
  };
}

export async function verifySnapshot(snapshot: Promise<SkImage | null | undefined> | undefined, verify?: (image: SkImage) => boolean) {
  const image = await snapshot;
  if (!image) return false;
  try { return verify ? verify(image) : true; }
  finally { image.dispose(); }
}

/** Confirm a canvas, or a composed native model with its Skia children, before the first beat. */
export function useModelPaint(ready: boolean, beats?: RevealBeats, canvas?: RefObject<CanvasRef | null>, verify?: (image: SkImage) => boolean) {
  const view = useRef<View>(null);
  useInitialModelPaint(beats ?? { runId: 0 }, !!beats && (canvas ? canSnapshotCanvas : canSnapshotModel) && ready,
    () => verifySnapshot(canvas ? canvas.current?.makeImageSnapshotAsync() : makeImageFromView(view), verify));
  return view;
}
