import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useProofViewport } from '@/components/puzzle/PlayProofCaption';

type ProofWindowProps = {
  children: ReactNode;
  inset?: number;
  focus?: number;
  playing?: boolean;
};

/** Keep the active landing visible when a readable model is taller than Play's viewport. */
export function ProofWindow({ children, inset = 0, focus = 0.5, playing = true }: ProofWindowProps) {
  const viewport = useProofViewport();
  const scroll = useRef<ScrollView>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const limit = viewport ? Math.max(0, viewport.availableModelHeight - inset) : undefined;

  useEffect(() => {
    if (!playing || limit === undefined || contentHeight <= limit) return;
    const y = Math.max(0, Math.min(contentHeight - limit, contentHeight * focus - limit / 2));
    scroll.current?.scrollTo({ y, animated: false });
  }, [contentHeight, focus, limit, playing]);

  if (!playing) return <>{children}</>;
  return (
    <ScrollView
      ref={scroll}
      nestedScrollEnabled
      removeClippedSubviews={false}
      scrollEnabled={limit !== undefined && contentHeight > limit}
      style={[styles.window, { maxHeight: limit }]}
      contentContainerStyle={styles.content}
      onContentSizeChange={(_, height) => setContentHeight(height)}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  window: { alignSelf: 'stretch', flexGrow: 0, flexShrink: 0 },
  content: { alignItems: 'center' },
});
