import { AppIcon } from "@/components/ui/AppIcon";
import type { AppIconName } from "@/constants/app-icons";
import { GameColors } from "@/constants/game";
import { useLocale } from "@/contexts/LocaleProvider";
import type { LearningLesson } from "@/types/curriculum";
import { getLessonProgress, type LessonActivity, type LessonProgressSave } from "@/utils/lesson-progress";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const activityIcons: Record<LessonActivity["kind"], AppIconName> = { practice: "practice-book", challenge: "challenge-timer", boss: "boss-badge" };
const activityColors = { practice: GameColors.secondaryDark, challenge: "#5D408C", boss: GameColors.coinText };

export function LessonListItem({ lesson, number, progress, onPress }: {
  lesson: LearningLesson; number: number; progress: LessonProgressSave; onPress: () => void;
}) {
  const { locale } = useLocale(), { t } = useTranslation();
  const [compact, setCompact] = useState(false);
  const status = getLessonProgress(lesson, progress);
  const statusText = t(`lessonProgress.${status.status}`);
  const activityLabels = status.parts.map(part => {
    const state = part.complete ? "done" : part.locked ? "locked" : part.started ? "started" : "notStarted";
    return t("lessonProgress.activitySummary", { activity: t(`lessonProgress.${part.kind}`), count: part.solved, total: part.total, state: t(`lessonProgress.${state}`) });
  });
  return <Pressable onPress={onPress} disabled={!status.available} accessibilityRole="button"
    accessibilityState={{ disabled: !status.available }}
    accessibilityLabel={[t("learning.lessonNumber", { number }), lesson.title[locale], statusText, ...activityLabels, t("lessonProgress.optionalChallenge")].join(". ")}
    style={({ pressed }) => [styles.lesson, !status.available && styles.locked, pressed && styles.pressed]}>
    <View style={styles.heading}>
      <Text style={styles.lessonNumber}>{t("learning.lessonNumber", { number })}</Text>
      <View style={styles.status}>
        {status.requiredComplete ? <AppIcon name="lesson-medal" size={moderateScale(20)} /> : null}
        <Text style={[styles.statusText, status.requiredComplete && styles.completeText,
          status.status === "bossLeft" && { color: GameColors.coinText }, status.status === "challengeLeft" && { color: activityColors.challenge }]}>{statusText}</Text>
      </View>
    </View>
    <View style={styles.titleRow}>
      <Text style={styles.title}>{lesson.title[locale]}</Text>
      <AppIcon name={status.available ? "chevron-right" : "lock"} size={moderateScale(22)} />
    </View>
    <View style={styles.activities} onLayout={event => setCompact(event.nativeEvent.layout.width < moderateScale(340))}
      importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {status.parts.filter(part => part.total > 0).map(part => <View key={part.kind} style={styles.activity}>
        <View style={[styles.activityHeading, compact && styles.compactHeading]}>
          <AppIcon name={activityIcons[part.kind]} size={moderateScale(26)} />
          <Text style={[styles.activityLabel, compact && styles.compactLabel]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.85}>{t(`lessonProgress.${part.kind}`)}</Text>
        </View>
        <View style={styles.segments}>{Array.from({ length: part.total }, (_, index) => <View key={index}
          style={[styles.segment, index < part.solved && { backgroundColor: activityColors[part.kind], borderColor: activityColors[part.kind] }]} />)}</View>
        <View style={styles.activityFooter}>
          {part.complete || part.locked ? <AppIcon name={part.complete ? "check" : "lock"} size={moderateScale(14)} /> : null}
          <Text style={[styles.activityCount, part.complete && { color: activityColors[part.kind] }]}>
            {part.started && !part.solved ? t("lessonProgress.startedShort") : `${part.solved}/${part.total}`}
          </Text>
          {part.kind === "challenge" ? <Text style={styles.optional}>{t("lessonProgress.optional")}</Text> : null}
        </View>
      </View>)}
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  lesson: { padding: moderateScale(16), gap: moderateScale(12), borderWidth: 2, borderColor: GameColors.cardBorder,
    borderRadius: moderateScale(16), backgroundColor: GameColors.card },
  locked: { opacity: .65 }, pressed: { opacity: .8 },
  heading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: moderateScale(12) },
  lessonNumber: { color: GameColors.textMuted, fontSize: moderateScale(13), fontWeight: "600" },
  status: { flexDirection: "row", gap: moderateScale(5), alignItems: "center" },
  statusText: { flexShrink: 1, color: GameColors.textMuted, fontSize: moderateScale(12), fontWeight: "700" }, completeText: { color: GameColors.success },
  titleRow: { flexDirection: "row", alignItems: "center", gap: moderateScale(12) },
  title: { flex: 1, color: GameColors.text, fontSize: moderateScale(19), fontWeight: "800" },
  activities: { flexDirection: "row", gap: moderateScale(14) }, activity: { flex: 1, minWidth: 0, gap: moderateScale(7) },
  activityHeading: { flexDirection: "row", alignItems: "center", gap: moderateScale(5) },
  compactHeading: { flexDirection: "column", alignItems: "flex-start" },
  activityLabel: { flexShrink: 1, color: GameColors.text, fontSize: moderateScale(12), lineHeight: moderateScale(17), fontWeight: "600" },
  compactLabel: { alignSelf: "stretch" },
  segments: { flexDirection: "row", gap: moderateScale(4) },
  segment: { flex: 1, height: moderateScale(6), borderRadius: moderateScale(3), borderWidth: 1, borderColor: GameColors.cardBorder, backgroundColor: GameColors.card },
  activityFooter: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: moderateScale(3) },
  activityCount: { color: GameColors.textMuted, fontSize: moderateScale(12), fontWeight: "700", fontVariant: ["tabular-nums"] },
  optional: { color: GameColors.textMuted, fontSize: moderateScale(10) },
});
