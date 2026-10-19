import type { ReactNode } from "react";

export type SheetPresentationProps = {
  visible: boolean;
  expanded: boolean;
  onClose: () => void;
  onDismissComplete?: () => void;
  children: ReactNode;
};
