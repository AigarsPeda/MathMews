import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { Pressable, StyleSheet, Text } from "react-native";

type ChoiceButtonProps = {
  label: string;
  selected: boolean;
  disabled: boolean;
  result?: "correct" | "wrong" | null;
  onPress: () => void;
};

export function ChoiceButton({
  label,
  selected,
  disabled,
  result = null,
  onPress,
}: ChoiceButtonProps) {
  const showCorrect = result === "correct";
  const showWrong = result === "wrong";

  return (
    <Pressable
      style={[
        styles.button,
        selected && styles.buttonSelected,
        showCorrect && styles.buttonCorrect,
        showWrong && styles.buttonWrong,
        disabled && !selected && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Answer ${label}`}
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
    minHeight: moderateScale(56),
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.card,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(16),
  },
  buttonSelected: {
    borderColor: GameColors.secondary,
    backgroundColor: "rgba(78, 205, 196, 0.1)",
  },
  buttonCorrect: {
    borderColor: GameColors.success,
    backgroundColor: "rgba(107, 203, 119, 0.15)",
  },
  buttonWrong: {
    borderColor: "#FF9F43",
    backgroundColor: "rgba(255, 159, 67, 0.12)",
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
