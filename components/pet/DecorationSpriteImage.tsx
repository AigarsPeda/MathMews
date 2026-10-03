import { AnimatedStripSprite } from "@/components/pet/AnimatedStripSprite";
import {
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
        flipHorizontal={flipHorizontal}
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

  return null;
}
