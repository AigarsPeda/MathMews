import { AppIcon } from "@/components/ui/AppIcon";
import { GameColors } from "@/constants/game";
import { useLocale } from "@/contexts/LocaleProvider";
import type { LearningLevel } from "@/types/curriculum";
import { formatChallengeTime } from "@/utils/timed-challenge";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function ChallengeClock({ milliseconds }: { milliseconds: number }) {
  const { t } = useTranslation();
  const time = formatChallengeTime(milliseconds);
  return <View style={styles.clock} accessible accessibilityRole="timer" accessibilityLabel={t("timedChallenge.remaining", { time })}>
    <AppIcon name="challenge-timer" size={moderateScale(24)} />
    <Text style={styles.clockLabel}>{t("timedChallenge.timeLeft")}</Text>
    <Text style={[styles.clockTime, milliseconds <= 30000 && styles.urgent]}>{time}</Text>
  </View>;
}

type IntroProps = {
  level: LearningLevel; expired: boolean; lifeLost: boolean; hasLives: boolean; otherActive: boolean;
  onStart: () => void; onResume: () => void; onRefill: () => void; onHelp?: () => void;
};
export function TimedChallengeIntro({ level, expired, lifeLost, otherActive }: IntroProps) {
  const { t } = useTranslation(), { locale } = useLocale();
  return <View style={styles.intro}>
    <AppIcon name="challenge-timer" size={moderateScale(72)} />
    <Text style={styles.title} accessibilityRole="header">{t(expired ? "timedChallenge.expired" : "timedChallenge.title")}</Text>
    <Text style={styles.description}>{expired ? t(lifeLost ? "timedChallenge.lifeUsed" : "timedChallenge.attemptEnded") : level.description[locale]}</Text>
    <Text style={styles.duration}>{t("timedChallenge.limit", { time: formatChallengeTime((level.timeLimitSeconds ?? 0) * 1000) })}</Text>
    <Text style={styles.description}>{t("timedChallenge.rules")}</Text>
    <Text style={styles.note}>{t("timedChallenge.keepsRunning")}</Text>
    {otherActive ? <Text style={styles.note}>{t("timedChallenge.otherActive")}</Text> : null}
  </View>;
}

export function TimedChallengeActions({ expired, hasLives, otherActive, onStart, onResume, onRefill, onHelp }: IntroProps) {
  const { t } = useTranslation();
  return <View style={styles.actions}>
    <Pressable accessibilityRole="button" onPress={otherActive ? onResume : hasLives ? onStart : onRefill} style={styles.start}>
      <Text style={styles.startText}>{t(otherActive ? "timedChallenge.resume" : !hasLives ? "lives.openRefill" : expired ? "timedChallenge.retry" : "timedChallenge.start")}</Text>
    </Pressable>
    {onHelp ? <Pressable accessibilityRole="button" onPress={onHelp} style={styles.help}><Text style={styles.helpText}>{t("visualHelp.compactButton")}</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  clock: { flexDirection: "row", alignItems: "center", gap: moderateScale(8), paddingVertical: moderateScale(6) },
  clockLabel: { flex: 1, color: GameColors.textMuted, fontSize: moderateScale(14), fontWeight: "600" },
  clockTime: { color: "#5D408C", fontSize: moderateScale(20), fontWeight: "800", fontVariant: ["tabular-nums"] },
  urgent: { color: GameColors.primary },
  intro: { alignItems: "center", gap: moderateScale(14), padding: moderateScale(20), borderRadius: moderateScale(16), borderWidth: 2, borderColor: "#BBA4E6", backgroundColor: "#F3EEFF" },
  title: { color: "#5D408C", fontSize: moderateScale(24), fontWeight: "800", textAlign: "center" },
  description: { color: GameColors.text, fontSize: moderateScale(16), lineHeight: moderateScale(24), textAlign: "center" },
  duration: { color: "#5D408C", fontSize: moderateScale(22), fontWeight: "800", fontVariant: ["tabular-nums"], textAlign: "center" },
  note: { color: "#5D408C", fontSize: moderateScale(14), lineHeight: moderateScale(21), textAlign: "center" },
  start: { width: "100%", minHeight: moderateScale(56), padding: moderateScale(14), borderRadius: moderateScale(16), alignItems: "center", justifyContent: "center", backgroundColor: GameColors.primary },
  startText: { color: "white", fontSize: moderateScale(18), fontWeight: "800", textAlign: "center" },
  help: { minHeight: moderateScale(44), justifyContent: "center", paddingHorizontal: moderateScale(12) },
  helpText: { color: "#5D408C", fontWeight: "700", fontSize: moderateScale(16) },
  actions: { gap: moderateScale(4), alignItems: "center" },
});
