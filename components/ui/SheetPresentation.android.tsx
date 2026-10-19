import { Column, Host, ModalBottomSheet, type ModalBottomSheetRef } from "@expo/ui/jetpack-compose";
import { fillMaxHeight } from "@expo/ui/jetpack-compose/modifiers";
import { GameColors } from "@/constants/game";
import { useEffect, useRef, useState } from "react";
import type { SheetPresentationProps } from "./SheetPresentation.types";

export function SheetPresentation({ visible, expanded, onClose, onDismissComplete, children }: SheetPresentationProps) {
  const sheetRef = useRef<ModalBottomSheetRef>(null);
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const dismissComplete = useRef(onDismissComplete);
  useEffect(() => { dismissComplete.current = onDismissComplete; }, [onDismissComplete]);

  useEffect(() => {
    if (visible) return;
    let cancelled = false;
    // hide() resolves after the native closing animation, unlike onDismissRequest.
    sheetRef.current?.hide().then(() => {
      if (cancelled) return;
      setMounted(false);
      dismissComplete.current?.();
    });
    return () => { cancelled = true; };
  }, [visible]);

  if (!mounted) return null;
  return (
    <Host style={{ position: "absolute" }} pointerEvents="none">
      <ModalBottomSheet
        ref={sheetRef}
        onDismissRequest={onClose}
        skipPartiallyExpanded={expanded}
        containerColor={GameColors.background}
      >
        <Column modifiers={expanded ? [fillMaxHeight()] : []}>{children}</Column>
      </ModalBottomSheet>
    </Host>
  );
}
