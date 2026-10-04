import { CAT_SKIN_SHEET, CAT_SKIN_SOURCES } from "@/constants/cat-skins";
import { CAT_SPRITE_CATALOG } from "@/constants/cat-sprite-catalog";
import { useSpriteClock } from "@/pet-display/media/sprite/use-sprite-clock";
import { useDerivedValue } from "react-native-reanimated";
import { GameColors } from "@/constants/game";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { moderateScale } from "@/utils/scale";
import {
  Canvas,
  FilterMode,
  Group,
  MipmapMode,
  Image as SkiaImage,
  useImage,
} from "@shopify/react-native-skia";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

const IDLE = CAT_SPRITE_CATALOG.idle;
const SHEET_SOURCE = CAT_SKIN_SOURCES.orange;
const FRAME_SIZE = CAT_SKIN_SHEET.frameSize;
const FPS = IDLE.fps;

const SMOOTH_SAMPLING = {
  filter: FilterMode.Linear,
  mipmap: MipmapMode.None,
};

type AnimatedSplashCatProps = {
  size?: number;
  playing?: boolean;
  onReady?: () => void;
};

function useSplashLayout(size: number) {
  const pixelScale = size / FRAME_SIZE;
  const displaySize = FRAME_SIZE * pixelScale;
  const scaledSheetWidth = CAT_SKIN_SHEET.width * pixelScale;
  const scaledSheetHeight = CAT_SKIN_SHEET.height * pixelScale;

  return { pixelScale, displaySize, scaledSheetWidth, scaledSheetHeight };
}

/** Smooth breathing and blinking from the Blender cat. */
export function AnimatedSplashCat({
  size = moderateScale(192),
  playing = true,
  onReady,
}: AnimatedSplashCatProps) {
  const skiaImage = useImage(SHEET_SOURCE);
  const frameIndex = useSpriteClock({ frameCount: IDLE.frameCount, fps: FPS, loop: true, readyPages: skiaImage && playing ? [0] : [] });
  const isMounted = useIsMounted();
  const [windowLaidOut, setWindowLaidOut] = useState(false);
  const handleWindowLayout = useCallback(() => setWindowLaidOut(true), []);
  const { pixelScale, displaySize, scaledSheetWidth, scaledSheetHeight } =
    useSplashLayout(size);

  const imageX = useDerivedValue(() => -(frameIndex.get() % CAT_SKIN_SHEET.cols) * FRAME_SIZE * pixelScale);
  const imageY = useDerivedValue(() => -Math.floor(frameIndex.get() / CAT_SKIN_SHEET.cols) * FRAME_SIZE * pixelScale);

  useEffect(() => {
    if (!skiaImage || !windowLaidOut) return;
    // Decoding alone does not mean the Canvas has painted. Hold frame zero
    // beneath the portrait until the laid-out surface gets a drawing turn.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (isMounted.current) onReady?.();
      });
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, [isMounted, onReady, skiaImage, windowLaidOut]);

  const windowStyle = {
    width: displaySize,
    height: displaySize,
    overflow: "hidden" as const,
  };

  if (!skiaImage) {
    return <View onLayout={handleWindowLayout} style={[styles.wrap, windowStyle]} />;
  }

  return (
    <View onLayout={handleWindowLayout} style={[styles.wrap, windowStyle]}>
      <Canvas colorSpace="srgb" style={{ width: displaySize, height: displaySize }}>
        <Group clip={{ x: 0, y: 0, width: displaySize, height: displaySize }}>
          <SkiaImage
            x={imageX}
            y={imageY}
            fit="fill"
            image={skiaImage}
            width={scaledSheetWidth}
            height={scaledSheetHeight}
            sampling={SMOOTH_SAMPLING}
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GameColors.background,
  },
});

export function SplashBackdrop({
  children,
  onLayout,
}: {
  children: ReactNode;
  onLayout?: () => void;
}) {
  return (
    <View style={styles.backdrop} onLayout={onLayout}>
      {children}
    </View>
  );
}
