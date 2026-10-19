import { GameColors } from "@/constants/game";
import { PuzzleCatPortrait } from "@/components/puzzle/PuzzleCatPortrait";
import type { PuzzleCatReaction } from "@/constants/puzzle-cat-reactions";
import type { PetAnimationState, PetType } from "@/types/game";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";

type Props = { petType: PetType; catSkinId?: string; petName: string; mood: PetAnimationState; reaction?: PuzzleCatReaction; message: string; portraitSize?: number };

export function PuzzleCatCompanion({ petType, catSkinId, petName, mood, reaction, message, portraitSize = 180 }: Props) {
  const { t } = useTranslation();
  return <View style={styles.wrap}>
    <Animated.View entering={FadeIn.duration(160).reduceMotion(ReduceMotion.System)}
      accessible accessibilityRole="text" accessibilityLiveRegion="polite"
      accessibilityLabel={t("puzzleCompanion.says", { name: petName, message })} style={styles.speech}>
      <Text style={styles.name} numberOfLines={2}>{petName}</Text>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.tail} />
    </Animated.View>
    <PuzzleCatPortrait petType={petType} catSkinId={catSkinId} mood={mood} reaction={reaction} size={portraitSize} />
  </View>;
}

const styles = StyleSheet.create({
  wrap: { width: "100%", alignItems: "center" },
  speech: { width: "100%", padding: moderateScale(16), borderRadius: moderateScale(16), backgroundColor: GameColors.card, borderWidth: 1, borderColor: GameColors.cardBorder, gap: moderateScale(6), marginBottom: moderateScale(10) },
  name: { color: GameColors.secondaryDark, fontSize: moderateScale(14), fontWeight: "800", textAlign: "center" },
  message: { color: GameColors.text, fontSize: moderateScale(20), fontWeight: "700", lineHeight: moderateScale(28), textAlign: "center" },
  tail: { position: "absolute", alignSelf: "center", bottom: moderateScale(-7), width: moderateScale(14), height: moderateScale(14), backgroundColor: GameColors.card, borderRightWidth: 1, borderBottomWidth: 1, borderColor: GameColors.cardBorder, transform: [{ rotate: "45deg" }] },
});
