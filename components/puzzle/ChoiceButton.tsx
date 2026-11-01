import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { useTranslation } from "react-i18next";
import { PuzzleColors as GameColors } from "@/constants/puzzle-theme";
import { moderateScale } from "@/utils/scale";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

type ChoiceButtonProps = {
  label: string;
  selected: boolean;
  disabled: boolean;
  result?: "correct" | "wrong" | null;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
};

export function ChoiceButton({
  label,
  selected,
  disabled,
  result = null,
  style,
  onPress,
}: ChoiceButtonProps) {
  const { t } = useTranslation();
  const showCorrect = result === "correct";
  const showWrong = result === "wrong";

  return (
    <Pressable
      style={[
        styles.button,
        style,
        selected && styles.buttonSelected,
        showCorrect && styles.buttonCorrect,
        showWrong && styles.buttonWrong,
        disabled && !selected && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t("play.answerLabel", { answer: label })}
      accessibilityState={{ disabled, selected }}
    >
      <Text
        style={[styles.label, (showCorrect || showWrong) && styles.labelResult]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: "stretch",
    minHeight: moderateScale(64),
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.card,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(16),
  },
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
  buttonDisabled: {
    opacity: 0.85,
  },
  label: {
    fontSize: moderateScale(20),
    fontWeight: "700",
    color: GameColors.text,
    textAlign: "center",
  },
  labelResult: {
    fontWeight: "800",
  },
});
