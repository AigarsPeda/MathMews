import { isAirConditionerDecorationId, PLANT_FOLIAGE_SPLIT } from "@/constants/decoration-motion";
import type { CatDecorationId } from "@/constants/cat-decorations";
import { useSpriteActivity } from "@/pet-display/media/sprite/use-sprite-clock";
import { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

function AirStream({ phase, lane, size, reduceMotion }: {
  phase: SharedValue<number>; lane: number; size: number; reduceMotion: boolean;
}) {
  const motion = useAnimatedStyle(() => {
    const progress = reduceMotion ? 0.4 : (phase.get() * 3 + lane / 3) % 1;
    return {
      opacity: reduceMotion ? 0.45 : Math.sin(progress * Math.PI) * 0.72,
      transform: [
        { translateX: -progress * size * 0.25 },
        { translateY: progress * size * 0.55 },
        { rotate: "28deg" },
      ],
    };
  });
  return <Animated.View style={[styles.airStream, {
    left: size * (0.3 + lane * 0.15),
    top: size * (0.43 + lane * 0.075),
    width: Math.max(1, size * 0.018),
    height: size * 0.25,
    borderRadius: size * 0.02,
  }, motion]} />;
}

/** Animate the foliage separately so the pot stays planted on the floor. */
export function RoomDecorationMotion({ decorationId, source, size, flipHorizontal,
  poweredOn = false, breezy = false }: {
  decorationId: CatDecorationId; source: number; size: number;
  flipHorizontal: boolean; poweredOn?: boolean; breezy?: boolean;
}) {
  const { active, reduceMotion } = useSpriteActivity();
  const phase = useSharedValue(0);
  const foliageSplit = PLANT_FOLIAGE_SPLIT[decorationId];
  const airConditioner = isAirConditionerDecorationId(decorationId);
  const running = active && !reduceMotion && (foliageSplit !== undefined || poweredOn);
  useEffect(() => {
    if (running) {
      phase.set(withRepeat(withTiming(1, { duration: 4200, easing: Easing.linear }), -1));
    } else {
      cancelAnimation(phase);
      phase.set(0);
    }
    return () => cancelAnimation(phase);
  }, [phase, running]);
  const foliageMotion = useAnimatedStyle(() => ({
    transform: [{ skewX: `${Math.sin(phase.get() * Math.PI * 2) * (breezy ? 2 : 0.8)}deg` }],
  }));
  const imageStyle = { width: size, height: size };
  const splitY = size * (foliageSplit ?? 0);
  return (
    <View pointerEvents="none" style={{ ...imageStyle, transform: [{ scaleX: flipHorizontal ? -1 : 1 }] }}>
      {foliageSplit !== undefined ? <>
        <Animated.View style={[styles.foliage, { width: size, height: splitY }, foliageMotion]}>
          <Image source={source} style={imageStyle} resizeMode="contain" accessibilityIgnoresInvertColors />
        </Animated.View>
        <View style={{ top: splitY, width: size, height: size - splitY, overflow: "hidden" }}>
          <Image source={source} style={[imageStyle, { top: -splitY }]} resizeMode="contain" accessibilityIgnoresInvertColors />
        </View>
      </> : <Image source={source} style={imageStyle} resizeMode="contain" accessibilityIgnoresInvertColors />}
      {airConditioner && poweredOn ? <>
        {[0, 1, 2].map(lane => <AirStream key={lane} phase={phase} lane={lane} size={size} reduceMotion={reduceMotion} />)}
        <View style={[styles.powerLight, { left: size * 0.76, top: size * 0.66,
          width: Math.max(2, size * 0.025), height: Math.max(2, size * 0.015) }]} />
      </> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  foliage: { position: "absolute", overflow: "hidden", transformOrigin: "center bottom" },
  airStream: { position: "absolute", backgroundColor: "#87B9C9" },
  powerLight: { position: "absolute", backgroundColor: "#52A875", borderRadius: 2 },
});
