import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";

type PetSpeechBubbleProps = {
  message: string;
};

export function PetSpeechBubble({ message }: PetSpeechBubbleProps) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      style={styles.wrap}
      entering={reduceMotion ? undefined : FadeIn.duration(140)}
      exiting={reduceMotion ? undefined : FadeOut.duration(180)}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.bubble}>
        <Text style={styles.text}>{message}</Text>
      </View>
      <View style={styles.tail} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    maxWidth: moderateScale(170),
  },
  bubble: {
    backgroundColor: GameColors.background,
    borderRadius: moderateScale(14),
    paddingVertical: moderateScale(5),
    paddingHorizontal: moderateScale(9),
    borderWidth: 1,
    borderColor: GameColors.cardBorder,
  },
  text: {
    fontSize: moderateScale(13),
    fontWeight: "600",
    color: GameColors.text,
    textAlign: "center",
    lineHeight: moderateScale(18),
  },
  tail: {
    width: moderateScale(10),
    height: moderateScale(10),
    backgroundColor: GameColors.background,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: GameColors.cardBorder,
    transform: [{ rotate: "45deg" }],
    marginTop: moderateScale(-6),
    alignSelf: "flex-start",
    marginLeft: moderateScale(18),
  },
});
