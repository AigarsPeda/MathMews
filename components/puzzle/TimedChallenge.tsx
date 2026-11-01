import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { PuzzleButton } from "@/components/puzzle/PuzzleButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { PuzzleColors as GameColors } from "@/constants/puzzle-theme";
import type { LearningLevel } from "@/types/curriculum";
import { formatChallengeTime } from "@/utils/timed-challenge";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

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
  mode?: "timed" | "untimed"; onModeChange?: (mode: "timed" | "untimed") => void;
  level: LearningLevel; expired: boolean; lifeLost: boolean; hasLives: boolean; otherActive: boolean;
  onStart: () => void; onResume: () => void; onRefill: () => void; onHelp?: () => void;
};
export function TimedChallengeIntro({ level, expired, lifeLost, otherActive, mode = "timed", onModeChange }: IntroProps) {
  const { t } = useTranslation();
  return <View style={styles.intro}>
    <AppIcon name="challenge-timer" size={moderateScale(56)} />
    <Text style={styles.title} accessibilityRole="header">{t(expired ? "timedChallenge.expired" : "puzzlePathDesign.yourPace")}</Text>
    {expired ? <Text style={styles.description}>{t(lifeLost ? "timedChallenge.lifeUsed" : "timedChallenge.attemptEnded")}</Text> : null}
    {otherActive ? <Text style={styles.note}>{t("puzzlePathDesign.otherActive")}</Text> : <>
      <View style={styles.modes}>
        {(["untimed", "timed"] as const).map(value => <Pressable key={value} onPress={() => onModeChange?.(value)}
          accessibilityRole="radio" accessibilityState={{ checked: mode === value }}
          style={[styles.mode, mode === value && styles.selectedMode]}>
          <Text style={styles.modeText}>{value === "untimed" ? t("puzzlePathDesign.noTimer") : formatChallengeTime((level.timeLimitSeconds ?? 0) * 1000)}</Text>
        </Pressable>)}
      </View>
      <Text style={styles.description}>{t("puzzlePathDesign.sameProgress")}</Text>
      {mode === "timed" ? <Text style={styles.note}>{t("puzzlePathDesign.timerRules")}</Text> : null}
    </>}
  </View>;
}

export function TimedChallengeActions({ expired, hasLives, otherActive, onStart, onResume, onRefill, onHelp }: IntroProps) {
  const { t } = useTranslation();
  return <View style={styles.actions}>
    <PuzzleButton onPress={otherActive ? onResume : hasLives ? onStart : onRefill}
      label={t(otherActive ? "timedChallenge.resume" : !hasLives ? "lives.openRefill" : expired ? "timedChallenge.retry" : "timedChallenge.start")} />
    {onHelp ? <Pressable accessibilityRole="button" onPress={onHelp} style={styles.help}><Text style={styles.helpText}>{t("visualHelp.compactButton")}</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  modes: { flexDirection: "row", gap: 10, alignSelf: "stretch" },
  mode: { flex: 1, minHeight: 58, alignItems: "center", justifyContent: "center", padding: 10, backgroundColor: "white", borderWidth: 2, borderColor: "#DBD3E8", borderRadius: 16 },
  selectedMode: { borderColor: GameColors.primary, backgroundColor: "#FFF0F6" },
  modeText: { color: GameColors.text, fontSize: moderateScale(17), fontWeight: "800" },
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
