import { PuzzleText as Text } from "@/components/puzzle/PuzzleText";
import { VisualPracticeBoard } from "@/components/puzzle/VisualPracticeBoard";
import { PuzzleCatPortrait } from "@/components/puzzle/PuzzleCatPortrait";
import { PuzzleColors as GameColors } from "@/constants/puzzle-theme";
import type { QuantityTaskModel } from "@/types/puzzle";
import { getQuantityTaskHeight, getQuantityTaskTokens } from "@/utils/quantity-task-scene";
import { moderateScale } from "@/utils/scale";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

export function QuantityTaskScene({ model, disabled, showExpression = true }: { model: QuantityTaskModel; disabled: boolean; showExpression?: boolean }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const sharing = model.kind === "share";
  const sceneKeys = model.object ? "objectScenes" : "taskScenes";
  const objects = model.object ? t(`taskObjects.${model.object}`) : "";
  const finished = sharing ? step >= Math.floor(model.items / model.groups) * model.groups : step > 0;
  const prompt = sharing ? `${model.items} ÷ ${model.groups} = ?`
    : model.kind === "array" ? `${model.rows} × ${model.columns} = ?`
    : `${model.left} ${model.kind === "join" ? "+" : "−"} ${model.right} = ?`;
  const description = sharing
    ? t('actionMotion.sharing', { remaining: model.items - step, counts: Array.from({ length: model.groups }, (_, i) => Math.floor(step / model.groups) + (i < step % model.groups ? 1 : 0)).join(' · ') })
    : model.kind === "array" ? t(`${sceneKeys}.${step ? "arrayBuilt" : "arrayReady"}`, { rows: model.rows, columns: model.columns, objects })
    : t(`${sceneKeys}.${model.kind}${step ? "Done" : "Ready"}`, { left: model.left, right: model.right, objects });
  return <View style={styles.wrap}>

    <View accessible accessibilityRole="image" accessibilityLabel={description} accessibilityLiveRegion="polite">
      <VisualPracticeBoard compact durationMs={sharing ? 280 : undefined} staggerMs={sharing ? 0 : undefined} boardHeight={getQuantityTaskHeight(model)} prompt={showExpression ? prompt : undefined} tokens={getQuantityTaskTokens(model, step, sharing ? step : undefined)} />
    </View>
    {sharing || model.kind === "array" ? <View style={styles.captionRow}>
      {sharing ? <View pointerEvents="none"><PuzzleCatPortrait replayKey={step} petType="cat" mood="idle" reaction={step > 0 && !disabled ? 'puzzleHighPaw' : undefined} size={32} brief /></View> : null}
      <Text style={styles.caption} accessibilityLiveRegion="polite">{description}</Text>
    </View> : null}
    <View style={styles.controls}>
      <Pressable disabled={disabled || (sharing && finished)} accessibilityRole="button"
        accessibilityState={{ disabled: disabled || (sharing && finished) }}
        onPress={() => setStep(current => sharing ? current + 1 : current ? 0 : 1)}
        style={({ pressed }) => [styles.button, (disabled || (sharing && finished)) && styles.disabled, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>{t(sharing ? 'actionMotion.giveOne' : finished ? "taskScenes.reset" : model.object && model.kind === "join" ? "objectScenes.joinAction" : `taskScenes.${model.kind}Action`, model.kind === "take_away" ? { count: model.right } : {})}</Text>
      </Pressable>
      {sharing ? <Pressable disabled={disabled || step === 0} accessibilityRole="button"
        accessibilityState={{ disabled: disabled || step === 0 }} onPress={() => setStep(0)}
        style={({ pressed }) => [styles.button, (disabled || step === 0) && styles.disabled, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>{t("taskScenes.reset")}</Text>
      </Pressable> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { gap: moderateScale(6) },
  caption: { flex: 1, color: GameColors.textMuted, fontSize: moderateScale(14), lineHeight: moderateScale(20), textAlign: "center" },
  controls: { flexDirection: "row", gap: moderateScale(10) },
  button: { flex: 1, minHeight: moderateScale(48), padding: moderateScale(12), borderRadius: moderateScale(12), borderWidth: 1, borderColor: GameColors.primary, backgroundColor: GameColors.selectedSurface, alignItems: "center", justifyContent: "center" },
  buttonText: { color: GameColors.secondaryDark, fontSize: moderateScale(16), fontWeight: "800", textAlign: "center" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});
