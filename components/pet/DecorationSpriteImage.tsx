import { RoomDecorationMotion } from "@/components/pet/RoomDecorationMotion";
import { isAirConditionerDecorationId, PLANT_FOLIAGE_SPLIT } from "@/constants/decoration-motion";
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
  roomMotion?: boolean;
  poweredOn?: boolean;
  breezy?: boolean;
};

export function DecorationSpriteImage({
  decorationId,
  size,
  flipHorizontal = false,
  roomMotion = false,
  poweredOn = false,
  breezy = false,
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
    if (roomMotion && (isAirConditionerDecorationId(decorationId) || PLANT_FOLIAGE_SPLIT[decorationId] !== undefined)) {
      return <RoomDecorationMotion decorationId={decorationId} source={entry.source}
        size={size} flipHorizontal={flipHorizontal} poweredOn={poweredOn} breezy={breezy} />;
    }
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
