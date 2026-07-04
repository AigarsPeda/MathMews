import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

type AnimatedFrameSpriteProps = {
  frames: readonly number[];
  frameWidth: number;
  frameHeight: number;
  fps?: number;
  /** Max rendered width/height — aspect ratio preserved. */
  size: number;
};

/** Cycles through separate frame images (Tiny House multi-file animations). */
export function AnimatedFrameSprite({
  frames,
  frameWidth,
  frameHeight,
  fps = 8,
  size,
}: AnimatedFrameSpriteProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const scale = size / Math.max(frameWidth, frameHeight);
  const displayW = frameWidth * scale;
  const displayH = frameHeight * scale;

  useEffect(() => {
    if (frames.length <= 1) return;

    const interval = setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [frames, fps]);

  if (frames.length === 0) {
    return null;
  }

  return (
    <View style={[styles.cell, { width: displayW, height: displayH }]}>
      <Image
        source={frames[frameIndex]}
        style={{ width: displayW, height: displayH }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
