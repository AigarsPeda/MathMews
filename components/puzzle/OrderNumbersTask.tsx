import { GameColors } from "@/constants/game";
import type { OrderNumbersPuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PuzzleDragBoard, PuzzleDragTile, PuzzleDropArea } from "./PuzzleDragBoard";

type OrderNumbersTaskProps = {
  puzzle: OrderNumbersPuzzle;
  order: number[];
  answered: boolean;
  isCorrect: boolean;
  onMove: (from: number, to: number) => void;
  onDragStateChange: (dragging: boolean) => void;
  onCheck: () => void;
};

export function OrderNumbersTask({
  puzzle,
  order,
  answered,
  isCorrect,
  onMove,
  onDragStateChange,
  onCheck,
}: OrderNumbersTaskProps) {
  const { t } = useTranslation();
  const { correctOrder } = puzzle.payload;

  return (
    <View style={styles.wrap}>
      <PuzzleDragBoard
        onDragStateChange={onDragStateChange}
        onDrop={(source, target) => {
          if (!answered) onMove(Number(source), Number(target));
        }}
      >
        <View style={styles.row}>
          {order.map((value, index) => {
            const isCorrectSlot =
              answered && isCorrect && value === correctOrder[index];
            const isWrongSlot =
              answered && !isCorrect && value !== correctOrder[index];

            return (
              <PuzzleDropArea
                key={index}
                id={String(index)}
                label={t("puzzleTypes.orderPosition", { position: index + 1 })}
              >
                <PuzzleDragTile
                  id={String(index)}
                  label={String(value)}
                  disabled={answered}
                  style={[
                    styles.tile,
                    isCorrectSlot && styles.tileCorrect,
                    isWrongSlot && styles.tileWrong,
                  ]}
                  accessibilityLabel={t("puzzleTypes.orderTile", { value, position: index + 1 })}
                  accessibilityHint={t("challenges.dragA11yHint")}
                  actions={order.flatMap((_, position) => position === index ? [] : [{
                    id: String(position),
                    label: t("puzzleTypes.orderMoveTo", { position: position + 1 }),
                  }])}
                />
              </PuzzleDropArea>
            );
          })}
        </View>
      </PuzzleDragBoard>

      {!answered ? (
        <>
          <Text style={styles.hint}>
            {t("puzzleTypes.orderDragToMove")}
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
