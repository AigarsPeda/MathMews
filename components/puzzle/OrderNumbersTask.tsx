import { GameColors } from "@/constants/game";
import type { OrderNumbersPuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const TILE_LAYOUT = LinearTransition.duration(220);
const SELECT_MS = 140;

type OrderNumberTileProps = {
  value: number;
  selected: boolean;
  answered: boolean;
  isCorrectSlot: boolean;
  isWrongSlot: boolean;
  onPress: () => void;
};

function OrderNumberTile({
  value,
  selected,
  answered,
  isCorrectSlot,
  isWrongSlot,
  onPress,
}: OrderNumberTileProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withTiming(selected && !answered ? 1.04 : 1, {
      duration: SELECT_MS,
    });
  }, [answered, scale, selected]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View layout={TILE_LAYOUT} style={[styles.tileWrap, animatedStyle]}>
      <Pressable
        style={[
          styles.tile,
          selected && !answered && styles.tileSelected,
          isCorrectSlot && styles.tileCorrect,
          isWrongSlot && styles.tileWrong,
        ]}
        disabled={answered}
        onPress={onPress}
        accessibilityRole="button"
      >
        <Text style={styles.tileText}>{value}</Text>
      </Pressable>
    </Animated.View>
  );
}

type OrderNumbersTaskProps = {
  puzzle: OrderNumbersPuzzle;
  order: number[];
  selectedSwapIndex: number | null;
  answered: boolean;
  isCorrect: boolean;
  onTapIndex: (index: number) => void;
  onCheck: () => void;
};

export function OrderNumbersTask({
  puzzle,
  order,
  selectedSwapIndex,
  answered,
  isCorrect,
  onTapIndex,
  onCheck,
}: OrderNumbersTaskProps) {
  const { t } = useTranslation();
  const { correctOrder } = puzzle.payload;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {order.map((value, index) => {
          const selected = selectedSwapIndex === index;
          const isCorrectSlot =
            answered && isCorrect && value === correctOrder[index];
          const isWrongSlot =
            answered && !isCorrect && value !== correctOrder[index];

          return (
            <OrderNumberTile
              key={`${puzzle.id}-${value}`}
              value={value}
              selected={selected}
              answered={answered}
              isCorrectSlot={isCorrectSlot}
              isWrongSlot={isWrongSlot}
              onPress={() => onTapIndex(index)}
            />
          );
        })}
      </View>

      {!answered ? (
        <>
          <Text style={styles.hint}>
            {selectedSwapIndex === null
              ? t("puzzleTypes.orderTapToSwap")
              : t("puzzleTypes.orderTapAnother")}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.checkBtn,
              pressed && styles.checkBtnPressed,
            ]}
            onPress={onCheck}
            accessibilityRole="button"
            accessibilityLabel={t("puzzleTypes.checkAnswer")}
          >
            <Text style={styles.checkBtnText}>{t("puzzleTypes.checkAnswer")}</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: moderateScale(14),
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  tileWrap: {
    margin: moderateScale(5),
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
  checkBtn: {
    alignSelf: "center",
    backgroundColor: GameColors.primary,
    borderRadius: moderateScale(16),
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(24),
  },
  checkBtnPressed: {
    opacity: 0.9,
  },
  checkBtnText: {
    fontSize: moderateScale(16),
    fontWeight: "800",
    color: "#fff",
  },
});
