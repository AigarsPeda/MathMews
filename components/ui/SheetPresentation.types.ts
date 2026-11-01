import type { ReactNode } from "react";

export type SheetPresentationProps = {
  visible: boolean;
  /** Optional surface override; other app sheets keep their existing palette. */
  backgroundColor?: string;
  expanded: boolean;
  onClose: () => void;
  onDismissComplete?: () => void;
  children: ReactNode;
};
