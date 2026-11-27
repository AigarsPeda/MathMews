import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

type StageSize = { width: number; height: number; fit: number };
const natural = { width: 0, height: 0, fit: 1 };
const StageContext = createContext({ size: natural, claim: null as (() => () => void) | null, keepOrigin: null as (() => () => void) | null });

/** Drawings that read fit can size their text and geometry at native resolution. */
export function useModelStage(): StageSize {
  const { size, claim } = useContext(StageContext);
  useLayoutEffect(() => claim?.(), [claim]);
  return size;
}

/** A compact model that fits at its native size can keep its entry origin through Check. */
export function useKeepModelOrigin(enabled: boolean) {
  const { keepOrigin } = useContext(StageContext);
  useLayoutEffect(() => enabled ? keepOrigin?.() : undefined, [enabled, keepOrigin]);
}

export type ModelStageLayout = { width: number; height: number; checked: boolean; intrinsicWidth?: number; scrollToModel?: boolean; constrainHeight?: boolean };
type DrawingElement = {
  id: string;
  children: ArrayLike<DrawingElement>;
  offsetWidth?: number;
};

// A full-width task wrapper can contain a much narrower pie, clock or grid.
// Read its marked native model on layout, before applying any transform.
function drawingWidth(node: DrawingElement): number {
  if ((node.id === 'play-entry-model' || node.id === 'play-proof-model') && node.offsetWidth) return node.offsetWidth;
  for (const child of Array.from(node.children)) {
    const width = drawingWidth(child);
    if (width) return width;
  }
  return 0;
}

export function ModelStage({ layout, children }: { layout?: ModelStageLayout; children: ReactNode }) {
  const body = useRef<View>(null);
  const [intrinsic, setIntrinsic] = useState({ width: 0, height: 0 });
  const [readers, setReaders] = useState(0);
  const claim = useMemo(() => () => {
    setReaders(n => n + 1);
    return () => setReaders(n => n - 1);
  }, []);
  const [originReaders, setOriginReaders] = useState(0);
  const keepOrigin = useMemo(() => () => {
    setOriginReaders(n => n + 1);
    return () => setOriginReaders(n => n - 1);
  }, []);
  const width = layout?.width ?? 0;
  const height = layout?.height ?? 0;
  const constrain = !!layout?.constrainHeight && height > 0 && originReaders === 0;
  const fit = !constrain && intrinsic.width && intrinsic.height && height && !layout?.scrollToModel
    ? Math.max(1, Math.min(1.6, width / intrinsic.width, height / intrinsic.height)) : 1;
  const value = useMemo(() => ({ size: { width, height, fit }, claim, keepOrigin }), [width, height, fit, claim, keepOrigin]);
  if (!layout) return <>{children}</>;

  function measure({ nativeEvent: { layout: box } }: LayoutChangeEvent) {
    if (!box.width || !box.height || (!constrain && (layout?.checked || readers && fit > 1) && intrinsic.height)) return;
    const node = body.current;
    const modelWidth = node && 'children' in node ? drawingWidth(node as unknown as DrawingElement) : 0;
    const width = modelWidth || box.width;
    setIntrinsic(previous => previous.width === width && previous.height === box.height ? previous : { width, height: box.height });
  }
  // Pin the entry origin when a checked drawing gains a caption.
  const scale = constrain && intrinsic.height ? Math.min(1, height / intrinsic.height) : readers ? 1 : fit;
  const inset = Math.max(0, (height - intrinsic.height * fit) / 2);
  return <StageContext.Provider value={value}>
    <View style={constrain ? { height, maxHeight: height, justifyContent: 'center' }
      : layout.scrollToModel ? undefined : { minHeight: height, paddingTop: inset }}>
      <View ref={body} collapsable={false} onLayout={measure} style={{ alignSelf: 'center',
        flexShrink: 0, width: !layout.scrollToModel && layout.intrinsicWidth && !readers ? Math.min(width || layout.intrinsicWidth, layout.intrinsicWidth) : '100%',
        transformOrigin: constrain ? 'center' : 'top center', transform: [{ scale }] }}>{children}</View>
    </View>
  </StageContext.Provider>;
}
