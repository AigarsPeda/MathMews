import { Canvas, type SkSize } from '@shopify/react-native-skia';
import { createContext, useContext, useLayoutEffect, useMemo, useState, type ComponentProps } from 'react';
import { View, type ViewProps } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useInitialModelPaint } from '../kit/useInitialModelPaint';
import type { RevealBeats } from '../kit/useRevealBeats';

const CanvasSizes = createContext<Set<SharedValue<SkSize>> | null>(null);

/** Skia updates onSize from its own frame callback. Register only drawable canvases. */
export function useProofCanvasSize(drawable = true) {
  const sizes = useContext(CanvasSizes);
  const size = useSharedValue<SkSize>({ width: 0, height: 0 });
  useLayoutEffect(() => {
    if (!sizes || !drawable) return;
    sizes.add(size);
    return () => { sizes.delete(size); };
  }, [sizes, size, drawable]);
  return sizes && drawable ? size : undefined;
}

export function ProofCanvas(props: ComponentProps<typeof Canvas>) {
  const size = useProofCanvasSize();
  return <Canvas {...props} onSize={size} />;
}

/** Keep the opening picture until this model and every mounted glyph have had a frame. */
function MeasuredModel({ beats, ready = true, children, onLayout, ...props }: ViewProps & {
  beats: RevealBeats; ready?: boolean;
}) {
  const sizes = useMemo(() => new Set<SharedValue<SkSize>>(), []);
  const [laidOut, setLaidOut] = useState(false);
  useInitialModelPaint(beats, ready && laidOut, async () => {
    const sized = () => Array.from(sizes).every(size => {
      const { width, height } = size.get();
      return width > 0 && height > 0;
    });
    if (!sized()) return false;
    return new Promise(resolve => requestAnimationFrame(() => resolve(sized())));
  });
  return <CanvasSizes.Provider value={sizes}>
    <View {...props} collapsable={false} onLayout={event => {
      const { width, height } = event.nativeEvent.layout;
      setLaidOut(width > 0 && height > 0);
      onLayout?.(event);
    }}>{children}</View>
  </CanvasSizes.Provider>;
}

export function PaintedModel({ beats, ready, ...props }: ViewProps & { beats?: RevealBeats; ready?: boolean }) {
  return beats ? <MeasuredModel beats={beats} ready={ready} {...props} /> : <View {...props} />;
}
