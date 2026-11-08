import { PuzzleColors, TopicPathColors } from "@/constants/puzzle-theme";
import { moderateScale } from "@/utils/scale";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

export function PuzzleProgress({ steps, label, total = steps.length, size = "regular", variant = "puzzle", animated = true }: {
  steps: readonly boolean[]; label: string; total?: number; size?: "regular" | "slim"; variant?: "puzzle" | "trail"; animated?: boolean;
}) {
  const completed = Math.min(total, steps.filter(Boolean).length);
  const progress = total > 0 ? completed / total : 0;
  const [width, setWidth] = useState(0);
  const fill = useSharedValue(progress);
  useEffect(() => {
    if (animated) fill.set(withTiming(progress, { duration: 420, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
    else fill.set(progress);
  }, [progress, fill, animated]);
  // Slide fixed-size materials through the rounded track. Neither layer relayouts
  // during the animation, and the end cap and highlight keep their original shape.
  const animatedFill = useAnimatedStyle(() => ({ transform: [{ translateX: (fill.get() - 1) * width }] }));
  const animatedHighlight = useAnimatedStyle(() => ({ transform: [{ translateX: (fill.get() - 1) * width }] }));
  return <View style={[styles.track, size === "slim" && styles.slimTrack, variant === "trail" && styles.trailTrack]} accessible accessibilityRole="progressbar" accessibilityLabel={label}
    onLayout={event => setWidth(event.nativeEvent.layout.width)}
    accessibilityValue={{ min: 0, max: total, now: completed }}>
    {animated && width > 0 ? <>
      <Animated.View pointerEvents="none" style={[styles.fill, styles.fullWidth, size === "slim" && styles.slimFill, variant === "trail" && styles.trailFill, animatedFill]} />
      {variant === "puzzle" ? <View pointerEvents="none" style={[styles.highlight, size === "slim" && styles.slimHighlight]}>
        <Animated.View style={[styles.highlightMaterial, animatedHighlight]} />
      </View> : null}
    </> : <View style={[styles.fill, size === "slim" && styles.slimFill, variant === "trail" && styles.trailFill, { width: `${progress * 100}%` }]}>
      {/* Saved progress is correct even before the track's first layout event. */}
      {variant === "puzzle" ? <View style={[styles.highlight, styles.highlightColor, size === "slim" && styles.slimHighlight]} /> : null}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  track: { height: moderateScale(16), borderRadius: moderateScale(8), backgroundColor: PuzzleColors.progressTrack, overflow: "hidden" },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: moderateScale(8), backgroundColor: PuzzleColors.progress, overflow: "hidden" },
  fullWidth: { right: 0 },
  highlight: { position: "absolute", top: moderateScale(3), left: moderateScale(5), right: moderateScale(5), height: moderateScale(4), borderRadius: moderateScale(2), overflow: "hidden" },
  highlightColor: { backgroundColor: PuzzleColors.progressTop },
  highlightMaterial: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: moderateScale(2), backgroundColor: PuzzleColors.progressTop },
  slimTrack: { height: moderateScale(8), borderRadius: moderateScale(4) },
  slimFill: { borderRadius: moderateScale(4) },
  slimHighlight: { top: moderateScale(1), left: moderateScale(3), right: moderateScale(3), height: moderateScale(2), borderRadius: moderateScale(1) },
  trailTrack: { height: 6, borderRadius: 3, backgroundColor: TopicPathColors.progressTrack },
  trailFill: { borderRadius: 3, backgroundColor: TopicPathColors.progress },
});
