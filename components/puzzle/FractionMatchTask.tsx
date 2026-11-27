import { MatchPies } from './fraction/MatchPies';
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { FractionPieChart } from "@/components/puzzle/FractionPieChart";
import { Ink, PuzzleColors as GameColors, Quantity, Radius, Stroke } from "@/constants/puzzle-theme";
import type { FractionMatchPuzzle } from "@/types/puzzle";
import {
  buildFractionMatchCards,
  type FractionMatchCard,
} from "@/utils/fraction-match";
import { moderateScale } from "@/utils/scale";
import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { FractionNotation } from "@/components/puzzle/fraction/FractionNotation";
import { ResultMark } from "@/components/puzzle/kit/PuzzleKit";

type FractionMatchTaskProps = {
  puzzle: FractionMatchPuzzle;
  selectedByPair?: readonly (readonly number[])[];
  onToggleWedge?: (pairIndex: number, wedge: number) => void;
  matchedIds: string[];
  selectedId: string | null;
  wrongIds: string[];
  answered: boolean;
  canAttempt?: boolean;
  isCorrect: boolean;
  onTapCard: (cardId: string) => void;
};

export function FractionPairBadge({ pair }: { pair: number }) {
  return <View style={styles.badge}><Text style={styles.badgeText}>{pair}</Text></View>;
}

function MatchCard({ children, selected, match, showCorrect, showWrong, disabled, onPress, label }: {
  children: ReactNode; selected: boolean; match: number; showCorrect: boolean;
  showWrong: boolean; disabled: boolean; onPress: () => void; label: string;
}) {
  return <View>
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, match > 0 && styles.cardMatched,
        showCorrect && styles.cardCorrect, showWrong && styles.cardWrong, pressed && styles.pressed]}>
      {children}
      {showCorrect || showWrong ? <View style={styles.badge}>
        <ResultMark kind={showCorrect ? 'correct' : 'wrong'} size={16} />
      </View> : match > 0 ? <FractionPairBadge pair={match} /> : null}
    </Pressable>
  </View>;
}

function FractionVisual({ card }: { card: FractionMatchCard }) {
  return (
    <FractionPieChart
      denominator={card.denominator}
      shaded={card.numerator}
      size={moderateScale(100)}
    />
  );
}

export function FractionMatchTask({
  puzzle,
  matchedIds, selectedByPair, onToggleWedge,
  selectedId,
  wrongIds,
  answered,
  canAttempt = true,
  isCorrect,
  onTapCard,
}: FractionMatchTaskProps) {
  const { t } = useTranslation();
  const cards = useMemo(() => buildFractionMatchCards(puzzle), [puzzle]);
  const wrongSet = useMemo(() => new Set(wrongIds), [wrongIds]);

  if (selectedByPair && onToggleWedge) return <MatchPies puzzle={puzzle} selected={selectedByPair} onToggle={onToggleWedge} locked={answered || !canAttempt} />;
  return (
    <View style={styles.wrap}>
      <View style={[styles.grid, cards.length === 4 && styles.twoPairs]}>
        {cards.map((card) => {
          const selected = selectedId === card.id;
          const matchedIndex = matchedIds.indexOf(card.id);
          const matched = matchedIndex !== -1;
          return <MatchCard key={card.id} selected={selected && !answered}
            label={card.kind === 'text' ? `${card.numerator}/${card.denominator}`
              : t('fractionModels.shaded', { count: card.numerator, total: card.denominator })}
            match={matched ? Math.floor(matchedIndex / 2) + 1 : 0}
            showCorrect={answered && isCorrect && matched} showWrong={!isCorrect && wrongSet.has(card.id)}
            disabled={answered || !canAttempt || matched} onPress={() => onTapCard(card.id)}>
            {card.kind === "text" ? <FractionNotation numerator={card.numerator} denominator={card.denominator} /> : <FractionVisual card={card} />}
          </MatchCard>;
        })}
      </View>

      {!answered ? (
        <Text style={styles.progress}>
          {wrongIds.length > 0 ? t("puzzleTypes.fractionMatchTryAgain")
            : matchedIds.length === 0
            ? t("puzzleTypes.fractionMatchPickFirst")
            : matchedIds.length === cards.length ? t("puzzleTypes.fractionMatchReady")
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: moderateScale(10),
  },
  twoPairs: { maxWidth: moderateScale(260), alignSelf: "center" },
  card: {
    width: moderateScale(120),
    minHeight: moderateScale(120),
    flexGrow: 1,
    borderRadius: Radius.control,
    borderWidth: 0,
    borderBottomWidth: Stroke.outline + 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.card,
    alignItems: "center",
    justifyContent: "center",
    padding: moderateScale(5),
  },
  cardSelected: {
    borderColor: GameColors.secondary,
    backgroundColor: GameColors.selectedSurface,
  },
  cardMatched: { borderColor: Quantity.violet.edge, backgroundColor: Quantity.violet.soft, borderBottomWidth: Stroke.outline },
  cardCorrect: { borderColor: GameColors.success, backgroundColor: GameColors.successSurface },
  cardWrong: { borderColor: GameColors.incorrect, backgroundColor: GameColors.incorrectSurface },
  pressed: { backgroundColor: GameColors.selectedSurface },
  badge: { position: 'absolute', right: 5, top: 5, minWidth: 20, alignItems: 'center' },
  badgeText: { fontSize: 14, color: Ink.text, fontWeight: '800' },
  progress: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: GameColors.textMuted,
    textAlign: "center",
  },
});
