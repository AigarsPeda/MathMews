import { AnimatedStripSprite } from "@/components/pet/AnimatedStripSprite";
import { getCatToySource, isLargeToyId, type CatToyId } from "@/constants/cat-toys";
import { Image } from "expo-image";
export function ToySpriteImage({ toyId, size, still = false }: { toyId: CatToyId; size: number; still?: boolean }) {
  const source = getCatToySource(toyId);
  if (!source) return null;
  if (!isLargeToyId(toyId)) return (
    <AnimatedStripSprite still={still} source={source} sheetWidth={1536} sheetHeight={192}
      frameWidth={192} frameHeight={192} frameCount={8} fps={12} size={size} />
  );
  return <Image source={source} style={{ width: size, height: size }} contentFit="contain" />;
}
