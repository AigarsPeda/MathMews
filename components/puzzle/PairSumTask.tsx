import { GameColors } from "@/constants/game";
import type { PairSumPuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

type PairSumTaskProps = {
  puzzle: PairSumPuzzle;
  selectedIndices: number[];
  answered: boolean;
  isCorrect: boolean;
  onToggleIndex: (index: number) => void;
};

export function PairSumTask({
  puzzle,
  selectedIndices,
  answered,
  isCorrect,
  onToggleIndex,
}: PairSumTaskProps) {
  const { t } = useTranslation();
  const { numbers, target } = puzzle.payload;
  const [correctA, correctB] = puzzle.payload.correctIndices;

  return (
    <View style={styles.wrap}>
      <View style={styles.targetRow}>
        <Text style={styles.targetLabel}>{t("puzzleTypes.pairTarget")}</Text>
        <Text style={styles.targetValue}>{target}</Text>
      </View>

      <View style={styles.grid}>
        {numbers.map((num, index) => {
          const selected = selectedIndices.includes(index);
          const isCorrectTile =
            answered &&
            (isCorrect
              ? selected
              : index === correctA || index === correctB);
          const isWrongTile =
            answered && !isCorrect && selected && !isCorrectTile;

          return (
            <Pressable
              key={`${puzzle.id}-${index}`}
              style={[
                styles.tile,
                selected && !answered && styles.tileSelected,
                isCorrectTile && styles.tileCorrect,
                isWrongTile && styles.tileWrong,
                answered && !selected && !isCorrectTile && styles.tileMuted,
              ]}
              disabled={answered}
              onPress={() => onToggleIndex(index)}
              accessibilityRole="button"
            >
              <Text style={styles.tileText}>{num}</Text>
            </Pressable>
          );
        })}
      </View>

      {!answered ? (
        <Text style={styles.hint}>
          {selectedIndices.length === 0
            ? t("puzzleTypes.pickTwoNumbers")
            : selectedIndices.length === 1
              ? t("puzzleTypes.pickOneMore")
              : t("puzzleTypes.checkingPair")}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: moderateScale(14),
  },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(10),
  },
  targetLabel: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.textMuted,
  },
  targetValue: {
    fontSize: moderateScale(28),
    fontWeight: "800",
    color: GameColors.coinText,
    fontVariant: ["tabular-nums"],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: moderateScale(10),
    justifyContent: "center",
  },
  tile: {
    minWidth: moderateScale(64),
    minHeight: moderateScale(64),
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(12),
  },
  tileSelected: {
    borderColor: GameColors.secondary,
    backgroundColor: "rgba(78, 205, 196, 0.12)",
  },
  tileCorrect: {
    borderColor: GameColors.success,
    backgroundColor: "rgba(107, 203, 119, 0.15)",
  },
  tileWrong: {
    borderColor: "#FF9F43",
    backgroundColor: "rgba(255, 159, 67, 0.12)",
  },
  tileMuted: {
    opacity: 0.7,
  },
  tileText: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: GameColors.text,
    fontVariant: ["tabular-nums"],
  },
  hint: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: GameColors.textMuted,
    textAlign: "center",
  },
});
