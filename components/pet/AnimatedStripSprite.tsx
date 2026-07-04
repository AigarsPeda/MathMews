import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

type AnimatedStripSpriteProps = {
  source: number;
  sheetWidth: number;
  sheetHeight: number;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps?: number;
  /** Max rendered width/height — aspect ratio preserved. */
  size: number;
};

/** Horizontal sprite-strip loop (e.g. room gadgets). */
export function AnimatedStripSprite({
  source,
  sheetWidth,
  sheetHeight,
  frameWidth,
  frameHeight,
  frameCount,
  fps = 8,
  size,
}: AnimatedStripSpriteProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const scale = size / Math.max(frameWidth, frameHeight);
  const displayW = frameWidth * scale;
  const displayH = frameHeight * scale;
  const sheetDisplayW = sheetWidth * scale;
  const sheetDisplayH = sheetHeight * scale;
  const frameX = frameIndex * frameWidth * scale;

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((current) => (current + 1) % frameCount);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [frameCount, fps]);

  return (
    <View style={[styles.cell, { width: displayW, height: displayH }]}>
      <Image
        source={source}
        style={{
          width: sheetDisplayW,
          height: sheetDisplayH,
          position: "absolute",
          left: -frameX,
          top: 0,
        }}
        resizeMode="stretch"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    overflow: "hidden",
  },
});
