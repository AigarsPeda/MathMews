import { moderateScale } from "@/utils/scale";
import { createContext, useContext, useRef, type ReactNode } from "react";
import type { StyleProp, ViewProps, ViewStyle } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, type SharedValue, withTiming } from "react-native-reanimated";

const ARRIVAL_DISTANCE = moderateScale(28);

const ArrivalContext = createContext<SharedValue<number> | null>(null);

/** Keep full-width drawings inside their viewport while the question slides in. */
export function useStationaryDrawingStyle() {
  const arrival = useContext(ArrivalContext);
  return useAnimatedStyle(() => ({
    transform: [{ translateX: arrival ? -ARRIVAL_DISTANCE * (1 - arrival.get()) : 0 }],
  }));
}

/** Key by puzzle ID. Start the arrival after layout, without hiding readable content. */
export function PuzzleContentTransition({ children, style, onLayout, slide = true }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onLayout?: ViewProps["onLayout"]; slide?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const arrival = useSharedValue(reduceMotion ? 1 : 0);
  const started = useRef(false);
  const motion = useAnimatedStyle(() => ({
    opacity: 0.85 + 0.15 * arrival.get(),
    transform: [{ translateX: slide ? ARRIVAL_DISTANCE * (1 - arrival.get()) : 0 }],
  }));
  return <Animated.View style={[style, motion]} onLayout={event => {
    onLayout?.(event);
    if (started.current) return;
    started.current = true;
    arrival.set(withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }}><ArrivalContext.Provider value={slide ? arrival : null}>{children}</ArrivalContext.Provider></Animated.View>;
}
