import type { ReactNode } from "react";

export type AppBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Called after the closing animation has finished. */
  onDismissComplete?: () => void;
  /** A render function can explicitly bound a scrolling body and fixed footer. */
  children: ReactNode | ((contentHeight: number | undefined) => ReactNode);
  /** Taller sheets for picture help, previews and puzzle results. */
  expanded?: boolean;
};
