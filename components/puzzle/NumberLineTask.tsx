import { LineStepButton } from "@/components/puzzle/number-line/LineStepButton";
import { ValueChip } from "@/components/puzzle/kit/PuzzleKit";
import { NumberLineTrack } from "@/components/puzzle/NumberLineTrack";
import type { NumberLinePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

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
  return (
    <View style={styles.wrap}>
      <ValueChip label={`${start} ${jump < 0 ? "−" : "+"} ${Math.abs(jump)}`} size="md" style={styles.given} />
      <View style={styles.lineCard}>
        <NumberLineTrack
          min={min}
          max={max}
          start={start}
          focusEnd={start + jump}
          value={current}
          onSelect={onSelectValue}
          disabled={answered}
          correctValue={answered && isCorrect ? correctValue : undefined}
          wrongValue={answered && !isCorrect && selectedValue !== null ? selectedValue : undefined}
        />
        {!answered ? (
          <View style={styles.controls}>
            {([-1, 1] as const).map((direction) => {
              const next = current + direction;
              const disabled = next < min || next > max;
              return (
                <LineStepButton key={direction} direction={direction} disabled={disabled}
                  accessibilityLabel={t(direction < 0 ? "puzzleTypes.numberLineMoveLeft" : "puzzleTypes.numberLineMoveRight")}
                  label={t(direction < 0 ? "puzzleTypes.numberLineLeftButton" : "puzzleTypes.numberLineRightButton")}
                  onPress={() => onSelectValue(next)} />
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: moderateScale(12) },
  given: { alignSelf: "center" },
  lineCard: {
    gap: moderateScale(4),
  },
  controls: { flexDirection: "row", gap: moderateScale(12) },
});
