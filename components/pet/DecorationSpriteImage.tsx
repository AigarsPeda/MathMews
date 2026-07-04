import { AnimatedFrameSprite } from "@/components/pet/AnimatedFrameSprite";
import { AnimatedStripSprite } from "@/components/pet/AnimatedStripSprite";
import { SheetSprite } from "@/components/pet/SheetSprite";
import {
  CAT_DECORATION_SHEET,
  CAT_DECORATION_SHEET_SIZE,
  getDecorationCatalogEntry,
  isAnimatedDecorationEntry,
  isImageDecorationEntry,
  type CatDecorationId,
} from "@/constants/cat-decorations";
import { Image } from "react-native";

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

  if (isAnimatedDecorationEntry(entry)) {
    if ("frames" in entry) {
      return (
        <AnimatedFrameSprite
          frames={entry.frames}
          frameWidth={entry.frameWidth}
          frameHeight={entry.frameHeight}
          fps={entry.fps}
          size={size}
        />
      );
    }

    return (
      <AnimatedStripSprite
        source={entry.source}
        sheetWidth={entry.sheetWidth}
        sheetHeight={entry.sheetHeight}
        frameWidth={entry.frameWidth}
        frameHeight={entry.frameHeight}
        frameCount={entry.frameCount}
        fps={entry.fps}
        size={size}
      />
    );
  }

  if (isImageDecorationEntry(entry)) {
    return (
      <Image
        source={entry.source}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    );
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
