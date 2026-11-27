import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';

/** The task's existing scroll viewport owns programmatic focus movement. */
export const ExchangeScrollContext = createContext<((view: View) => void) | null>(null);

/** Keep a proof visible in Play when its countable layout needs the heading's space. */
export function useProofModelScroll(availableHeight: number | undefined) {
  const scrollTo = useContext(ExchangeScrollContext);
  const ref = useRef<View>(null);
  const [height, setHeight] = useState(0);
  const overflows = availableHeight !== undefined && height > availableHeight + 8;
  useEffect(() => {
    if (!overflows || !scrollTo) return;
    const frame = requestAnimationFrame(() => {
      if (ref.current) scrollTo(ref.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [overflows, scrollTo]);
  const onLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) => setHeight(layout.height);
  return { ref, onLayout, collapsable: false } as const;
}
