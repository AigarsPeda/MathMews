import { ChoiceButton } from "@/components/puzzle/ChoiceButton";
import { GameColors } from "@/constants/game";
import type { BalancePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { Platform, StyleSheet, Text, View } from "react-native";

type BalanceTaskProps = {
  puzzle: BalancePuzzle;
  selectedIndex: number | null;
  isCorrect: boolean;
  answered: boolean;
  onSelect: (index: number) => void;
};

export function BalanceTask({
  puzzle,
  selectedIndex,
  isCorrect,
  answered,
  onSelect,
}: BalanceTaskProps) {
  const { leftDisplay, rightValue, choices } = puzzle.payload;

  return (
    <View style={styles.wrap}>
      <View style={styles.scaleCard}>
        <View style={styles.panRow}>
          <View style={styles.pan}>
            <Text style={styles.panExpr}>{leftDisplay}</Text>
          </View>
          <View style={styles.pan}>
            <Text style={styles.panValue}>{rightValue}</Text>
          </View>
        </View>

        <View style={styles.beam} />

        <View style={styles.stand}>
          <Text style={styles.fulcrumMark}>▲</Text>
        </View>
      </View>

      <View style={styles.choices}>
        {choices.map((choice, index) => {
          let result: "correct" | "wrong" | null = null;
          if (answered) {
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

const CARD_INSET = moderateScale(16);
const BEAM_HEIGHT = moderateScale(5);
const FULCRUM_SIZE = moderateScale(28);

const styles = StyleSheet.create({
  wrap: {
    gap: moderateScale(16),
  },
  scaleCard: {
    alignItems: "center",
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(18),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    paddingHorizontal: moderateScale(12),
    paddingTop: CARD_INSET,
    paddingBottom: CARD_INSET - 10,
    gap: moderateScale(8),
  },
  panRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: moderateScale(8),
    gap: moderateScale(16),
  },
  pan: {
    flex: 1,
    maxWidth: moderateScale(140),
    minHeight: moderateScale(72),
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: moderateScale(10),
  },
  panExpr: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: GameColors.text,
    fontVariant: ["tabular-nums"],
  },
  panValue: {
    fontSize: moderateScale(26),
    fontWeight: "800",
    color: GameColors.coinText,
    fontVariant: ["tabular-nums"],
  },
  beam: {
    width: "99.5%",
    alignSelf: "center",
    height: BEAM_HEIGHT,
    backgroundColor: GameColors.textMuted,
    borderRadius: moderateScale(3),
  },
  stand: {
    height: FULCRUM_SIZE,
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  fulcrumMark: {
    fontSize: FULCRUM_SIZE,
    lineHeight: FULCRUM_SIZE,
    color: GameColors.secondary,
    ...Platform.select({
      android: { includeFontPadding: false },
      default: {},
    }),
  },
  choices: {
    gap: moderateScale(10),
  },
});
