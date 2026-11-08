import { moderateScale } from "@/utils/scale";
import { useRef, type ReactNode } from "react";
import type { StyleProp, ViewProps, ViewStyle } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

const ARRIVAL_DISTANCE = moderateScale(28);

/** Key by puzzle ID. Start the arrival after layout, without hiding readable content. */
export function PuzzleContentTransition({ children, style, onLayout }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onLayout?: ViewProps["onLayout"];
}) {
  const reduceMotion = useReducedMotion();
  const arrival = useSharedValue(reduceMotion ? 1 : 0);
  const started = useRef(false);
  const motion = useAnimatedStyle(() => ({
    opacity: 0.85 + 0.15 * arrival.get(),
    transform: [{ translateX: ARRIVAL_DISTANCE * (1 - arrival.get()) }],
  }));
  return <Animated.View style={[style, motion]} onLayout={event => {
    onLayout?.(event);
    if (started.current) return;
    started.current = true;
    arrival.set(withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }}>{children}</Animated.View>;
}
