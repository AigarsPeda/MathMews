import { GameColors } from "@/constants/game";
import type { OrderNumbersPuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { PuzzleDragBoard, PuzzleDragTile, PuzzleDropArea } from "./PuzzleDragBoard";

type OrderNumbersTaskProps = {
  puzzle: OrderNumbersPuzzle;
  order: number[];
  answered: boolean;
  isCorrect: boolean;
  onMove: (from: number, to: number) => void;
  onSwap: (from: number, to: number) => void;
  onDragStateChange: (dragging: boolean) => void;
};

export function OrderNumbersTask({
  puzzle,
  order,
  answered,
  isCorrect,
  onMove,
  onSwap,
  onDragStateChange,
}: OrderNumbersTaskProps) {
  const { t } = useTranslation();
  const { correctOrder } = puzzle.payload;
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  function tapSlot(index: number) {
    if (answered) return;
    if (selectedSlot === null) setSelectedSlot(index);
    else {
      if (selectedSlot !== index) onSwap(selectedSlot, index);
      setSelectedSlot(null);
    }
  }

  return (
    <View style={styles.wrap}>
      <PuzzleDragBoard
        onDragStateChange={onDragStateChange}
        onDrop={(source, target) => {
          if (!answered) {
            setSelectedSlot(null);
            onMove(order.indexOf(Number(source)), order.indexOf(Number(target)));
          }
        }}
      >
        <View style={styles.row}>
          {order.map((value, index) => {
            const isCorrectSlot =
              answered && isCorrect && value === correctOrder[index];
            const isWrongSlot =
              answered && !isCorrect && value !== correctOrder[index];

            // Keep the number and its measured drop target together during reorders.
            return (
              <PuzzleDropArea
                key={value}
                id={String(value)}
                motionId={String(value)}
                label={t("puzzleTypes.orderPosition", { position: index + 1 })}
              >
                <PuzzleDragTile
                  id={String(value)}
                  motionId={String(value)}
                  label={String(value)}
                  disabled={answered}
                  selected={!answered && selectedSlot === index}
                  onPress={() => tapSlot(index)}
                  style={[
                    styles.tile,
                    !answered && selectedSlot === index && styles.tileSelected,
                    isCorrectSlot && styles.tileCorrect,
                    isWrongSlot && styles.tileWrong,
                  ]}
                  accessibilityLabel={t("puzzleTypes.orderTile", { value, position: index + 1 })}
                  accessibilityHint={t("puzzleTypes.orderTapOrDrag")}
                  actions={order.flatMap((targetValue, position) => position === index ? [] : [{
                    id: String(targetValue),
                    label: t("puzzleTypes.orderMoveTo", { position: position + 1 }),
                  }])}
                />
              </PuzzleDropArea>
            );
          })}
        </View>
      </PuzzleDragBoard>

      {!answered ? (
        <Text style={styles.hint}>
          {t(selectedSlot === null ? "puzzleTypes.orderTapOrDrag" : "puzzleTypes.orderPickSecond")}
        </Text>
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
    gap: moderateScale(10),
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
  tileCorrect: {
    borderColor: GameColors.success,
    backgroundColor: "rgba(107, 203, 119, 0.15)",
  },
  tileSelected: { borderColor: GameColors.secondaryDark, backgroundColor: "#E8FAF8" },
  tileWrong: {
    borderColor: "#FF9F43",
    backgroundColor: "rgba(255, 159, 67, 0.12)",
  },
  hint: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: GameColors.textMuted,
    textAlign: "center",
  },
});
