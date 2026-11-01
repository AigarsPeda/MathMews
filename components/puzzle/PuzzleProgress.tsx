import { PuzzleColors, TopicPathColors } from "@/constants/puzzle-theme";
import { moderateScale } from "@/utils/scale";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

export function PuzzleProgress({ steps, label, total = steps.length, size = "regular", variant = "puzzle" }: {
  steps: readonly boolean[]; label: string; total?: number; size?: "regular" | "slim"; variant?: "puzzle" | "trail";
}) {
  const completed = Math.min(total, steps.filter(Boolean).length);
  const progress = total > 0 ? completed / total : 0;
  const fill = useSharedValue(progress);
  useEffect(() => {
    fill.set(withTiming(progress, { duration: 420, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }, [progress, fill]);
  const animatedFill = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` as `${number}%` }));
  return <View style={[styles.track, size === "slim" && styles.slimTrack, variant === "trail" && styles.trailTrack]} accessible accessibilityRole="progressbar" accessibilityLabel={label}
    accessibilityValue={{ min: 0, max: total, now: completed }}>
    <Animated.View style={[styles.fill, size === "slim" && styles.slimFill, variant === "trail" && styles.trailFill, animatedFill]}>
      {variant === "puzzle" ? <View style={[styles.highlight, size === "slim" && styles.slimHighlight]} /> : null}
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  track: { height: moderateScale(16), borderRadius: moderateScale(8), backgroundColor: PuzzleColors.progressTrack, overflow: "hidden" },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: moderateScale(8), backgroundColor: PuzzleColors.progress, overflow: "hidden" },
  highlight: { position: "absolute", top: moderateScale(3), left: moderateScale(5), right: moderateScale(5), height: moderateScale(4), borderRadius: moderateScale(2), backgroundColor: PuzzleColors.progressTop },
  slimTrack: { height: moderateScale(8), borderRadius: moderateScale(4) },
  slimFill: { borderRadius: moderateScale(4) },
  slimHighlight: { top: moderateScale(1), left: moderateScale(3), right: moderateScale(3), height: moderateScale(2), borderRadius: moderateScale(1) },
  trailTrack: { height: 6, borderRadius: 3, backgroundColor: TopicPathColors.progressTrack },
  trailFill: { borderRadius: 3, backgroundColor: TopicPathColors.progress },
});
