import { VisualExplanationScene } from "@/components/puzzle/VisualExplanationScene";
import { GameColors } from "@/constants/game";
import { progressForVisualHelpStep } from "@/constants/visual-explanations";
import type { VisualExplanation } from "@/types/visual-explanation";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

type VisualExplanationPlayerProps = {
  explanation: VisualExplanation;
  progress: number;
  onProgressChange: (value: number) => void;
  stepByStep?: boolean;
};

export function VisualExplanationPlayer({ explanation, progress, onProgressChange, stepByStep = false }: VisualExplanationPlayerProps) {
  const { t } = useTranslation();
  const stepCount = explanation.keyframes.length;
  const activeStep = Math.max(0, Math.min(stepCount - 1, Math.round(progress * (stepCount - 1))));
  const frame = explanation.keyframes[activeStep];
  const nextKey = stepByStep ? "visualHelp.numberLine.next" : "visualHelp.next";
  return (
    <View style={styles.wrap}>
      <View style={styles.stageHost}>
        {/* Keep the scene mounted so objects travel between their old and new positions. */}
        <VisualExplanationScene scene={frame.scene} />
      </View>
      <View style={styles.captionHost}>
        <Text style={styles.caption} accessibilityLiveRegion="polite">{t(frame.captionKey)}</Text>
      </View>
      <View style={styles.controls}>
        <Pressable onPress={() => onProgressChange(0)} disabled={activeStep === 0}
          style={[styles.button, activeStep === 0 && styles.disabled]} accessibilityRole="button"
          accessibilityState={{ disabled: activeStep === 0 }} accessibilityLabel={t("visualHelp.numberLine.replay")}>
          <Text style={styles.buttonText}>{t("visualHelp.numberLine.replay")}</Text>
        </Pressable>
        <Text style={styles.counter}>{t("visualHelp.numberLine.stepCount", { count: activeStep, total: stepCount - 1 })}</Text>
        <Pressable onPress={() => onProgressChange(progressForVisualHelpStep(activeStep + 1, stepCount))} disabled={activeStep === stepCount - 1}
          style={[styles.button, activeStep === stepCount - 1 && styles.disabled]} accessibilityRole="button"
          accessibilityState={{ disabled: activeStep === stepCount - 1 }} accessibilityLabel={t(nextKey)}>
          <Text style={styles.buttonText}>{t(nextKey)}</Text>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { width: "100%", gap: moderateScale(16) },
  stageHost: { width: "100%", minHeight: moderateScale(220), justifyContent: "center" },
  captionHost: { minHeight: moderateScale(48), justifyContent: "center" },
  caption: { fontSize: moderateScale(17), fontWeight: "700", color: GameColors.text, textAlign: "center", lineHeight: moderateScale(24) },
  controls: { flexDirection: "row", alignItems: "center", gap: moderateScale(8) },
  button: { flex: 1, minHeight: moderateScale(48), paddingHorizontal: moderateScale(8), borderRadius: moderateScale(12), backgroundColor: GameColors.card, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: moderateScale(15), fontWeight: "700", color: GameColors.primary, textAlign: "center" },
  counter: { fontSize: moderateScale(14), fontWeight: "600", color: GameColors.textMuted, textAlign: "center", flexShrink: 1 },
  disabled: { opacity: .35 },
});
