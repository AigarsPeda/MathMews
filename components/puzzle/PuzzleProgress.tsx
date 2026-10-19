import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

function ProgressSegment({ done }: { done: boolean }) {
  const fill = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    fill.set(withTiming(done ? 1 : 0, { duration: 420, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }, [done, fill]);
  const animatedFill = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.get() }] }));
  return <View style={styles.segment}><Animated.View style={[styles.fill, animatedFill]} /></View>;
}

export function PuzzleProgress({ steps, label, total = steps.length }: { steps: readonly boolean[]; label: string; total?: number }) {
  return <View style={styles.row} accessible accessibilityRole="progressbar" accessibilityLabel={label}
    accessibilityValue={{ min: 0, max: total, now: steps.filter(Boolean).length }}>
    {steps.map((done, index) => <ProgressSegment key={index} done={done} />)}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: moderateScale(5), marginBottom: moderateScale(10) },
  segment: { flex: 1, height: moderateScale(6), borderRadius: moderateScale(3), backgroundColor: GameColors.cardBorder, overflow: "hidden" },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: GameColors.success, transformOrigin: "left center" },
});
