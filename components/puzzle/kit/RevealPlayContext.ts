import { createContext, type ComponentType, type ReactNode } from 'react';

import type { ProofFrameEvent } from '@/components/dev/PlayProofAudit';

export const RevealPlayContext = createContext<{
  attemptKey?: string;
  onInitialModelPainted?: (runId: number) => void;
  /** Native QA observes clock transitions and requested landing ticks for this run. */
  onProofFrame?: (event: ProofFrameEvent) => void;
  onReplay?: () => void;
  landingHaptics?: boolean;
  Controls?: ComponentType<{ children: ReactNode }>;
}>({});
