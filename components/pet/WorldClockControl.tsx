import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { GameColors } from '@/constants/game';
import { useGame } from '@/contexts/GameProvider';
import { useWorldClockNow } from '@/hooks/use-world-clock-now';
import { WORLD_CLOCK_SPEEDS, worldClockReading } from '@/utils/world-clock';
import { moderateScale } from '@/utils/scale';
import { WorldWeatherControl } from './WorldWeatherControl';

export function WorldClockControl() {
  const { t } = useTranslation();
  const { worldClock, setWorldClock } = useGame();
  const now = useWorldClockNow();
  const reading = worldClockReading(worldClock, Math.max(now, worldClock.realMs));
  const [open, setOpen] = useState(false);
  return <>
    <View style={styles.controls} pointerEvents="box-none">
      <Pressable style={({ pressed }) => [styles.badge, pressed && styles.pressed]} onPress={() => setOpen(true)} accessibilityRole="button"
        accessibilityLabel={t('worldClock.open', { time: reading.time, day: reading.day })}>
        <Text style={styles.time}>{reading.time}</Text>
      </Pressable>
      <WorldWeatherControl/>
    </View>
    <AppBottomSheet visible={open} onClose={() => setOpen(false)} expanded>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('worldClock.title')}</Text>
        <Text style={styles.reading}>{t('worldClock.dayNumber', { day: reading.day })} · {reading.time}</Text>
        <Text style={styles.hint}>{t('worldClock.description')}</Text>
        <Text style={styles.label}>{t('worldClock.speed')}</Text>
        {WORLD_CLOCK_SPEEDS.map(speed => <Pressable key={speed} style={[styles.option, worldClock.speed === speed && styles.selected]}
          accessibilityRole="radio" accessibilityState={{ selected: worldClock.speed === speed }} onPress={() => setWorldClock(speed)}>
          <Text style={styles.label}>{t(`worldClock.speed${speed}`)}</Text>
          <Text style={styles.hint}>{t(`worldClock.duration${speed}`)}</Text>
        </Pressable>)}
        <Text style={styles.label}>{t('worldClock.setTime')}</Text>
        <View style={styles.presets}>{[['morning', 9], ['day', 13], ['evening', 19], ['night', 23]].map(([period, hour]) =>
          <Pressable key={period} style={styles.preset} accessibilityRole="button" onPress={() => setWorldClock(worldClock.speed, Number(hour) * 60)}>
            <Text style={styles.label}>{t(`worldClock.${period}`)}</Text>
          </Pressable>)}</View>
        <Pressable style={styles.option} accessibilityRole="button" onPress={() => setOpen(false)}><Text style={styles.label}>{t('common.close')}</Text></Pressable>
      </ScrollView>
    </AppBottomSheet>
  </>;
}

const styles = StyleSheet.create({
  controls: { position: 'absolute', top: moderateScale(10), left: moderateScale(130), right: moderateScale(10),
    zIndex: 20, flexDirection: 'row', gap: moderateScale(6) },
  badge: { flex: 1, minWidth: 0, height: moderateScale(44), justifyContent: 'center',
    backgroundColor: GameColors.card, borderColor: GameColors.cardBorder, borderWidth: 1, borderRadius: moderateScale(20), alignItems: 'center' },
  time: { fontSize: moderateScale(13), fontWeight: '700', color: GameColors.text, fontVariant: ['tabular-nums'] },
  pressed: { backgroundColor: GameColors.background },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 24, fontWeight: '800', color: GameColors.text },
  reading: { fontSize: 24, fontVariant: ['tabular-nums'], color: GameColors.text },
  label: { fontSize: 16, fontWeight: '700', color: GameColors.text },
  hint: { fontSize: 14, lineHeight: 20, color: GameColors.textMuted },
  option: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: GameColors.cardBorder, backgroundColor: GameColors.card, gap: 4 },
  selected: { borderColor: GameColors.secondary, borderWidth: 2 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { flexGrow: 1, minWidth: '40%', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: GameColors.card },
});
