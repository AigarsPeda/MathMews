import { TOPIC_EMOJI } from "@/constants/topics";
import { GameColors } from "@/constants/game";
import { useGame } from "@/contexts/GameProvider";
import { useTopicLabel } from "@/hooks/use-topic-label";
import { moderateScale } from "@/utils/scale";
import {
  buildTopicStatsRows,
  findToughestTopicRows,
  summarizeTopicStats,
  type TopicStatsRow,
} from "@/utils/topic-stats";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function triggerHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

function TopicRow({ row }: { row: TopicStatsRow }) {
  const { t } = useTranslation();
  const label = useTopicLabel(row.topic);
  const accuracy = formatPercent(row.accuracy);
  const isWeak = (row.mistakeRate ?? 0) >= 0.4 && row.attempts >= 3;

  return (
    <View style={[styles.row, isWeak && styles.rowWeak]}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowEmoji}>{TOPIC_EMOJI[row.topic]}</Text>
        <View style={styles.rowTitleWrap}>
          <Text style={styles.rowTitle}>{label}</Text>
          {isWeak ? (
            <Text style={styles.weakBadge}>{t("stats.needsPractice")}</Text>
          ) : null}
        </View>
        <Text style={styles.rowAccuracy}>{accuracy}</Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.round((row.accuracy ?? 0) * 100)}%`,
              backgroundColor: isWeak ? GameColors.primary : GameColors.secondary,
            },
          ]}
        />
      </View>
      <Text style={styles.rowMeta}>
        {t("stats.attemptsDetail", {
          correct: row.correct,
          wrong: row.wrong,
          attempts: row.attempts,
        })}
      </Text>
    </View>
  );
}

export default function StatsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { progress } = useGame();

  const rows = useMemo(
    () => buildTopicStatsRows(progress.topicStats),
    [progress.topicStats],
  );
  const summary = useMemo(
    () => summarizeTopicStats(progress.topicStats),
    [progress.topicStats],
  );
  const toughestRows = useMemo(() => findToughestTopicRows(rows), [rows]);

  const handleBack = useCallback(() => {
    triggerHaptic();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/puzzles");
  }, [router]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={handleBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Text style={styles.backText}>{t("common.back")}</Text>
        </Pressable>

        <Text style={styles.title}>{t("stats.title")}</Text>
        <Text style={styles.subtitle}>{t("stats.subtitle")}</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.totalAttempts}</Text>
            <Text style={styles.summaryLabel}>{t("stats.totalAttempts")}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {formatPercent(summary.overallAccuracy)}
            </Text>
            <Text style={styles.summaryLabel}>{t("stats.accuracy")}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.totalWrong}</Text>
            <Text style={styles.summaryLabel}>{t("stats.mistakes")}</Text>
          </View>
        </View>

        {toughestRows.length > 0 ? (
          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>{t("stats.toughestTitle")}</Text>
            <Text style={styles.insightBody}>
              {toughestRows.length === 1
                ? t("stats.toughestBody", {
                    topic: t(`topic.${toughestRows[0].topic}`),
                    wrong: toughestRows[0].wrong,
                    accuracy: formatPercent(toughestRows[0].accuracy),
                  })
                : t("stats.toughestBodyTied", {
                    topics: toughestRows
                      .map((row) => t(`topic.${row.topic}`))
                      .join(", "),
                    wrong: toughestRows[0].wrong,
                    accuracy: formatPercent(toughestRows[0].accuracy),
                  })}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{t("stats.byTopic")}</Text>
        <Text style={styles.sectionHint}>{t("stats.byTopicHint")}</Text>

        {rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t("stats.emptyTitle")}</Text>
            <Text style={styles.emptyBody}>{t("stats.emptyBody")}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {rows.map((row) => (
              <TopicRow key={row.topic} row={row} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: GameColors.background,
  },
  scroll: {
    flex: 1,
  },
  screen: {
    paddingHorizontal: moderateScale(16),
    paddingTop: moderateScale(4),
    paddingBottom: moderateScale(24),
    gap: moderateScale(12),
  },
  backBtn: {
    minHeight: moderateScale(48),
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  backText: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.text,
  },
  title: {
    fontSize: moderateScale(28),
    fontWeight: "800",
    color: GameColors.text,
  },
  subtitle: {
    fontSize: moderateScale(15),
    fontWeight: "500",
    color: GameColors.textMuted,
    lineHeight: moderateScale(22),
    marginBottom: moderateScale(4),
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    paddingVertical: moderateScale(16),
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: moderateScale(4),
    paddingHorizontal: moderateScale(8),
  },
  summaryDivider: {
    width: 1,
    backgroundColor: GameColors.cardBorder,
  },
  summaryValue: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: GameColors.text,
  },
  summaryLabel: {
    fontSize: moderateScale(12),
    fontWeight: "600",
    color: GameColors.textMuted,
    textAlign: "center",
  },
  insightCard: {
    backgroundColor: "#FFF0F0",
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.primary,
    padding: moderateScale(14),
    gap: moderateScale(6),
  },
  insightTitle: {
    fontSize: moderateScale(15),
    fontWeight: "800",
    color: GameColors.primaryDark,
  },
  insightBody: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: GameColors.text,
    lineHeight: moderateScale(20),
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: GameColors.text,
    marginTop: moderateScale(8),
  },
  sectionHint: {
    fontSize: moderateScale(13),
    fontWeight: "500",
    color: GameColors.textMuted,
    marginTop: moderateScale(-4),
  },
  list: {
    gap: moderateScale(10),
  },
  row: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    padding: moderateScale(14),
    gap: moderateScale(8),
  },
  rowWeak: {
    borderColor: GameColors.primary,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(10),
  },
  rowEmoji: {
    fontSize: moderateScale(22),
  },
  rowTitleWrap: {
    flex: 1,
    gap: moderateScale(2),
  },
  rowTitle: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.text,
  },
  weakBadge: {
    fontSize: moderateScale(12),
    fontWeight: "700",
    color: GameColors.primaryDark,
  },
  rowAccuracy: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: GameColors.text,
  },
  barTrack: {
    height: moderateScale(8),
    borderRadius: moderateScale(4),
    backgroundColor: GameColors.background,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: moderateScale(4),
  },
  rowMeta: {
    fontSize: moderateScale(13),
    fontWeight: "500",
    color: GameColors.textMuted,
  },
  emptyCard: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    padding: moderateScale(16),
    gap: moderateScale(6),
  },
  emptyTitle: {
    fontSize: moderateScale(16),
    fontWeight: "800",
    color: GameColors.text,
  },
  emptyBody: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    color: GameColors.textMuted,
    lineHeight: moderateScale(20),
  },
});
