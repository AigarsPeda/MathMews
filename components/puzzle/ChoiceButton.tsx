import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { ResultMark } from "@/components/puzzle/kit/PuzzleKit";
import { useTranslation } from "react-i18next";
import { Ink, ProofMotion, PuzzleColors as GameColors, Shape } from "@/constants/puzzle-theme";
import { moderateScale } from "@/utils/scale";
import { PressFace } from "./kit/PressFace";
import { landTick } from "./kit/proofHaptics";
import { Pressable, StyleSheet, View, type GestureResponderEvent, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import Animated, { FadeIn, Keyframe, ReduceMotion, useReducedMotion } from "react-native-reanimated";

const correctFacePop = new Keyframe({
  0: { transform: [{ scale: 1 }] },
  65: { transform: [{ scale: 1.03 }] },
  100: { transform: [{ scale: 1 }] },
}).duration(ProofMotion.beat[200]);
const correctMarkPop = new Keyframe({
  0: { transform: [{ scale: 0.6 }] },
  65: { transform: [{ scale: 1.08 }] },
  100: { transform: [{ scale: 1 }] },
}).duration(ProofMotion.beat[200]);
const resultFade = FadeIn.duration(ProofMotion.fade).reduceMotion(ReduceMotion.Never);

type ChoiceButtonProps = {
  label: string;
  /** Spoken answer when the visible label is a formatted form of it. */
  accessibilityAnswer?: string;
  /** Use the width of a checked answer chip for large localized text. */
  fitSubmission?: boolean;
  /** Fit a short mathematical answer as one native text line. */
  fitLabel?: boolean;
  selected: boolean;
  disabled: boolean;
  result?: "correct" | "wrong" | null;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  onPress: (event: GestureResponderEvent) => void;
};

/**
 * The shared answer card. Press collapses the lip; selection uses a berry tint;
 * a checked answer shows a check or cross while the hit frame stays fixed.
 */
export function ChoiceButton({
  label,
  accessibilityAnswer,
  fitSubmission = false,
  fitLabel = false,
  selected,
  disabled,
  result = null,
  style,
  labelStyle,
  onPress,
}: ChoiceButtonProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const showCorrect = result === "correct";
  const showWrong = result === "wrong";
  const surface = showCorrect ? styles.buttonCorrect : showWrong ? styles.buttonWrong : selected ? styles.buttonSelected : styles.buttonIdle;
  const textStyle = [styles.label, labelStyle, selected && !result && styles.labelSelected, showCorrect && styles.labelCorrect, showWrong && styles.labelWrong];
  return (
    <Pressable style={[styles.button, fitSubmission && styles.submissionPadding, style]}
      onPress={event => { landTick(); onPress(event); }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t("play.answerLabel", { answer: accessibilityAnswer ?? label })}
      accessibilityValue={result ? { text: t(showCorrect ? "play.answerCorrect" : "play.answerWrong") } : undefined}
      accessibilityState={{ disabled, selected }}
    >
      {({ pressed }) => <>
        <Animated.View key={showCorrect ? "correct-face" : "face"} pointerEvents="none" style={StyleSheet.absoluteFill}
          entering={showCorrect && !reducedMotion ? correctFacePop : undefined}>
          <PressFace pressed={pressed && !disabled} fill={surface.backgroundColor} edge={surface.borderColor}
            radius={Shape.card(64)} raised={!disabled} />
        </Animated.View>
        <View style={[styles.content, fitSubmission && styles.submissionContent]}>
          {fitSubmission ? <View style={styles.answerWords}>
            {label.trim().split(/\s+/u).map((word, index) => <Text key={index} style={[textStyle, styles.answerWord]}
              numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} android_hyphenationFrequency="none">{word}</Text>)}
          </View> : <Text style={textStyle} numberOfLines={fitLabel ? 1 : undefined}
            adjustsFontSizeToFit={fitLabel} minimumFontScale={fitLabel ? .5 : undefined}>{label}</Text>}
          {result ? <Animated.View key={result} entering={showCorrect && !reducedMotion ? correctMarkPop : resultFade}>
            <ResultMark kind={result} size={fitSubmission ? 14 : moderateScale(16)} />
          </Animated.View> : null}
        </View>
      </>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "stretch",
    minHeight: moderateScale(64),
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(16),
  },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: moderateScale(6), flexShrink: 1 },
  answerWords: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", columnGap: 7, minWidth: 0, flex: 1 },
  answerWord: { maxWidth: "100%", flexShrink: 0 },
  submissionPadding: { paddingHorizontal: 4 },
  submissionContent: { alignSelf: "stretch", gap: 4 },
  buttonIdle: { borderColor: Ink.trayEdge, backgroundColor: Ink.tray },
  buttonSelected: {
    borderColor: GameColors.secondary,
    backgroundColor: GameColors.selectedSurface,
  },
  buttonCorrect: {
    borderColor: GameColors.success,
    backgroundColor: GameColors.successSurface,
  },
  buttonWrong: {
    borderColor: GameColors.incorrect,
    backgroundColor: GameColors.incorrectSurface,
  },
  label: {
    flexShrink: 1,
    fontSize: moderateScale(20),
    fontWeight: "700",
    color: GameColors.text,
    textAlign: "center",
  },
  labelSelected: { color: GameColors.primaryDark, fontWeight: "800" },
  labelCorrect: { color: GameColors.success, fontWeight: "800" },
  labelWrong: { color: GameColors.incorrect, fontWeight: "800" },
});
