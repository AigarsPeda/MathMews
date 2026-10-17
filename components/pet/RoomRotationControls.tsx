import { AppIcon } from "@/components/ui/AppIcon";
import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import Slider from "@react-native-community/slider";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type Props = {
  name: string; degrees: number; simpleGraphics: boolean;
  placementAllowed?: boolean;
  onPreview: (angle: number) => void; onCommit: (angle: number) => void; onClose: () => void;
};

/** Preview slider motion locally; keep valid turns when a gesture finishes. */
export function RoomRotationControls({ name, degrees, simpleGraphics, placementAllowed = true, onPreview, onCommit, onClose }: Props) {
  const { t } = useTranslation();
  const [fineTune, setFineTune] = useState(false);
  const [angle, setAngle] = useState(degrees);
  const [input, setInput] = useState(String(degrees));
  const change = (value: number) => {
    const next = Math.round(Math.max(0, Math.min(360, value)) * 10) / 10;
    setAngle(next); setInput(String(next)); onPreview(next);
  };
  return <View style={styles.content}>
      <Text style={styles.title} accessibilityRole={!placementAllowed ? "alert" : undefined}>
        {t(!placementAllowed ? "home.itemNeedsSpace" : "home.rotateSelectedItem", { name })}
      </Text>
      <View style={styles.row}>
        <Pressable style={styles.button} accessibilityRole="button" accessibilityLabel={t("home.turnLeft")}
          onPress={() => { const next = (angle + 270) % 360; change(next); onCommit(next); }}>
          <View style={styles.turnLabel}><AppIcon name="rotate" size={24} style={{ transform: [{ scaleX: -1 }] }} /><Text style={styles.label}>{t("home.turnLeft")}</Text></View>
        </Pressable>
        <Pressable style={styles.button} accessibilityRole="button" accessibilityLabel={t("home.turnRight")}
          onPress={() => { const next = (angle + 90) % 360; change(next); onCommit(next); }}>
          <View style={styles.turnLabel}><AppIcon name="rotate" size={24} /><Text style={styles.label}>{t("home.turnRight")}</Text></View>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: fineTune }}
        onPress={() => setFineTune(current => !current)} style={styles.fineTune}>
        <Text style={styles.hint}>{t("home.fineTuneRotation")} · {angle}°</Text>
        <AppIcon name={fineTune ? "chevron-up" : "chevron-down"} size={18} />
      </Pressable>
      {fineTune && <View style={styles.row}>
        <Slider style={styles.slider} value={angle} minimumValue={0} maximumValue={360} step={.1} tapToSeek onValueChange={change}
          onSlidingComplete={value => { const next = Math.round(value * 10) / 10; change(next); onCommit(next); }}
          minimumTrackTintColor={GameColors.secondary} maximumTrackTintColor={GameColors.cardBorder}
          thumbTintColor={GameColors.secondary} accessibilityRole="adjustable" accessibilityLabel={t("home.rotateSelectedItem", { name })}
          accessibilityValue={{ min: 0, max: 360, now: angle, text: `${angle}°` }} />
        <TextInput style={styles.input} value={input} keyboardType="decimal-pad" selectTextOnFocus
          accessibilityLabel={t("home.rotationAngle")} accessibilityHint={t("home.rotationRange")}
          onChangeText={text => {
            setInput(text);
            const value = Number(text.replace(",", "."));
            if (text.trim() && Number.isFinite(value) && value >= 0 && value <= 360) { setAngle(value); onPreview(value); onCommit(value); }
          }} />
        <Text style={styles.label}>°</Text>
      </View>}
      {simpleGraphics && <Text style={styles.hint}>{t("home.rotationSimpleHint")}</Text>}
      <Pressable style={styles.back} onPress={() => { Keyboard.dismiss(); onClose(); }} accessibilityRole="button">
        <AppIcon name="arrow-left" size={20} /><Text style={styles.label}>{t("common.back")}</Text>
      </Pressable>
    </View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: moderateScale(12), paddingVertical: 8, gap: 8 },
  title: { fontSize: moderateScale(16), fontWeight: "700", color: GameColors.text },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  slider: { flex: 1, minHeight: 44 },
  label: { flexShrink: 1, fontSize: moderateScale(15), color: GameColors.text },
  input: { width: 64, minHeight: 44, borderWidth: 1, borderColor: GameColors.cardBorder, borderRadius: 10, textAlign: "center", fontSize: 18, color: GameColors.text, backgroundColor: GameColors.background },
  turnLabel: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  fineTune: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  hint: { color: GameColors.textMuted, fontSize: 14 },
  button: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", padding: 6, borderRadius: 12, backgroundColor: GameColors.background },
  back: { minHeight: 48, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8 },
});
