import { useChoiceLayout } from '@/components/puzzle/useChoiceLayout';
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { ChoiceButton } from "@/components/puzzle/ChoiceButton";
import { DiagramColors as D, PuzzleColors as GameColors } from "@/constants/puzzle-theme";
import type { FunctionMachinePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

type FunctionMachineTaskProps = {
  puzzle: FunctionMachinePuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  incorrectAttempt?: boolean;
  onSelect: (index: number) => void;
};

export function FunctionMachineTask({
  puzzle,
  selectedIndex,
  isCorrect,
  answered,
  incorrectAttempt = false,
  onSelect,
}: FunctionMachineTaskProps) {
  const { t } = useTranslation();
  const { input, output, choices } = puzzle.payload;

  const choiceLayout = useChoiceLayout(choices);

  return (
    <View style={styles.wrap}>
      <View style={styles.machineRow}>
        <View style={styles.valueBox}>
          <Text style={styles.valueLabel}>{t("puzzleTypes.machineIn")}</Text>
          <Text style={styles.valueText}>{input}</Text>
        </View>

        <View style={styles.machineBox}>
          <Text style={styles.machineLabel}>{t("puzzleTypes.machineRule")}</Text>
          <Text style={styles.machineSymbol}>?</Text>
        </View>

        <View style={styles.valueBox}>
          <Text style={styles.valueLabel}>{t("puzzleTypes.machineOut")}</Text>
          <Text style={styles.valueText}>{output}</Text>
        </View>
      </View>

      <View onLayout={choiceLayout.onLayout} style={choiceLayout.container}>
        {choices.map((choice, index) => {
          let result: "correct" | "wrong" | null = null;
          if (answered || incorrectAttempt) {
            if (isCorrect && index === puzzle.correctIndex) {
              result = "correct";
            } else if (!isCorrect && index === selectedIndex) {
              result = "wrong";
            }
          }

          return (
            <ChoiceButton
              key={`${puzzle.id}-${choice}`}
              label={choice}
              style={choiceLayout.item}
              selected={selectedIndex === index}
              disabled={answered}
              result={result}
              onPress={() => onSelect(index)}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: moderateScale(8),
  },
  machineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(10),
    flexWrap: "wrap",
  },
  valueBox: {
    minWidth: moderateScale(72),
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: D.geometryEdge,
    backgroundColor: D.geometrySurface,
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(12),
    alignItems: "center",
    gap: moderateScale(4),
  },
  valueLabel: {
    fontSize: moderateScale(12),
    fontWeight: "700",
    color: GameColors.textMuted,
    textTransform: "uppercase",
  },
  valueText: {
    fontSize: moderateScale(26),
    fontWeight: "800",
    color: GameColors.text,
    fontVariant: ["tabular-nums"],
  },
  machineBox: {
    minWidth: moderateScale(88),
    borderRadius: moderateScale(18),
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: D.solidSide,
    backgroundColor: D.solidTop,
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    alignItems: "center",
    gap: moderateScale(4),
  },
  machineLabel: {
    fontSize: moderateScale(11),
    fontWeight: "700",
    color: GameColors.text,
    textTransform: "uppercase",
  },
  machineSymbol: {
    fontSize: moderateScale(28),
    fontWeight: "800",
    color: GameColors.text,
  },
  choices: {
    gap: moderateScale(12),
  },
});
