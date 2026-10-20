import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { AppIcon } from '@/components/ui/AppIcon';
import type { AppIconName } from '@/constants/app-icons';
import { GameColors } from '@/constants/game';
import { useGame } from '@/contexts/GameProvider';
import { useWorldClockNow } from '@/hooks/use-world-clock-now';
import { WORLD_CLOCK_SPEEDS, worldClockReading, type WorldPeriod } from '@/utils/world-clock';
import { moderateScale } from '@/utils/scale';
import { WorldWeatherControl } from './WorldWeatherControl';

const PERIODS: { period: WorldPeriod; hour: number; icon: AppIconName }[] = [
  { period: 'morning', hour: 9, icon: 'weather-sunrise' },
  { period: 'day', hour: 13, icon: 'weather-sun' },
  { period: 'evening', hour: 19, icon: 'weather-sunset' },
  { period: 'night', hour: 23, icon: 'weather-moon' },
];

const SPEED_ICONS = { 1: 'clock-real-time', 60: 'clock-fast', 300: 'clock-very-fast' } as const satisfies Record<(typeof WORLD_CLOCK_SPEEDS)[number], AppIconName>;

export function WorldClockControl({ inline = false }: { inline?: boolean } = {}) {
  const { t } = useTranslation();
  const { worldClock, setWorldClock } = useGame();
  const now = useWorldClockNow();
  const reading = worldClockReading(worldClock, Math.max(now, worldClock.realMs));
  const periodIcon = PERIODS.find(item => item.period === reading.period)!.icon;
  const [open, setOpen] = useState(false);
  return <>
    <View style={inline ? styles.inlineControls : styles.controls} pointerEvents="box-none">
      <Pressable style={({ pressed }) => [styles.badge, inline && styles.toolbarBadge, pressed && styles.pressed]} onPress={() => setOpen(true)} accessibilityRole="button"
        accessibilityLabel={t('worldClock.open', { time: reading.time })}>
        {inline && <Text style={styles.caption} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.85}>{t(`worldClock.${reading.period}`)}</Text>}
        <View style={styles.badgeReading}>
          <AppIcon name={periodIcon} size={moderateScale(inline ? 20 : 18)} />
          <Text style={[styles.time, inline && styles.toolbarTime]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.85}>{reading.time}</Text>
        </View>
      </Pressable>
      <WorldWeatherControl toolbar={inline}/>
    </View>
    <AppBottomSheet visible={open} onClose={() => setOpen(false)} expanded>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">{t('worldClock.title')}</Text>
        <View style={styles.report}>
          <AppIcon name={periodIcon} size={48} />
          <View style={styles.reportText}>
            <Text style={styles.reading}>{reading.time}</Text>
            <Text style={styles.label}>{t(`worldClock.${reading.period}`)}</Text>
          </View>
        </View>
        <Text style={styles.hint}>{t('worldClock.description')}</Text>
        <Text style={styles.label} accessibilityRole="header">{t('worldClock.setTime')}</Text>
        <View style={styles.presets} accessibilityRole="radiogroup" accessibilityLabel={t('worldClock.setTime')}>
          {PERIODS.map(({ period, hour, icon }) => <Pressable key={period}
            style={({ pressed }) => [styles.preset, reading.period === period && styles.selected, pressed && styles.pressed]}
            accessibilityRole="radio" accessibilityLabel={t(`worldClock.${period}`)} accessibilityState={{ selected: reading.period === period }}
            onPress={() => setWorldClock(worldClock.speed, hour * 60)}>
            <AppIcon name={icon} size={28} />
            <Text style={styles.optionText}>{t(`worldClock.${period}`)}</Text>
            {reading.period === period ? <AppIcon name="check" size={16} /> : <View style={styles.presetCheckSpace} />}
          </Pressable>)}</View>
        <Text style={styles.label} accessibilityRole="header">{t('worldClock.speed')}</Text>
        <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={t('worldClock.speed')}>
          {WORLD_CLOCK_SPEEDS.map(speed => <Pressable key={speed}
            style={({ pressed }) => [styles.option, worldClock.speed === speed && styles.selected, pressed && styles.pressed]}
            accessibilityRole="radio" accessibilityLabel={t(`worldClock.speed${speed}`)} accessibilityState={{ selected: worldClock.speed === speed }} onPress={() => setWorldClock(speed)}>
            <View style={styles.speedIcon}><AppIcon name={SPEED_ICONS[speed]} size={36} /></View>
            <Text style={styles.optionText}>{t(`worldClock.speed${speed}`)}</Text>
            {worldClock.speed === speed ? <AppIcon name="check" size={20} /> : <View style={styles.checkSpace} />}
          </Pressable>)}
        </View>
        <Pressable style={({ pressed }) => [styles.close, pressed && styles.pressed]} accessibilityRole="button" onPress={() => setOpen(false)}><Text style={styles.label}>{t('common.close')}</Text></Pressable>
      </ScrollView>
    </AppBottomSheet>
  </>;
}

const styles = StyleSheet.create({
  inlineControls: { flex: 2, minWidth: 0, flexDirection: 'row', gap: moderateScale(8) },
  toolbarBadge: { minHeight: 56, height: undefined, paddingVertical: moderateScale(8), paddingHorizontal: moderateScale(8), gap: moderateScale(3), borderRadius: moderateScale(12) },
  caption: { color: GameColors.textMuted, fontSize: moderateScale(11), fontWeight: '600' },
  toolbarTime: { fontSize: moderateScale(16) },
  controls: { position: 'absolute', top: moderateScale(10), left: moderateScale(130), right: moderateScale(10),
    zIndex: 20, flexDirection: 'row', gap: moderateScale(6) },
  badge: { flex: 1, minWidth: 0, height: moderateScale(44), justifyContent: 'center',
    backgroundColor: GameColors.card, borderColor: GameColors.cardBorder, borderWidth: 1, borderRadius: moderateScale(20), alignItems: 'center' },
  badgeReading: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: moderateScale(4) },
  time: { flexShrink: 1, fontSize: moderateScale(13), fontWeight: '700', color: GameColors.text, fontVariant: ['tabular-nums'] },
  pressed: { backgroundColor: GameColors.background },
  content: { padding: 20, gap: 12 },
  scroll: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', color: GameColors.text },
  report: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  reportText: { flex: 1, gap: 4 },
  reading: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'], color: GameColors.text },
  label: { fontSize: 16, fontWeight: '700', color: GameColors.text },
  hint: { fontSize: 14, lineHeight: 20, color: GameColors.textMuted },
  options: { gap: 8 },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, borderRadius: 12, borderWidth: 2, borderColor: GameColors.cardBorder, backgroundColor: GameColors.card },
  optionText: { flex: 1, fontSize: 16, fontWeight: '700', color: GameColors.text },
  selected: { borderColor: GameColors.secondary },
  speedIcon: { width: 44, height: 36, justifyContent: 'center', alignItems: 'center' },
  checkSpace: { width: 20 },
  presetCheckSpace: { width: 16 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { flexGrow: 1, flexBasis: '45%', minWidth: 0, flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 56, padding: 10,
    borderRadius: 12, borderWidth: 2, borderColor: GameColors.cardBorder, backgroundColor: GameColors.card },
  close: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12,
    borderWidth: 1, borderColor: GameColors.cardBorder, backgroundColor: GameColors.card },
});
