import { useEffect, type ComponentProps, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

/** Keep controls mounted for their fade without moving the room's viewport. */
export function RoomControlsTransition({ visible, children, style, offsetY = 0, instant = false, layout }: {
  visible: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  offsetY?: number;
  instant?: boolean;
  layout?: ComponentProps<typeof Animated.View>["layout"];
}) {
  const progress = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    progress.set(instant ? Number(visible) : withTiming(Number(visible), {
      duration: 220, easing: Easing.out(Easing.cubic),
    }));
  }, [visible, instant, progress]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * offsetY }],
  }));
  return <Animated.View style={[style, animatedStyle]} collapsable={false} layout={instant ? undefined : layout}
    pointerEvents={visible ? "box-none" : "none"}
    accessibilityElementsHidden={!visible}
    importantForAccessibility={visible ? "auto" : "no-hide-descendants"}>
    {children}
  </Animated.View>;
}
