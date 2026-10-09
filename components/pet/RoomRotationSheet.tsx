import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { GameColors } from "@/constants/game";
import Slider from "@react-native-community/slider";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type Props = {
  visible: boolean;
  name: string; degrees: number; simpleGraphics: boolean;
  placementAllowed?: boolean;
  onPreview: (angle: number) => void; onApply: (angle: number) => void; onClose: () => void;
};

export function RoomRotationSheet({ visible, ...props }: Props) {
  return <AppBottomSheet visible={visible} onClose={props.onClose}>
    {visible && <RotationControls {...props} />}
  </AppBottomSheet>;
}

/** Preview locally; one saved update when the user applies the angle. */
function RotationControls({ name, degrees, simpleGraphics, placementAllowed = true, onPreview, onApply, onClose }: Omit<Props, "visible">) {
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
      <Text style={styles.title}>{t("home.rotateSelectedItem", { name })}</Text>
      <View style={styles.row}>
        <Text style={styles.label}>{t("home.rotationAngle")}</Text>
        <TextInput style={styles.input} value={input} keyboardType="decimal-pad" selectTextOnFocus
          accessibilityLabel={t("home.rotationAngle")} accessibilityHint={t("home.rotationRange")}
          onChangeText={text => {
            setInput(text);
            const value = Number(text.replace(",", "."));
            if (text.trim() && Number.isFinite(value) && value >= 0 && value <= 360) { setAngle(value); onPreview(value); }
          }} />
        <Text style={styles.label}>°</Text>
      </View>
      <Slider value={angle} minimumValue={0} maximumValue={360} step={.1} tapToSeek onValueChange={change}
        minimumTrackTintColor={GameColors.secondary} maximumTrackTintColor={GameColors.cardBorder}
        thumbTintColor={GameColors.secondary} accessibilityRole="adjustable" accessibilityLabel={t("home.rotateSelectedItem", { name })}
        accessibilityValue={{ min: 0, max: 360, now: angle, text: `${angle}°` }} />
      <View style={styles.range}><Text style={styles.label}>0°</Text><Text style={styles.label}>360°</Text></View>
      {simpleGraphics && <Text style={styles.hint}>{t("home.rotationSimpleHint")}</Text>}
      {!placementAllowed && <Text style={styles.hint} accessibilityRole="alert">{t("home.itemNeedsSpace")}</Text>}
      <View style={styles.row}>
        <Pressable style={styles.button} onPress={onClose} accessibilityRole="button"><Text style={styles.label}>{t("common.cancel")}</Text></Pressable>
        <Pressable style={[styles.button, styles.apply, !valid && styles.disabled]} disabled={!valid}
          accessibilityRole="button" accessibilityState={{ disabled: !valid }} onPress={() => onApply(parsed)}>
          <Text style={styles.applyText}>{t("home.applyRotation")}</Text>
        </Pressable>
      </View>
    </View>;
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: "700", color: GameColors.text },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  label: { fontSize: 16, color: GameColors.text },
  input: { marginLeft: "auto", width: 88, minHeight: 48, borderWidth: 1, borderColor: GameColors.cardBorder, borderRadius: 10, textAlign: "center", fontSize: 18, color: GameColors.text, backgroundColor: GameColors.background },
  range: { flexDirection: "row", justifyContent: "space-between" },
  hint: { color: GameColors.textMuted, fontSize: 14 },
  button: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: GameColors.background },
  apply: { backgroundColor: GameColors.secondary },
  applyText: { color: "white", fontSize: 16, fontWeight: "700" },
  disabled: { opacity: .4 },
});
