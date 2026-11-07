import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { PuzzleButton } from "@/components/puzzle/PuzzleButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { PuzzleColors as GameColors } from "@/constants/puzzle-theme";
import type { LearningLevel } from "@/types/curriculum";
import { formatChallengeTime, getTimedRunPuzzleIds } from "@/utils/timed-challenge";
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
  title?: string; description?: string;
  mode?: "timed" | "untimed"; onModeChange?: (mode: "timed" | "untimed") => void;
  level: LearningLevel; expired: boolean; lifeLost: boolean; hasLives: boolean; otherActive: boolean;
  onStart: () => void; onResume: () => void; onRefill: () => void;
};
export function TimedChallengeIntro({ level, title, description, expired, lifeLost, otherActive, mode = "timed", onModeChange }: IntroProps) {
  const { t } = useTranslation();
  return <View style={styles.intro}>
    <Text style={styles.title} accessibilityRole="header">{expired ? t("timedChallenge.expired") : title ?? t("timedChallenge.finishLevel")}</Text>
    {description && !expired ? <Text style={styles.description}>{description}</Text> : null}
    {expired ? <Text style={styles.description}>{t(lifeLost ? "timedChallenge.lifeUsed" : "timedChallenge.attemptEnded")}</Text> : null}
    {otherActive ? <Text style={styles.note}>{t("puzzlePathDesign.otherActive")}</Text> : <>
      <View style={styles.modes}>
        {(["untimed", "timed"] as const).map(value => <Pressable key={value} onPress={() => onModeChange?.(value)}
          testID={`pace-${value}`} accessibilityLabel={value === "untimed" ? t("puzzlePathDesign.noTimer") : t("timedChallenge.limit", { time: formatChallengeTime((level.timeLimitSeconds ?? 0) * 1000) })}
          accessibilityRole="radio" accessibilityState={{ checked: mode === value }}
          style={[styles.mode, mode === value && styles.selectedMode]}>
          <Text style={styles.modeText}>{value === "untimed" ? t("puzzlePathDesign.noTimer") : formatChallengeTime((level.timeLimitSeconds ?? 0) * 1000)}</Text>
        </Pressable>)}
      </View>
      <Text style={styles.description}>{t(mode === "timed" ? "timedChallenge.doubleReward" : "puzzlePathDesign.sameProgress", { count: getTimedRunPuzzleIds(level).length })}</Text>
      {mode === "timed" ? <Text style={styles.note}>{t("puzzlePathDesign.timerRules")}</Text> : null}
    </>}
  </View>;
}

export function TimedChallengeActions({ expired, hasLives, otherActive, onStart, onResume, onRefill }: IntroProps) {
  const { t } = useTranslation();
  return <View style={styles.actions}>
    <PuzzleButton onPress={otherActive ? onResume : hasLives ? onStart : onRefill}
      label={t(otherActive ? "timedChallenge.resume" : !hasLives ? "lives.openRefill" : expired ? "timedChallenge.retry" : "timedChallenge.start")} />
  </View>;
}

const styles = StyleSheet.create({
  modes: { flexDirection: "row", gap: 10, alignSelf: "stretch" },
  mode: { flex: 1, minHeight: 56, alignItems: "center", justifyContent: "center", padding: 10, backgroundColor: "white", borderWidth: 2, borderColor: GameColors.cardBorder, borderRadius: 16 },
  selectedMode: { borderColor: GameColors.primary, backgroundColor: "#FFF0F6" },
  modeText: { color: GameColors.text, fontSize: moderateScale(17), fontWeight: "800" },
  clock: { flexDirection: "row", alignItems: "center", gap: moderateScale(8), paddingVertical: moderateScale(6) },
  clockLabel: { flex: 1, color: GameColors.textMuted, fontSize: moderateScale(14), fontWeight: "600" },
  clockTime: { color: "#5D408C", fontSize: moderateScale(20), fontWeight: "800", fontVariant: ["tabular-nums"] },
  urgent: { color: GameColors.primary },
  intro: { alignItems: "center", gap: moderateScale(20), paddingVertical: moderateScale(24) },
  title: { color: GameColors.text, fontSize: moderateScale(28), fontWeight: "800", textAlign: "center" },
  description: { color: GameColors.text, fontSize: moderateScale(16), lineHeight: moderateScale(24), textAlign: "center" },
  note: { color: GameColors.textMuted, fontSize: moderateScale(14), lineHeight: moderateScale(21), textAlign: "center" },
  actions: { gap: moderateScale(4), alignItems: "center" },
});
