import { PuzzleColors } from "@/constants/puzzle-theme";
import { moderateScale } from "@/utils/scale";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

export function PuzzleProgress({ steps, label, total = steps.length }: { steps: readonly boolean[]; label: string; total?: number }) {
  const completed = Math.min(total, steps.filter(Boolean).length);
  const progress = total > 0 ? completed / total : 0;
  const fill = useSharedValue(progress);
  useEffect(() => {
    fill.set(withTiming(progress, { duration: 420, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }, [progress, fill]);
  const animatedFill = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` as `${number}%` }));
  return <View style={styles.track} accessible accessibilityRole="progressbar" accessibilityLabel={label}
    accessibilityValue={{ min: 0, max: total, now: completed }}>
    <Animated.View style={[styles.fill, animatedFill]}>
      <View style={styles.highlight} />
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  track: { height: moderateScale(16), borderRadius: moderateScale(8), backgroundColor: PuzzleColors.progressTrack, overflow: "hidden" },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: moderateScale(8), backgroundColor: PuzzleColors.progress, overflow: "hidden" },
  highlight: { position: "absolute", top: moderateScale(3), left: moderateScale(5), right: moderateScale(5), height: moderateScale(4), borderRadius: moderateScale(2), backgroundColor: PuzzleColors.progressTop },
});
