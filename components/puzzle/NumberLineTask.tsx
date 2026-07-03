import { GameColors } from "@/constants/game";
import type { NumberLinePuzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

type NumberLineTaskProps = {
  puzzle: NumberLinePuzzle;
  selectedValue: number | null;
  answered: boolean;
  isCorrect: boolean;
  onSelectValue: (value: number) => void;
};

const CARD_INSET = moderateScale(16);
const COLUMNS = 5;
const TICK_GAP = moderateScale(6);

function getDisplayMax(min: number, max: number, columns: number): number {
  const count = max - min + 1;
  const remainder = count % columns;
  if (remainder === 0) return max;
  return max + columns - remainder;
}

function chunkRows(values: number[], columns: number): number[][] {
  const rows: number[][] = [];
  for (let i = 0; i < values.length; i += columns) {
    rows.push(values.slice(i, i + columns));
  }
  return rows;
}

export function NumberLineTask({
  puzzle,
  selectedValue,
  answered,
  isCorrect,
  onSelectValue,
}: NumberLineTaskProps) {
  const { t } = useTranslation();
  const { start, jump, min, max, correctValue } = puzzle.payload;

  const tickRows = useMemo(() => {
    const displayMax = getDisplayMax(min, max, COLUMNS);
    const values: number[] = [];
    for (let v = min; v <= displayMax; v++) {
      values.push(v);
    }
    return chunkRows(values, COLUMNS);
  }, [min, max]);

  const jumpLabel =
    jump >= 0
      ? t("puzzleTypes.jumpForward", { count: jump })
      : t("puzzleTypes.jumpBack", { count: Math.abs(jump) });

  return (
    <View style={styles.wrap}>
      <Text style={styles.prompt}>
        {t("puzzleTypes.numberLinePrompt", {
          start,
          jump: jumpLabel,
        })}
      </Text>

      <View style={styles.lineCard}>
        <View style={styles.tickGrid}>
          {tickRows.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.tickRow}>
              {row.map((value) => {
                const isStart = value === start;
                const isSelected = selectedValue === value;
                const isCorrectTick = answered && value === correctValue;
                const isWrongTick = answered && isSelected && !isCorrect;
                const isDoubleDigit = value >= 10;

                return (
                  <Pressable
                    key={value}
                    style={[
                      styles.tick,
                      isStart && styles.tickStart,
                      isSelected && !answered && styles.tickSelected,
                      isCorrectTick && styles.tickCorrect,
                      isWrongTick && styles.tickWrong,
                    ]}
                    disabled={answered}
                    onPress={() => onSelectValue(value)}
                    accessibilityRole="button"
                    accessibilityLabel={t("puzzleTypes.numberLineTickA11y", {
                      value,
                    })}
                  >
                    <View style={styles.labelSlot}>
                      {isStart ? (
                        <Text style={styles.startBadge}>
                          {t("puzzleTypes.startAt")}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.tickText,
                        isDoubleDigit && styles.tickTextSmall,
                        (isStart || isSelected || isCorrectTick) &&
                          styles.tickTextActive,
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {!answered ? (
        <Text style={styles.hint}>{t("puzzleTypes.numberLineHint")}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: moderateScale(12),
  },
  prompt: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.text,
    textAlign: "center",
    lineHeight: moderateScale(24),
  },
  lineCard: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(18),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    paddingVertical: CARD_INSET,
    paddingHorizontal: moderateScale(12),
  },
  tickGrid: {
    gap: TICK_GAP,
  },
  tickRow: {
    flexDirection: "row",
    gap: TICK_GAP,
    width: "100%",
  },
  tick: {
    flex: 1,
    height: moderateScale(54),
    borderRadius: moderateScale(12),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    backgroundColor: GameColors.background,
    alignItems: "center",
    paddingTop: moderateScale(5),
    paddingBottom: moderateScale(6),
  },
  labelSlot: {
    height: moderateScale(10),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: moderateScale(3),
  },
  startBadge: {
    fontSize: moderateScale(8),
    fontWeight: "800",
    color: GameColors.secondary,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  tickStart: {
    borderColor: GameColors.secondary,
    backgroundColor: "rgba(78, 205, 196, 0.15)",
  },
  tickSelected: {
    borderColor: GameColors.primary,
    backgroundColor: "rgba(255, 107, 107, 0.12)",
  },
  tickCorrect: {
    borderColor: GameColors.success,
    backgroundColor: "rgba(107, 203, 119, 0.15)",
  },
  tickWrong: {
    borderColor: "#FF9F43",
    backgroundColor: "rgba(255, 159, 67, 0.12)",
  },
  tickText: {
    fontSize: moderateScale(17),
    fontWeight: "700",
    color: GameColors.textMuted,
    fontVariant: ["tabular-nums"],
    lineHeight: moderateScale(20),
  },
  tickTextSmall: {
    fontSize: moderateScale(15),
  },
  tickTextActive: {
    color: GameColors.text,
    fontWeight: "800",
  },
  hint: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: GameColors.textMuted,
    textAlign: "center",
  },
});
