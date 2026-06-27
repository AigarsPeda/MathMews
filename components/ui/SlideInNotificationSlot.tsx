import { moderateScale } from "@/utils/scale";
import { type ReactNode, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export const NOTIFICATION_SLOT_HEIGHT = moderateScale(50);
const SHRINK_MS = 280;
const SLIDE_MS = 260;
const SLIDE_OFFSCREEN = moderateScale(400);

type SlideInNotificationSlotProps = {
  visible: boolean;
  children: ReactNode;
  onDismissComplete?: () => void;
};

export function SlideInNotificationSlot({
  visible,
  children,
  onDismissComplete,
}: SlideInNotificationSlotProps) {
  const slotHeight = useSharedValue(0);
  const translateX = useSharedValue(SLIDE_OFFSCREEN);
  const [bannerMounted, setBannerMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setBannerMounted(true);
      translateX.value = SLIDE_OFFSCREEN;
      slotHeight.value = withTiming(
        NOTIFICATION_SLOT_HEIGHT,
        { duration: SHRINK_MS, easing: Easing.out(Easing.cubic) },
        (shrinkDone) => {
          "worklet";
          if (!shrinkDone) return;
          translateX.value = withTiming(0, {
            duration: SLIDE_MS,
            easing: Easing.out(Easing.cubic),
          });
        },
      );
      return;
    }

    if (!bannerMounted) {
      slotHeight.value = 0;
      return;
    }

    translateX.value = withTiming(
      SLIDE_OFFSCREEN,
      { duration: SLIDE_MS, easing: Easing.in(Easing.cubic) },
      (slideOutDone) => {
        "worklet";
        if (!slideOutDone) return;
        slotHeight.value = withTiming(
          0,
          { duration: SHRINK_MS, easing: Easing.inOut(Easing.cubic) },
          (collapseDone) => {
            "worklet";
            if (!collapseDone) return;
            runOnJS(setBannerMounted)(false);
            if (onDismissComplete) {
              runOnJS(onDismissComplete)();
            }
          },
        );
      },
    );
  }, [bannerMounted, onDismissComplete, slotHeight, translateX, visible]);

  const slotStyle = useAnimatedStyle(() => ({
    height: slotHeight.value,
  }));

  const bannerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[styles.slot, slotStyle]}>
      {bannerMounted ? (
        <Animated.View style={[styles.bannerWrap, bannerStyle]}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: {
    overflow: "hidden",
    justifyContent: "center",
  },
  bannerWrap: {
    width: "100%",
  },
});
