import { CAT_SPRITE_CATALOG } from "@/constants/cat-sprite-catalog";
import { CAT_SKIN_SHEET, CAT_SKIN_SOURCES } from "@/constants/cat-skins";
import { CAT_SPRITE_FRAME_HEIGHT } from "@/constants/cat-sprites";
import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import {
  Canvas,
  FilterMode,
  Group,
  MipmapMode,
  Image as SkiaImage,
  useImage,
} from "@shopify/react-native-skia";
import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

const IDLE = CAT_SPRITE_CATALOG.idle;
const SHEET_SOURCE = CAT_SKIN_SOURCES.orange;
const FRAME_SIZE = CAT_SPRITE_FRAME_HEIGHT;
const FPS = IDLE.fps;

const NEAREST_SAMPLING = {
  filter: FilterMode.Nearest,
  mipmap: MipmapMode.None,
};

type AnimatedSplashCatProps = {
  size?: number;
};

function useSplashLayout(size: number) {
  const pixelScale = Math.max(4, Math.floor(size / FRAME_SIZE));
  const displaySize = FRAME_SIZE * pixelScale;
  const scaledSheetWidth = CAT_SKIN_SHEET.width * pixelScale;
  const scaledSheetHeight = CAT_SKIN_SHEET.height * pixelScale;

  return { pixelScale, displaySize, scaledSheetWidth, scaledSheetHeight };
}

/** Crisp pixel-art idle loop from the orange skin pack. */
export function AnimatedSplashCat({
  size = moderateScale(192),
}: AnimatedSplashCatProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const skiaImage = useImage(SHEET_SOURCE);
  const { pixelScale, displaySize, scaledSheetWidth, scaledSheetHeight } =
    useSplashLayout(size);
  const imageX = -frameIndex * FRAME_SIZE * pixelScale;
  const imageY = -IDLE.row * FRAME_SIZE * pixelScale;

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((current) => (current + 1) % IDLE.frameCount);
    }, 1000 / FPS);

    return () => clearInterval(interval);
  }, []);

  const windowStyle = {
    width: displaySize,
    height: displaySize,
    overflow: "hidden" as const,
  };

  if (!skiaImage) {
    return <View style={[styles.wrap, windowStyle]} />;
  }

  return (
    <View style={[styles.wrap, windowStyle]}>
      <Canvas style={{ width: displaySize, height: displaySize }}>
        <Group clip={{ x: 0, y: 0, width: displaySize, height: displaySize }}>
          <SkiaImage
            image={skiaImage}
            x={imageX}
            y={imageY}
            width={scaledSheetWidth}
            height={scaledSheetHeight}
            fit="fill"
            sampling={NEAREST_SAMPLING}
          />
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "flex-start",
    justifyContent: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GameColors.background,
    zIndex: 100,
  },
});

export function SplashBackdrop({ children }: { children: ReactNode }) {
  return <View style={styles.backdrop}>{children}</View>;
}
