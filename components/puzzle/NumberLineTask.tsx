import { NumberLineTrack } from "@/components/puzzle/NumberLineTrack";
import { GameColors } from "@/constants/game";
import type { NumberLinePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

type NumberLineTaskProps = {
  puzzle: NumberLinePuzzle;
  selectedValue: number | null;
  answered: boolean;
  isCorrect: boolean;
  onSelectValue: (value: number) => void;
};

export function NumberLineTask({
  puzzle, selectedValue, answered, isCorrect, onSelectValue,
}: NumberLineTaskProps) {
  const { t } = useTranslation();
  const { start, jump, min, max, correctValue } = puzzle.payload;
  const current = selectedValue ?? start;
  const jumpLabel = t(jump >= 0 ? "puzzleTypes.jumpForward" : "puzzleTypes.jumpBack", {
    count: Math.abs(jump),
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.prompt}>
        {t("puzzleTypes.numberLinePrompt", { start, jump: jumpLabel })}
      </Text>
      <View style={styles.lineCard}>
        <NumberLineTrack
          min={min}
          max={max}
          start={start}
          value={current}
          onSelect={onSelectValue}
          disabled={answered}
          correctValue={answered ? correctValue : undefined}
          wrongValue={answered && !isCorrect && selectedValue !== null ? selectedValue : undefined}
        />
        {!answered ? (
          <View style={styles.controls}>
            {([-1, 1] as const).map((direction) => {
              const next = current + direction;
              const disabled = next < min || next > max;
              return (
                <Pressable
                  key={direction}
                  onPress={() => onSelectValue(next)}
                  disabled={disabled}
                  style={[styles.stepButton, disabled && styles.disabled]}
                  accessibilityRole="button"
                  accessibilityLabel={t(direction < 0 ? "puzzleTypes.numberLineMoveLeft" : "puzzleTypes.numberLineMoveRight")}
                >
                  <Text style={styles.stepButtonText}>
                    {t(direction < 0 ? "puzzleTypes.numberLineLeftButton" : "puzzleTypes.numberLineRightButton")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
      {!answered ? <Text style={styles.hint}>{t("puzzleTypes.numberLineHint")}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: moderateScale(12) },
  prompt: {
    fontSize: moderateScale(18), fontWeight: "700", color: GameColors.text,
    textAlign: "center", lineHeight: moderateScale(26),
  },
  lineCard: {
    backgroundColor: GameColors.card, borderRadius: moderateScale(18),
    borderWidth: 2, borderColor: GameColors.cardBorder, padding: moderateScale(12),
  },
  controls: { flexDirection: "row", gap: moderateScale(12) },
  stepButton: {
    flex: 1, minHeight: moderateScale(52), padding: moderateScale(10),
    borderRadius: moderateScale(12), backgroundColor: GameColors.background,
    alignItems: "center", justifyContent: "center",
  },
  stepButtonText: { fontSize: moderateScale(17), fontWeight: "800", color: GameColors.text },
  disabled: { opacity: 0.35 },
  hint: { fontSize: moderateScale(14), lineHeight: moderateScale(20), color: GameColors.textMuted, textAlign: "center" },
});
