import { GameColors, getPuzzleCoinReward } from "@/constants/game";
import { PUZZLE_DIFFICULTIES } from "@/constants/puzzles";
import { useDifficultyLabel } from "@/hooks/use-difficulty-label";
import type { PuzzleDifficulty } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

type DifficultyPickerProps = {
  selected: PuzzleDifficulty;
  onSelect: (difficulty: PuzzleDifficulty) => void;
};

function DifficultyTab({
  difficulty,
  isSelected,
  onSelect,
}: {
  difficulty: PuzzleDifficulty;
  isSelected: boolean;
  onSelect: (difficulty: PuzzleDifficulty) => void;
}) {
  const { t } = useTranslation();
  const label = useDifficultyLabel(difficulty);
  const coinReward = getPuzzleCoinReward(difficulty);

  return (
    <Pressable
      onPress={() => onSelect(difficulty)}
      style={[styles.tab, isSelected && styles.tabSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={t("difficultyPicker.a11y", {
        difficulty: label,
        coins: coinReward,
      })}
    >
      <Text style={[styles.tabText, isSelected && styles.tabTextSelected]}>
        {label}
      </Text>
      <Text style={[styles.coinText, isSelected && styles.coinTextSelected]}>
        🪙 {coinReward}
      </Text>
    </Pressable>
  );
}

export function DifficultyPicker({
  selected,
  onSelect,
}: DifficultyPickerProps) {
  return (
    <View style={styles.row}>
      {PUZZLE_DIFFICULTIES.map((difficulty) => (
        <DifficultyTab
          key={difficulty}
          difficulty={difficulty}
          isSelected={selected === difficulty}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: moderateScale(8),
  },
  tab: {
    flex: 1,
    minHeight: moderateScale(52),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: moderateScale(14),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.card,
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(8),
    gap: moderateScale(2),
  },
  tabSelected: {
    borderColor: GameColors.secondary,
    backgroundColor: "#E8FAF8",
  },
  tabText: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: GameColors.textMuted,
  },
  tabTextSelected: {
    color: GameColors.text,
  },
  coinText: {
    fontSize: moderateScale(13),
    fontWeight: "700",
    color: GameColors.coinText,
  },
  coinTextSelected: {
    color: GameColors.coinText,
  },
});
