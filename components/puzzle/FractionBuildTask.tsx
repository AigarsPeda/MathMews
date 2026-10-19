import { FractionPieChart } from "@/components/puzzle/FractionPieChart";
import { GameColors } from "@/constants/game";
import type { FractionBuildPuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

type FractionBuildTaskProps = {
  puzzle: FractionBuildPuzzle;
  shadedPieces: number;
  selectedSlices: readonly number[];
  answered: boolean;
  isCorrect: boolean;
  onChangeShaded: (count: number) => void;
  onToggleSlice: (index: number) => void;
};

export function FractionBuildTask({
  puzzle,
  shadedPieces,
  selectedSlices,
  answered,
  isCorrect,
  onChangeShaded,
  onToggleSlice,
}: FractionBuildTaskProps) {
  const { t } = useTranslation();
  const { numerator, denominator } = puzzle.payload;
  const canRemove = shadedPieces > 0;
  const canAdd = shadedPieces < denominator;

  return (
    <View style={styles.wrap}>
      {!puzzle.payload.hideTarget || (answered && isCorrect) ? <View style={styles.fractionDisplay}>
        <Text style={styles.numerator}>{numerator}</Text>
        <View style={styles.fractionBar} />
        <Text style={styles.denominator}>{denominator}</Text>
      </View> : null}

      <View style={styles.chartCard}>
        <FractionPieChart
          denominator={denominator}
          shaded={shadedPieces}
          selectedSlices={selectedSlices}
          onToggleSlice={onToggleSlice}
          size={moderateScale(156)}
          showResult={answered}
          isCorrect={isCorrect}
        />
      </View>

      {!answered ? (
        <View style={styles.controls}>
          <View style={styles.pieceControls}>
            <Pressable
              style={({ pressed }) => [
                styles.pieceBtn,
                !canRemove && styles.pieceBtnDisabled,
                pressed && canRemove && styles.pieceBtnPressed,
              ]}
              disabled={!canRemove}
              onPress={() => onChangeShaded(shadedPieces - 1)}
              accessibilityRole="button"
              accessibilityLabel={t("puzzleTypes.removePiece")}
            >
              <Text style={styles.pieceBtnSymbol}>−</Text>
              <Text style={styles.pieceBtnLabel}>{t("puzzleTypes.piece")}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.pieceBtn,
                !canAdd && styles.pieceBtnDisabled,
                pressed && canAdd && styles.pieceBtnPressed,
              ]}
              disabled={!canAdd}
              onPress={() => onChangeShaded(shadedPieces + 1)}
              accessibilityRole="button"
              accessibilityLabel={t("puzzleTypes.addPiece")}
            >
              <Text style={styles.pieceBtnSymbol}>+</Text>
              <Text style={styles.pieceBtnLabel}>{t("puzzleTypes.piece")}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: moderateScale(12),
    alignItems: "center",
  },
  fractionDisplay: {
    alignItems: "center",
    gap: moderateScale(2),
  },
  numerator: {
    fontSize: moderateScale(36),
    fontWeight: "800",
    color: GameColors.text,
    fontVariant: ["tabular-nums"],
  },
  fractionBar: {
    width: moderateScale(56),
    height: moderateScale(4),
    borderRadius: moderateScale(2),
    backgroundColor: GameColors.primary,
  },
  denominator: {
    fontSize: moderateScale(36),
    fontWeight: "800",
    color: GameColors.text,
    fontVariant: ["tabular-nums"],
  },
  chartCard: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(18),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    padding: moderateScale(12),
  },
  controls: {
    width: "100%",
    gap: moderateScale(12),
  },
  pieceControls: {
    flexDirection: "row",
    gap: moderateScale(10),
    width: "100%",
  },
  pieceBtn: {
    flex: 1,
    minHeight: moderateScale(56),
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(6),
    paddingHorizontal: moderateScale(10),
  },
  pieceBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  pieceBtnDisabled: {
    opacity: 0.45,
  },
  pieceBtnSymbol: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: GameColors.text,
  },
  pieceBtnLabel: {
    fontSize: moderateScale(15),
    fontWeight: "700",
    color: GameColors.text,
    letterSpacing: 0.4,
  },
});
