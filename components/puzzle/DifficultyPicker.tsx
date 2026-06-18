import { DIFFICULTY_LABELS, PUZZLE_DIFFICULTIES } from '@/constants/puzzles';
import { GameColors, getPuzzleCoinReward } from '@/constants/game';
import type { PuzzleDifficulty } from '@/types/puzzle';
import { moderateScale } from '@/utils/scale';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type DifficultyPickerProps = {
  selected: PuzzleDifficulty;
  onSelect: (difficulty: PuzzleDifficulty) => void;
};

export function DifficultyPicker({ selected, onSelect }: DifficultyPickerProps) {
  return (
    <View style={styles.row}>
      {PUZZLE_DIFFICULTIES.map((difficulty) => {
        const isSelected = selected === difficulty;
        const coinReward = getPuzzleCoinReward(difficulty);

        return (
          <Pressable
            key={difficulty}
            onPress={() => onSelect(difficulty)}
            style={[styles.tab, isSelected && styles.tabSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${DIFFICULTY_LABELS[difficulty]} difficulty, ${coinReward} coins per nut`}
          >
            <Text style={[styles.tabText, isSelected && styles.tabTextSelected]}>
              {DIFFICULTY_LABELS[difficulty]}
            </Text>
            <Text style={[styles.coinText, isSelected && styles.coinTextSelected]}>
              🪙 {coinReward}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: moderateScale(8),
  },
  tab: {
    flex: 1,
    minHeight: moderateScale(52),
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#E8FAF8',
  },
  tabText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: GameColors.textMuted,
  },
  tabTextSelected: {
    color: GameColors.text,
  },
  coinText: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: GameColors.coinText,
  },
  coinTextSelected: {
    color: GameColors.coinText,
  },
});
