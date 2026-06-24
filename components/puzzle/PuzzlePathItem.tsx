import { GameColors } from "@/constants/game";
import type { PuzzlePathState } from "@/constants/puzzles";
import { useTopicLabel } from "@/hooks/use-topic-label";
import type { Puzzle } from "@/types/puzzle";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

const TOPIC_EMOJI: Record<Puzzle["topic"], string> = {
  addition: "➕",
  subtraction: "➖",
  multiplication: "✖️",
  logic: "🧠",
  patterns: "🔢",
};

const STATE_LABEL_KEYS = {
  completed: "puzzlePath.stateCompleted",
  current: "puzzlePath.stateCurrent",
  locked: "puzzlePath.stateLocked",
} as const;

type PuzzlePathItemProps = {
  puzzle: Puzzle;
  puzzleNumber: number;
  state: PuzzlePathState;
  lockedMessage?: string;
  onPress?: () => void;
  onLayout?: (y: number) => void;
};

export function PuzzlePathItem({
  puzzle,
  puzzleNumber,
  state,
  lockedMessage,
  onPress,
  onLayout,
}: PuzzlePathItemProps) {
  const { t } = useTranslation();
  const topicLabel = useTopicLabel(puzzle.topic);
  const isPlayable = state === "current" || state === "completed";
  const stateLabel = t(STATE_LABEL_KEYS[state]);

  return (
    <View
      onLayout={(event) => onLayout?.(event.nativeEvent.layout.y)}
      style={styles.wrap}
    >
      <Pressable
        onPress={onPress}
        disabled={!isPlayable}
        style={[
          styles.card,
          state === "current" && styles.cardCurrent,
          state === "locked" && styles.cardLocked,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !isPlayable }}
        accessibilityLabel={t("puzzlePath.a11yPuzzle", {
          number: puzzleNumber,
          state: stateLabel,
        })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            {state === "completed" ? (
              <View style={styles.statusBadgeCompleted}>
                <Text style={styles.statusBadgeText}>✓</Text>
              </View>
            ) : state === "locked" ? (
              <Text style={styles.statusIcon}>🔒</Text>
            ) : null}
            <Text
              style={[
                styles.badge,
                state === "current" && styles.badgeCurrent,
                state === "locked" && styles.badgeLocked,
              ]}
            >
              {state !== "locked"
                ? t("puzzlePath.nutWithTopic", {
                    number: puzzleNumber,
                    topic: topicLabel,
                  })
                : t("puzzlePath.nutBadge", { number: puzzleNumber })}
            </Text>
          </View>
          {state === "current" ? (
            <View style={styles.playChip}>
              <Text style={styles.playChipText}>{t("common.play")}</Text>
            </View>
          ) : (
            <Text style={styles.topic}>{TOPIC_EMOJI[puzzle.topic]}</Text>
          )}
        </View>

        {state === "locked" ? (
          <Text style={styles.lockedHint}>
            {lockedMessage ??
              t("puzzlePath.unlockHint", { number: puzzleNumber - 1 })}
          </Text>
        ) : (
          <Text
            style={[
              styles.preview,
              state === "completed" && styles.previewCompleted,
            ]}
            numberOfLines={state === "current" ? 3 : 2}
          >
            {puzzle.question}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: moderateScale(10),
  },
  card: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    padding: moderateScale(14),
    gap: moderateScale(8),
  },
  cardCurrent: {
    borderColor: GameColors.primary,
    backgroundColor: "#FFF8F6",
  },
  cardLocked: {
    backgroundColor: GameColors.background,
    paddingVertical: moderateScale(12),
    gap: moderateScale(4),
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: moderateScale(8),
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8),
  },
  statusBadgeCompleted: {
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(12),
    backgroundColor: "#E8F8EB",
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadgeText: {
    fontSize: moderateScale(13),
    fontWeight: "800",
    color: GameColors.success,
  },
  statusIcon: {
    fontSize: moderateScale(16),
  },
  badge: {
    flex: 1,
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: GameColors.textMuted,
  },
  badgeCurrent: {
    color: GameColors.text,
  },
  badgeLocked: {
    color: GameColors.textMuted,
  },
  playChip: {
    backgroundColor: GameColors.primary,
    borderRadius: moderateScale(10),
    paddingVertical: moderateScale(4),
    paddingHorizontal: moderateScale(10),
  },
  playChipText: {
    fontSize: moderateScale(12),
    fontWeight: "800",
    color: "#FFFFFF",
  },
  topic: {
    fontSize: moderateScale(16),
  },
  preview: {
    fontSize: moderateScale(15),
    fontWeight: "600",
    color: GameColors.text,
    lineHeight: moderateScale(22),
  },
  previewCompleted: {
    color: GameColors.textMuted,
  },
  lockedHint: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: GameColors.textMuted,
    fontStyle: "italic",
  },
});
