import { BottomSheet, Group, Host } from "@expo/ui/swift-ui";
import { frame, presentationBackground, presentationDetents, presentationDragIndicator } from "@expo/ui/swift-ui/modifiers";
import { GameColors } from "@/constants/game";
import type { SheetPresentationProps } from "./SheetPresentation.types";

export function SheetPresentation({ visible, expanded, onClose, onDismissComplete, children }: SheetPresentationProps) {
  return (
    <Host style={{ position: "absolute" }} pointerEvents="none">
      <BottomSheet
        isPresented={visible}
        onIsPresentedChange={presented => { if (!presented) onClose(); }}
        onDismiss={onDismissComplete}
      >
        <Group modifiers={[
          frame({ maxWidth: Infinity, alignment: "topLeading" }),
          presentationDetents(expanded ? [{ fraction: 0.88 }] : ["medium"]),
          presentationDragIndicator("visible"),
          presentationBackground(GameColors.background),
        ]}>
          {children}
        </Group>
      </BottomSheet>
    </Host>
  );
}
