import { insetRadius } from '@/utils/border-radius';
import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { PuzzleColors as GameColors } from "@/constants/puzzle-theme";
import { getPuzzleCoinReward } from "@/constants/game";
import { PUZZLE_DIFFICULTIES } from "@/constants/puzzles";
import { useDifficultyLabel } from "@/hooks/use-difficulty-label";
import type { PuzzleDifficulty } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useEffect, useState } from "react";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

const PICKER_RADIUS = moderateScale(14);
const PICKER_INSET = moderateScale(4);
const TAB_RADIUS = insetRadius(PICKER_RADIUS, PICKER_INSET);

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
      style={styles.tab}
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
    </Pressable>
  );
}

export function DifficultyPicker({
  selected,
  onSelect,
}: DifficultyPickerProps) {
  const [width, setWidth] = useState(0);
  const selectedIndex = PUZZLE_DIFFICULTIES.indexOf(selected);
  const position = useSharedValue(selectedIndex);
  const inset = PICKER_INSET;
  const tabWidth = Math.max(0, (width - inset * 4) / PUZZLE_DIFFICULTIES.length);
  useEffect(() => {
    position.set(withTiming(selectedIndex, { duration: 240, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }, [selectedIndex, position]);
  const highlightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.get() * (tabWidth + inset) }] }));
  return (
    <View style={styles.row} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={[styles.highlight, { width: tabWidth }, highlightStyle]} /> : null}
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
    gap: PICKER_INSET,
    padding: PICKER_INSET,
    borderRadius: PICKER_RADIUS,
    backgroundColor: "#ECEBF7",
  },
  tab: {
    flex: 1,
    minHeight: moderateScale(44),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: TAB_RADIUS,
    backgroundColor: "transparent",
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(8),
    gap: moderateScale(2),
  },
  highlight: {
    position: "absolute",
    top: PICKER_INSET, bottom: PICKER_INSET, left: PICKER_INSET,
    borderRadius: TAB_RADIUS,
    backgroundColor: GameColors.primary,
    borderBottomWidth: 3,
    borderBottomColor: GameColors.primaryDark,
  },
  tabText: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: GameColors.textMuted,
  },
  tabTextSelected: {
    color: "#FFFFFF",
  },
});
