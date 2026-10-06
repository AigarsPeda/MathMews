import { Canvas, Group, Image as SkiaImage, useImage } from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";
import { View } from "react-native";
import { useSpriteClock } from "@/hooks/use-sprite-clock";

type AnimatedStripSpriteProps = {
  source: number; flipHorizontal?: boolean; sheetWidth: number; sheetHeight: number;
  frameWidth: number; frameHeight: number; frameCount: number; fps?: number; size: number;
};

/** UI thumbnails use image coordinates, with no timer or layout per frame. */
export function AnimatedStripSprite({ source, flipHorizontal = false, sheetWidth,
  sheetHeight, frameWidth, frameHeight, frameCount, fps = 8, size }: AnimatedStripSpriteProps) {
  const image = useImage(source);
  const frame = useSpriteClock({ frameCount, fps, ready: !!image });
  const scale = size / Math.max(frameWidth, frameHeight);
  const width = frameWidth * scale, height = frameHeight * scale;
  const x = useDerivedValue(() => -frame.value * width);
  return (
    <View style={{ width, height, transform: [{ scaleX: flipHorizontal ? -1 : 1 }] }}>
      <Canvas style={{ width, height }}>
        {image ? <Group clip={{ x: 0, y: 0, width, height }}>
          <SkiaImage image={image} x={x} y={0} width={sheetWidth * scale} height={sheetHeight * scale} fit="fill" />
        </Group> : null}
      </Canvas>
    </View>
  );
}
