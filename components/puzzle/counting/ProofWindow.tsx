import { useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { PlayProofCaptionContext, useProofViewport } from '../PlayProofCaption';

export function usePlaybackViewport() {
  const viewport = useProofViewport();
  const playing = useContext(PlayProofCaptionContext) != null;
  return playing ? viewport : null;
}

/** Keep a floor-sized model countable. A new beat brings its active region into view. */
export function ProofWindow({ height: requestedHeight, contentHeight, focus, children, persistent = false }: { persistent?: boolean; height?: number; contentHeight?: number; focus: number; children: ReactNode }) {
  const viewport = usePlaybackViewport();
  const height = requestedHeight ?? (viewport ? Math.max(1, viewport.availableModelHeight - 8) : undefined);
  const scroll = useRef<ScrollView>(null);
  const [content, setContent] = useState(0);
  useLayoutEffect(() => {
    if (height == null || content <= height) return;
    const y = Math.max(0, Math.min(content - height, focus * content - height / 2));
    scroll.current?.scrollTo({ y, animated: false });
  }, [height, content, focus]);
  if (!persistent && (height == null || contentHeight != null && contentHeight <= height)) return <>{children}</>;
  return <ScrollView ref={scroll} nestedScrollEnabled style={{ maxHeight: height, flexGrow: 0 }}
    scrollEnabled={height != null && content > height} onContentSizeChange={(_, measured) => setContent(measured)}>{children}</ScrollView>;
}
