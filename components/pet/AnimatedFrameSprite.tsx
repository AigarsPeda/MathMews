import { useIsMounted } from "@/hooks/use-is-mounted";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

type AnimatedFrameSpriteProps = {
  frames: readonly number[];
  frameWidth: number;
  frameHeight: number;
  fps?: number;
  /** Max rendered width/height — aspect ratio preserved. */
  size: number;
  flipHorizontal?: boolean;
};

/** Cycles through separate frame images (Tiny House multi-file animations). */
export function AnimatedFrameSprite({
  frames,
  frameWidth,
  frameHeight,
  fps = 8,
  size,
  flipHorizontal = false,
}: AnimatedFrameSpriteProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const isMounted = useIsMounted();

  const scale = size / Math.max(frameWidth, frameHeight);
  const displayW = frameWidth * scale;
  const displayH = frameHeight * scale;

  useEffect(() => {
    setFrameIndex(0);
    if (frames.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      if (!isMounted.current) {
        return;
      }
      setFrameIndex((current) => (current + 1) % frames.length);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [frames, fps, isMounted]);

  if (frames.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.cell,
        {
          width: displayW,
          height: displayH,
          transform: flipHorizontal ? [{ scaleX: -1 as const }] : undefined,
        },
      ]}
    >
      <Image
        source={frames[frameIndex]}
        cachePolicy="memory-disk"
        transition={0}
        style={{ width: displayW, height: displayH }}
        contentFit="contain"
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
