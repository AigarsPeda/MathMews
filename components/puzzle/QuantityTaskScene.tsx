import { VisualPracticeBoard } from "@/components/puzzle/VisualPracticeBoard";
import { GameColors } from "@/constants/game";
import type { QuantityTaskModel } from "@/types/puzzle";
import { getQuantityTaskHeight, getQuantityTaskTokens } from "@/utils/quantity-task-scene";
import { moderateScale } from "@/utils/scale";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function QuantityTaskScene({ model, disabled }: { model: QuantityTaskModel; disabled: boolean }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const sharing = model.kind === "share";
  const finished = sharing ? (step + 1) * model.groups > model.items : step > 0;
  const prompt = sharing ? `${model.items} ÷ ${model.groups} = ?`
    : model.kind === "array" ? `${model.rows} × ${model.columns} = ?`
    : `${model.left} ${model.kind === "join" ? "+" : "−"} ${model.right} = ?`;
  const description = sharing
    ? t("taskScenes.shareDescription", { remaining: model.items - step * model.groups, groups: model.groups, each: step })
    : model.kind === "array" ? t(step ? "taskScenes.arrayBuilt" : "taskScenes.arrayReady", { rows: model.rows, columns: model.columns })
    : t(`taskScenes.${model.kind}${step ? "Done" : "Ready"}`, { left: model.left, right: model.right });
  return <View style={styles.wrap}>
    <View accessible accessibilityRole="image" accessibilityLabel={description}>
      <VisualPracticeBoard compact boardHeight={getQuantityTaskHeight(model)} prompt={prompt} tokens={getQuantityTaskTokens(model, step)} />
    </View>
    <Text style={styles.caption} accessibilityLiveRegion="polite">{description}</Text>
    <View style={styles.controls}>
      <Pressable disabled={disabled || (sharing && finished)} accessibilityRole="button"
        accessibilityState={{ disabled: disabled || (sharing && finished) }}
        onPress={() => setStep(current => sharing ? current + 1 : current ? 0 : 1)}
        style={({ pressed }) => [styles.button, (disabled || (sharing && finished)) && styles.disabled, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>{t(!sharing && finished ? "taskScenes.reset" : `taskScenes.${model.kind}Action`, model.kind === "take_away" ? { count: model.right } : {})}</Text>
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
  wrap: { gap: moderateScale(10), marginBottom: moderateScale(6) },
  caption: { color: GameColors.textMuted, fontSize: moderateScale(14), lineHeight: moderateScale(20), textAlign: "center" },
  controls: { flexDirection: "row", gap: moderateScale(10) },
  button: { flex: 1, minHeight: moderateScale(48), padding: moderateScale(12), borderRadius: moderateScale(12), backgroundColor: "#E3FAF7", alignItems: "center", justifyContent: "center" },
  buttonText: { color: GameColors.secondaryDark, fontSize: moderateScale(16), fontWeight: "800", textAlign: "center" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});
