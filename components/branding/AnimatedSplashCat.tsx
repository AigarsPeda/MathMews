import { NativeCatDisplay } from "@/components/pet/native/NativeCatDisplay";
import { catModelRegistry } from "@/pet-display/registry/cat-model-registry";
import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

/** The startup cat uses the same native rig as the room and care screens. */
export function AnimatedSplashCat({ size = moderateScale(192), playing = true, onReady }: {
  size?: number; playing?: boolean; onReady?: () => void;
}) {
  const frames = useRef<number[]>([]);
  useEffect(() => () => { frames.current.forEach(cancelAnimationFrame); }, []);
  const ready = useCallback(() => {
    frames.current.push(requestAnimationFrame(() => {
      frames.current.push(requestAnimationFrame(() => onReady?.()));
    }));
  }, [onReady]);
  const playback = useMemo(() => ({ kind: "segment" as const, mood: "idle" as const,
    segment: catModelRegistry.getSegment("idle") }), []);
  return <NativeCatDisplay width={size} playback={playback} loop playing={playing} onReady={ready} />;
}

const styles = StyleSheet.create({
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
