import { PuzzleColors } from "@/constants/puzzle-theme";
import { moderateScale } from "@/utils/scale";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

const BADGE = moderateScale(24);
const RAIL = moderateScale(12);
const SLIM_RAIL = moderateScale(8);
const timing = (duration: number) => ({ duration, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System });

/**
 * Lesson progress as a Berry rail with one notch per step. The regular size carries a paw
 * badge on the fill's front edge, which lands exactly on a notch after each solved step.
 */
export function PuzzleProgress({ steps, label, total = steps.length, size = "regular", animated = true }: {
  steps: readonly boolean[]; label: string; total?: number; size?: "regular" | "slim"; animated?: boolean;
}) {
  const completed = Math.min(total, steps.filter(Boolean).length);
  const progress = total > 0 ? completed / total : 0;
  const slim = size === "slim";
  const inset = slim ? 0 : BADGE / 2;
  const [width, setWidth] = useState(0);
  const fill = useSharedValue(progress);
  const pop = useSharedValue(1);
  const previous = useRef(completed);
  useEffect(() => {
    if (!animated) { fill.set(progress); return; }
    fill.set(withTiming(progress, timing(420)));
    if (completed > previous.current) pop.set(withSequence(withTiming(1.18, timing(160)), withTiming(1, timing(220))));
    previous.current = completed;
  }, [progress, completed, fill, pop, animated]);
  // Both layers slide at a fixed size so the rail never relayouts mid-animation.
  const travel = Math.max(0, width - inset * 2);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: inset + fill.get() * travel - width }] }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: fill.get() * travel }, { scale: pop.get() }] }));
  return <View style={slim ? styles.slimFrame : styles.frame} accessible accessibilityRole="progressbar" accessibilityLabel={label}
    accessibilityValue={{ min: 0, max: total, now: completed }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <View pointerEvents="none" style={[styles.rail, slim && styles.slimRail]}>
      {width > 0 ? <Animated.View style={[styles.fill, { width }, fillStyle]} /> : null}
      {width > 0 && total > 1 ? Array.from({ length: total - 1 }, (_, index) =>
        <View key={index} style={[styles.tick, slim && styles.slimTick, { left: inset + travel * (index + 1) / total - 1 }]} />) : null}
    </View>
    {!slim && width > 0 ? <Animated.View pointerEvents="none" style={[styles.badge, badgeStyle]}><PawMark size={moderateScale(15)} /></Animated.View> : null}
  </View>;
}

/** A flat paw print built from ellipses on a 24-unit grid so it stays crisp at any scale. */
function PawMark({ size }: { size: number }) {
  const u = size / 24;
  const blob = (cx: number, cy: number, rx: number, ry: number) =>
    ({ left: (cx - rx) * u, top: (cy - ry) * u, width: rx * 2 * u, height: ry * 2 * u, borderRadius: Math.max(rx, ry) * u });
  return <View style={{ width: size, height: size }}>
    {[blob(12, 16, 6.2, 5.2), blob(5, 9.5, 2.3, 2.9), blob(9.3, 5.4, 2.3, 3), blob(14.7, 5.4, 2.3, 3), blob(19, 9.5, 2.3, 2.9)]
      .map((shape, index) => <View key={index} style={[styles.pawPart, shape]} />)}
  </View>;
}

const styles = StyleSheet.create({
  frame: { height: BADGE, justifyContent: "center" },
  slimFrame: { height: SLIM_RAIL, justifyContent: "center" },
  rail: { height: RAIL, borderRadius: RAIL / 2, backgroundColor: PuzzleColors.progressRail, overflow: "hidden" },
  slimRail: { height: SLIM_RAIL, borderRadius: SLIM_RAIL / 2 },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: RAIL / 2, backgroundColor: PuzzleColors.progress },
  tick: { position: "absolute", top: moderateScale(3), bottom: moderateScale(3), width: 2, borderRadius: 1, backgroundColor: PuzzleColors.progressTick },
  slimTick: { top: moderateScale(2), bottom: moderateScale(2) },
  badge: { position: "absolute", left: 0, width: BADGE, height: BADGE, borderRadius: BADGE / 2, borderWidth: moderateScale(2.5),
    borderColor: PuzzleColors.progress, backgroundColor: PuzzleColors.background, alignItems: "center", justifyContent: "center" },
  pawPart: { position: "absolute", backgroundColor: PuzzleColors.progress },
});
