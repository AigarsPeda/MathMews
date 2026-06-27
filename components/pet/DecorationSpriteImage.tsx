import { SheetSprite } from "@/components/pet/SheetSprite";
import {
  CAT_DECORATION_SHEET,
  CAT_DECORATION_SHEET_SIZE,
  getDecorationCatalogEntry,
  type CatDecorationId,
} from "@/constants/cat-decorations";

type DecorationSpriteImageProps = {
  decorationId: CatDecorationId;
  size: number;
};

export function DecorationSpriteImage({
  decorationId,
  size,
}: DecorationSpriteImageProps) {
  const entry = getDecorationCatalogEntry(decorationId);
  if (!entry) {
    return null;
  }

  return (
    <SheetSprite
      source={CAT_DECORATION_SHEET}
      sheetSize={CAT_DECORATION_SHEET_SIZE}
      frame={entry.frame}
      size={size}
    />
  );
}
