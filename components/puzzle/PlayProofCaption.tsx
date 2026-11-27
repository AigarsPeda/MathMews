import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';
import { ProofPlaybackContext } from './kit/ProofFeedback';

export type ProofViewport = Readonly<{ innerWidth: number; availableModelHeight: number; fontScale: number }>;
export const ProofViewportContext = createContext<ProofViewport | null>(null);
export function useProofViewport(): ProofViewport | null {
  return useContext(ProofViewportContext);
}

export const PlayProofCaptionContext = createContext<((caption: ReactNode) => void) | null>(null);

export function PlayProofCaption({ children }: { children: ReactNode }) {
  const publish = useContext(PlayProofCaptionContext);
  const playback = useContext(ProofPlaybackContext);
  useLayoutEffect(() => {
    if (!publish) return;
    publish(<ProofPlaybackContext.Provider value={playback}>{children}</ProofPlaybackContext.Provider>);
    return () => publish(null);
  }, [children, playback, publish]);
  return publish ? null : children;
}
