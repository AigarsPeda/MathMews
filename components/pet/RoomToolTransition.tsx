import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { Easing, FadeInDown, FadeOut, LayoutAnimationConfig, LinearTransition, ReduceMotion, useReducedMotion } from "react-native-reanimated";

const TOOL_ENTER = FadeInDown.duration(180).easing(Easing.out(Easing.cubic))
  .withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] }).reduceMotion(ReduceMotion.System);
const TOOL_EXIT = FadeOut.duration(100).reduceMotion(ReduceMotion.System);
export const ROOM_TOOL_LAYOUT = LinearTransition.duration(180).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);

/** Animate tool replacements, skipping nested entrance/exit animations on mount. */
export function RoomToolTransition({ panelKey, children, style }: {
  panelKey: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  return <LayoutAnimationConfig skipEntering skipExiting>
    <Animated.View key={panelKey} collapsable={false} style={style}
      entering={reduceMotion ? undefined : TOOL_ENTER} exiting={reduceMotion ? undefined : TOOL_EXIT}>
      {children}
    </Animated.View>
  </LayoutAnimationConfig>;
}
