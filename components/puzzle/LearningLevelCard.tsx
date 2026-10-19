import { AppIcon } from "@/components/ui/AppIcon";
import { IconText as Text } from "@/components/ui/IconText";
import { GameColors } from "@/constants/game";
import { getLearningProgress } from "@/constants/curriculum";
import { useLocale } from "@/contexts/LocaleProvider";
import type { LearningLevel } from "@/types/curriculum";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

export function LearningLevelCard({ level, state, completedIds, onPress }: {
  level: LearningLevel; state: "current" | "locked" | "completed"; completedIds: readonly string[]; onPress: () => void;
}) {
  const { locale } = useLocale();
  const { t } = useTranslation();
  const progress = getLearningProgress(level.puzzleIds, completedIds);
  const boss = level.kind === "boss";
  return <Pressable onPress={onPress} disabled={state === "locked"} accessibilityRole="button" accessibilityState={{ disabled: state === "locked" }}
    style={[styles.card, boss ? styles.boss : styles.challenge, state === "locked" && styles.locked]}>
    <View style={styles.heading}>
      <AppIcon name={boss ? "paw" : "brain"} size={moderateScale(36)} />
      <Text style={[styles.kind, boss ? styles.bossText : styles.challengeText]}>{t(boss ? "learning.topicBoss" : "learning.optionalChallenge")}</Text>
      <AppIcon name={state === "locked" ? "lock" : state === "completed" ? "check" : "chevron-right"} size={moderateScale(24)} />
    </View>
    <Text style={styles.title}>{level.title[locale]}</Text>
    <Text style={styles.description}>{level.description[locale]}</Text>
    {boss && <View style={styles.stages}>{level.puzzleIds.map((id, index) => <View key={id} style={[styles.stage, completedIds.includes(id) && styles.stageDone]} accessible accessibilityLabel={t(completedIds.includes(id) ? "learning.stageDone" : "learning.stagePending", { number: index + 1 })}>
      <Text style={styles.stageText}>{completedIds.includes(id) ? t("learning.finished") : t("learning.stageNumber", { number: index + 1 })}</Text>
    </View>)}</View>}
    <Text style={styles.description}>{state === "locked" ? t("learning.bonusLocked") : progress.complete ? t("learning.replay") : boss ? t(progress.solved > 0 ? "learning.resumeBoss" : "learning.bossRequired") : t("learning.optional")}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { padding: moderateScale(18), gap: moderateScale(12), borderWidth: 2, borderRadius: moderateScale(16), marginVertical: moderateScale(6) },
  boss: { backgroundColor: "#FFF3D9", borderColor: "#C99632" },
  challenge: { backgroundColor: "#F3EEFF", borderColor: "#BBA4E6" },
  heading: { flexDirection: "row", gap: moderateScale(12), alignItems: "center" },
  kind: { flex: 1, fontSize: moderateScale(16), fontWeight: "800" },
  bossText: { color: GameColors.coinText }, challengeText: { color: "#5D408C" },
  title: { fontSize: moderateScale(22), fontWeight: "800", color: GameColors.text },
  description: { fontSize: moderateScale(15), lineHeight: moderateScale(22), color: GameColors.text },
  locked: { opacity: 0.65 },
  stages: { flexDirection: "row", flexWrap: "wrap", gap: moderateScale(8) },
  stage: { padding: moderateScale(10), backgroundColor: GameColors.card, borderRadius: moderateScale(10) },
  stageDone: { backgroundColor: "#D9EFDF" },
  stageText: { color: GameColors.text, fontSize: moderateScale(14), fontWeight: "700" },
});
