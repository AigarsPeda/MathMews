import { GameColors } from "@/constants/game";
import { Drawer } from "vaul";
import type { SheetPresentationProps } from "./SheetPresentation.types";

export function SheetPresentation({ visible, expanded, onClose, onDismissComplete, children }: SheetPresentationProps) {
  return (
    <Drawer.Root
      open={visible}
      onOpenChange={open => { if (!open) onClose(); }}
      onAnimationEnd={open => { if (!open) onDismissComplete?.(); }}
      snapPoints={[expanded ? 0.88 : 0.5]}
    >
      <Drawer.Portal>
        <Drawer.Overlay style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0, 0, 0, 0.4)", zIndex: 50 }} />
        <Drawer.Content aria-describedby={undefined} style={{
          position: "fixed", bottom: 0, left: 0, right: 0, height: "96vh",
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
          backgroundColor: GameColors.background, zIndex: 50, outline: "none",
          display: "flex", flexDirection: "column", paddingTop: 16,
        }}>
          <Drawer.Title style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>
            Bottom sheet
          </Drawer.Title>
          <Drawer.Handle />
          <div style={{ overflow: "auto" }}>{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
