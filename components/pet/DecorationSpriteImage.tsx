import { AnimatedFrameSprite } from "@/components/pet/AnimatedFrameSprite";
import { AnimatedStripSprite } from "@/components/pet/AnimatedStripSprite";
import { SheetSprite } from "@/components/pet/SheetSprite";
import {
  CAT_DECORATION_SHEET,
  CAT_DECORATION_SHEET_SIZE,
  getAnimatedFrameSequence,
  getDecorationCatalogEntry,
  isAnimatedDecorationEntry,
  isImageDecorationEntry,
  type CatDecorationId,
} from "@/constants/cat-decorations";
import { Image } from "react-native";

type DecorationSpriteImageProps = {
  decorationId: CatDecorationId;
  size: number;
  flipHorizontal?: boolean;
};

export function DecorationSpriteImage({
  decorationId,
  size,
  flipHorizontal = false,
}: DecorationSpriteImageProps) {
  const entry = getDecorationCatalogEntry(decorationId);
  if (!entry) {
    return null;
  }

  if (isAnimatedDecorationEntry(entry)) {
    if ("frames" in entry) {
      const frames =
        getAnimatedFrameSequence(entry, flipHorizontal) ?? entry.frames;

      return (
        <AnimatedFrameSprite
          frames={frames}
          frameWidth={entry.frameWidth}
          frameHeight={entry.frameHeight}
          fps={entry.fps}
          size={size}
          flipHorizontal={flipHorizontal}
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
    const imageStyle = flipHorizontal
      ? { width: size, height: size, transform: [{ scaleX: -1 as const }] }
      : { width: size, height: size };

    return (
      <Image
        source={entry.source}
        style={imageStyle}
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
      flipHorizontal={flipHorizontal}
    />
  );
}
