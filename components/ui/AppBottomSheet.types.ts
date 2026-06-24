import type { ReactNode } from "react";

export type AppBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Taller sheets (e.g. picture help) — opens at ~75% screen height. */
  expanded?: boolean;
};
