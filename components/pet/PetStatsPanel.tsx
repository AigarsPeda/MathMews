import { MathStatsChip } from "@/components/puzzle/MathStatsChip";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { AppIconName } from "@/constants/app-icons";
import { GameColors } from "@/constants/game";
import { useScreenSettled } from "@/hooks/use-screen-settled";
import type { PetStats } from "@/types/game";
import { clampStat } from "@/utils/pet-care";
import { moderateScale } from "@/utils/scale";
import { Canvas, Circle, matchFont, Path, Skia, Text as SkiaText } from "@shopify/react-native-skia";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Stat = { icon: AppIconName; label: string; value: number; color: string };
const RING_SIZE = moderateScale(48);
const RING_STROKE = moderateScale(4);
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const PERCENT_HEIGHT = moderateScale(16);

function StatRing({ stat, expanded, active, onPress }: { stat: Stat; expanded: boolean; active: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const progress = useSharedValue(stat.value);
  const pulse = useSharedValue(1);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!active) return;
    const changed = progress.get() !== stat.value;
    if (reducedMotion) {
      progress.set(stat.value);
      pulse.set(1);
    } else if (changed) {
      progress.set(withTiming(stat.value, { duration: 900, easing: Easing.inOut(Easing.cubic) }));
      pulse.set(withSequence(
        withTiming(1.07, { duration: 200 }),
        withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
      ));
    }
    return () => { cancelAnimation(progress); cancelAnimation(pulse); };
  }, [stat.value, active, reducedMotion, progress, pulse]);
  const ringEnd = useDerivedValue(() => progress.get() / 100);
  const ringOpacity = useDerivedValue(() => progress.get() > 0 ? 1 : 0);
  const percentText = useDerivedValue(() => `${Math.round(progress.get())}%`);
  const font = useMemo(() => matchFont({ fontSize: moderateScale(12), fontWeight: "700" }), []);
  const percentX = useDerivedValue(() => (RING_SIZE - font.measureText(percentText.get()).width) / 2);
  const metrics = font.getMetrics();
  const percentY = (PERCENT_HEIGHT - metrics.descent - metrics.ascent) / 2;
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));
  const path = useMemo(() => Skia.Path.Make().addArc({
    x: RING_STROKE / 2, y: RING_STROKE / 2,
    width: RING_SIZE - RING_STROKE, height: RING_SIZE - RING_STROKE,
  }, -90, 360), []);
  return (
    <Pressable onPress={onPress} style={styles.gauge}
      accessibilityRole="button" accessibilityLabel={stat.label}
      accessibilityValue={{ min: 0, max: 100, now: stat.value, text: `${stat.value}%` }}
      accessibilityState={{ expanded }} accessibilityHint={t(expanded ? "home.hidePetStats" : "home.showPetStats")}>
      <Animated.View style={[styles.gauge, pulseStyle]} pointerEvents="none">
        <View style={styles.ring}>
          <Canvas style={StyleSheet.absoluteFill}>
            <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
              color={GameColors.background} style="stroke" strokeWidth={RING_STROKE} />
            <Path path={path} end={ringEnd} opacity={ringOpacity} color={stat.color} style="stroke"
              strokeWidth={RING_STROKE} strokeCap="round" />
          </Canvas>
          <AppIcon name={stat.icon} size={moderateScale(28)} />
        </View>
        <Canvas style={styles.percent} accessible={false} importantForAccessibility="no">
          <SkiaText text={percentText} font={font} x={percentX} y={percentY} color={GameColors.text} />
        </Canvas>
      </Animated.View>
    </Pressable>
  );
}

function StatDetails({ values }: { values: Stat[] }) {
  return <View style={styles.details}>
    {values.map(stat => <View key={stat.icon} style={styles.statRow}>
      <AppIcon name={stat.icon} size={moderateScale(28)} />
      <View style={styles.statContent}>
        <View style={styles.statHeader}>
          <Text style={styles.statLabel}>{stat.label}</Text>
          <Text style={styles.statValue}>{stat.value}%</Text>
        </View>
        <ProgressBar progress={stat.value / 100} fillColor={stat.color}
          trackColor={GameColors.background} accessibilityLabel={stat.label} />
      </View>
    </View>)}
  </View>;
}

export function PetStatsPanel({ stats, wisdom, compact = false, visible = true, onOpenMathStats }: {
  stats: PetStats; wisdom: number; compact?: boolean; visible?: boolean; onOpenMathStats?: () => void;
}) {
  const { t } = useTranslation();
  const [showStats, setShowStats] = useState(false);
  const screenSettled = useScreenSettled();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const values: Stat[] = [
    { icon: "feed", label: t("pet.fed"), value: clampStat(stats.hunger), color: GameColors.hunger },
    { icon: "heart", label: t("pet.happiness"), value: clampStat(stats.happiness), color: GameColors.happiness },
    { icon: "lightbulb", label: t("pet.wisdom"), value: clampStat(wisdom), color: GameColors.wisdom },
  ];
  return (
    <View style={styles.panel}>
      {compact ? <View style={styles.summary}>
        <View style={styles.gauges}>
          {values.map(stat => <StatRing key={stat.icon} stat={stat} expanded={showStats} active={visible && screenSettled}
            onPress={() => setShowStats(true)} />)}
        </View>
        {onOpenMathStats ? <MathStatsChip compact onPress={onOpenMathStats} /> : null}
      </View> : null}
      {!compact ? <StatDetails values={values} /> : null}
      {compact ? <AppBottomSheet visible={showStats} onClose={() => setShowStats(false)}>
        <ScrollView style={{ maxHeight: Math.max(0, height / 2 - insets.bottom - moderateScale(80)) }}
          contentContainerStyle={styles.sheetContent}>
          <Text style={styles.sheetTitle} accessibilityRole="header">{t("pet.statsTitle")}</Text>
          <StatDetails values={values} />
          <Pressable onPress={() => setShowStats(false)} accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}>
            <Text style={styles.closeLabel}>{t("common.close")}</Text>
          </Pressable>
        </ScrollView>
      </AppBottomSheet> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: "100%", gap: moderateScale(8) },
  summary: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: moderateScale(12) },
  gauges: { flexDirection: "row", gap: moderateScale(16) },
  gauge: { alignItems: "center", minWidth: RING_SIZE, gap: moderateScale(4) },
  ring: { width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" },
  percent: { width: RING_SIZE, height: PERCENT_HEIGHT },
  details: { gap: moderateScale(8) },
  statRow: { flexDirection: "row", alignItems: "center", gap: moderateScale(10) },
  statContent: { flex: 1, gap: moderateScale(4) },
  statHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statLabel: { fontSize: moderateScale(14), fontWeight: "600", color: GameColors.text },
  statValue: { fontSize: moderateScale(14), fontWeight: "700", color: GameColors.textMuted },
  sheetContent: { padding: moderateScale(16), gap: moderateScale(24) },
  sheetTitle: { fontSize: moderateScale(22), fontWeight: "800", color: GameColors.text },
  closeButton: { minHeight: 48, alignItems: "center", justifyContent: "center", padding: moderateScale(12), borderRadius: moderateScale(14), backgroundColor: GameColors.background },
  closeButtonPressed: { backgroundColor: GameColors.cardBorder },
  closeLabel: { fontSize: moderateScale(16), fontWeight: "700", color: GameColors.text },
});
