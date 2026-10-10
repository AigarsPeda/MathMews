import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import Slider from "@react-native-community/slider";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type Props = {
  name: string; degrees: number; simpleGraphics: boolean;
  placementAllowed?: boolean;
  onPreview: (angle: number) => void; onApply: (angle: number) => void; onClose: () => void;
};

/** Preview locally; one saved update when the user applies the angle. */
export function RoomRotationControls({ name, degrees, simpleGraphics, placementAllowed = true, onPreview, onApply, onClose }: Props) {
  const { t } = useTranslation();
  const [angle, setAngle] = useState(degrees);
  const [input, setInput] = useState(String(degrees));
  const change = (value: number) => {
    const next = Math.round(Math.max(0, Math.min(360, value)) * 10) / 10;
    setAngle(next); setInput(String(next)); onPreview(next);
  };
  const parsed = Number(input.replace(",", "."));
  const valid = input.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= 360 && placementAllowed;
  return <View style={styles.content}>
      <Text style={styles.title} numberOfLines={1} accessibilityRole={!placementAllowed ? "alert" : undefined}>
        {t(!placementAllowed ? "home.itemNeedsSpace" : "home.rotateSelectedItem", { name })}
      </Text>
      <View style={styles.row}>
        <Slider style={styles.slider} value={angle} minimumValue={0} maximumValue={360} step={.1} tapToSeek onValueChange={change}
          minimumTrackTintColor={GameColors.secondary} maximumTrackTintColor={GameColors.cardBorder}
          thumbTintColor={GameColors.secondary} accessibilityRole="adjustable" accessibilityLabel={t("home.rotateSelectedItem", { name })}
          accessibilityValue={{ min: 0, max: 360, now: angle, text: `${angle}°` }} />
        <TextInput style={styles.input} value={input} keyboardType="decimal-pad" selectTextOnFocus
          accessibilityLabel={t("home.rotationAngle")} accessibilityHint={t("home.rotationRange")}
          onChangeText={text => {
            setInput(text);
            const value = Number(text.replace(",", "."));
            if (text.trim() && Number.isFinite(value) && value >= 0 && value <= 360) { setAngle(value); onPreview(value); }
          }} />
        <Text style={styles.label}>°</Text>
      </View>
      {simpleGraphics && <Text style={styles.hint}>{t("home.rotationSimpleHint")}</Text>}
      <View style={styles.row}>
        <Pressable style={styles.button} onPress={() => { Keyboard.dismiss(); onClose(); }} accessibilityRole="button"><Text style={styles.label}>{t("common.cancel")}</Text></Pressable>
        <Pressable style={[styles.button, styles.apply, !valid && styles.disabled]} disabled={!valid}
          accessibilityRole="button" accessibilityState={{ disabled: !valid }} onPress={() => { Keyboard.dismiss(); onApply(parsed); }}>
          <Text style={styles.applyText}>{t("home.applyRotation")}</Text>
        </Pressable>
      </View>
    </View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: moderateScale(12), paddingVertical: 8, gap: 8 },
  title: { fontSize: moderateScale(16), fontWeight: "700", color: GameColors.text },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  slider: { flex: 1, minHeight: 44 },
  label: { fontSize: moderateScale(15), color: GameColors.text },
  input: { width: 64, minHeight: 44, borderWidth: 1, borderColor: GameColors.cardBorder, borderRadius: 10, textAlign: "center", fontSize: 18, color: GameColors.text, backgroundColor: GameColors.background },
  hint: { color: GameColors.textMuted, fontSize: 14 },
  button: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: GameColors.background },
  apply: { backgroundColor: GameColors.secondary },
  applyText: { color: GameColors.text, fontSize: moderateScale(15), fontWeight: "700" },
  disabled: { opacity: .4 },
});
