import { FractionGridChart } from "@/components/puzzle/FractionGridChart";
import { FractionPieChart } from "@/components/puzzle/FractionPieChart";
import { GameColors } from "@/constants/game";
import type { FractionMatchPuzzle } from "@/types/puzzle";
import {
  buildFractionMatchCards,
  type FractionMatchCard,
} from "@/utils/fraction-match";
import { moderateScale } from "@/utils/scale";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

type FractionMatchTaskProps = {
  puzzle: FractionMatchPuzzle;
  matchedIds: string[];
  selectedId: string | null;
  wrongIds: string[];
  answered: boolean;
  isCorrect: boolean;
  onTapCard: (cardId: string) => void;
};

function FractionText({ numerator, denominator }: { numerator: number; denominator: number }) {
  return (
    <View style={styles.fractionText}>
      <Text style={styles.fractionNum}>{numerator}</Text>
      <View style={styles.fractionBar} />
      <Text style={styles.fractionDen}>{denominator}</Text>
    </View>
  );
}

function FractionVisual({ card }: { card: FractionMatchCard }) {
  if (card.visual === "grid") {
    return (
      <FractionGridChart
        denominator={card.denominator}
        shaded={card.numerator}
        size={moderateScale(76)}
      />
    );
  }

  return (
    <FractionPieChart
      denominator={card.denominator}
      shaded={card.numerator}
      size={moderateScale(76)}
    />
  );
}

export function FractionMatchTask({
  puzzle,
  matchedIds,
  selectedId,
  wrongIds,
  answered,
  isCorrect,
  onTapCard,
}: FractionMatchTaskProps) {
  const { t } = useTranslation();
  const cards = useMemo(() => buildFractionMatchCards(puzzle), [puzzle]);
  const matchedSet = useMemo(() => new Set(matchedIds), [matchedIds]);
  const wrongSet = useMemo(() => new Set(wrongIds), [wrongIds]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.instruction}>{t("puzzleTypes.fractionMatchHint")}</Text>

      <View style={styles.grid}>
        {cards.map((card) => {
          const selected = selectedId === card.id;
          const matched = matchedSet.has(card.id);
          const wrong = wrongSet.has(card.id);
          const showCorrect = answered && isCorrect && matched;
          const showWrong = answered && !isCorrect && wrong;

          return (
            <Pressable
              key={card.id}
              style={[
                styles.card,
                selected && !answered && styles.cardSelected,
                matched && !answered && styles.cardMatched,
                showCorrect && styles.cardCorrect,
                showWrong && styles.cardWrong,
                answered && !matched && !showWrong && styles.cardMuted,
              ]}
              disabled={answered || matched}
              onPress={() => onTapCard(card.id)}
              accessibilityRole="button"
            >
              {card.kind === "text" ? (
                <FractionText
                  numerator={card.numerator}
                  denominator={card.denominator}
                />
              ) : (
                <FractionVisual card={card} />
              )}
            </Pressable>
          );
        })}
      </View>

      {!answered ? (
        <Text style={styles.progress}>
          {matchedIds.length === 0
            ? t("puzzleTypes.fractionMatchPickFirst")
            : t("puzzleTypes.fractionMatchPairsLeft", {
                count: puzzle.payload.pairs.length - matchedIds.length / 2,
              })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: moderateScale(12),
  },
  instruction: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: GameColors.textMuted,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: moderateScale(10),
  },
  card: {
    width: moderateScale(108),
    minHeight: moderateScale(108),
    borderRadius: moderateScale(18),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.card,
    alignItems: "center",
    justifyContent: "center",
    padding: moderateScale(10),
  },
  cardSelected: {
    borderColor: GameColors.secondary,
    backgroundColor: "rgba(78, 205, 196, 0.12)",
  },
  cardMatched: {
    borderColor: GameColors.success,
    backgroundColor: "rgba(107, 203, 119, 0.12)",
  },
  cardCorrect: {
    borderColor: GameColors.success,
    backgroundColor: "rgba(107, 203, 119, 0.15)",
  },
  cardWrong: {
    borderColor: "#FF9F43",
    backgroundColor: "rgba(255, 159, 67, 0.12)",
  },
  cardMuted: {
    opacity: 0.7,
  },
  fractionText: {
    alignItems: "center",
  },
  fractionNum: {
    fontSize: moderateScale(28),
    fontWeight: "800",
    color: GameColors.text,
    fontVariant: ["tabular-nums"],
  },
  fractionBar: {
    width: moderateScale(36),
    height: moderateScale(3),
    backgroundColor: GameColors.secondary,
    marginVertical: moderateScale(3),
    borderRadius: moderateScale(2),
  },
  fractionDen: {
    fontSize: moderateScale(28),
    fontWeight: "800",
    color: GameColors.text,
    fontVariant: ["tabular-nums"],
  },
  progress: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: GameColors.textMuted,
    textAlign: "center",
  },
});
