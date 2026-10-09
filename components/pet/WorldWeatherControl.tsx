import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { AppIcon } from '@/components/ui/AppIcon';
import { GameColors } from '@/constants/game';
import { useGame } from '@/contexts/GameProvider';
import { useWorldClockNow } from '@/hooks/use-world-clock-now';
import { normalizeWeather, WEATHER_MODES } from '@/utils/world-clock';
import { worldWeatherReport } from '@/utils/world-weather';
import { moderateScale } from '@/utils/scale';

export function WorldWeatherControl() {
  const { t } = useTranslation();
  const { worldClock, setWorldWeather } = useGame();
  const now = useWorldClockNow(5000);
  const report = worldWeatherReport(worldClock, Math.max(now, worldClock.realMs));
  const selected = normalizeWeather(worldClock.weather);
  const [open, setOpen] = useState(false);
  const condition = report.kind === 'clear' ? t(report.night ? 'worldWeather.clearNight' : 'worldWeather.sunny')
    : t(`worldClock.weather_${report.kind}`);
  const temperature = t('worldWeather.temperature', { temperature: report.temperature });
  return <>
    <Pressable style={({ pressed }) => [styles.badge, pressed && styles.pressed]} onPress={() => setOpen(true)}
      accessibilityRole="button" accessibilityLabel={t('worldWeather.open', { weather: condition, temperature: report.temperature })}
      accessibilityHint={t('worldWeather.change')}>
      <AppIcon name={report.icon} size={moderateScale(28)}/>
      <Text style={styles.badgeTemperature} numberOfLines={1}>{temperature}</Text>
    </Pressable>
    <AppBottomSheet visible={open} onClose={() => setOpen(false)} expanded>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('worldWeather.title')}</Text>
        <View style={styles.report}>
          <AppIcon name={report.icon} size={64}/>
          <View style={styles.reportText}>
            <Text style={styles.temperature}>{temperature}</Text>
            <Text style={styles.label}>{condition}</Text>
          </View>
        </View>
        <Text style={styles.hint}>{t('worldWeather.description')}</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('worldWeather.change')} style={styles.options}>
          {WEATHER_MODES.map(weather => {
            const icon = weather === 'auto' ? 'weather-auto' : weather === 'clear'
              ? report.night ? 'weather-moon' : 'weather-sun' : `weather-${weather}` as const;
            return <Pressable key={weather} style={({ pressed }) => [styles.option, selected === weather && styles.selected, pressed && styles.pressed]}
              accessibilityRole="radio" accessibilityState={{ selected: selected === weather }}
              onPress={() => setWorldWeather(weather)}>
              <AppIcon name={icon} size={36}/>
              <View style={styles.optionText}>
                <Text style={styles.label}>{t(`worldClock.weather_${weather}`)}</Text>
                {weather === 'auto' ? <Text style={styles.hint}>{t('worldWeather.automaticDescription')}</Text> : null}
              </View>
              {selected === weather ? <AppIcon name="check" size={20}/> : <View style={styles.checkSpace}/>}
            </Pressable>;
          })}
        </View>
        <Pressable style={({ pressed }) => [styles.close, pressed && styles.pressed]} accessibilityRole="button" onPress={() => setOpen(false)}>
          <Text style={styles.label}>{t('common.close')}</Text>
        </Pressable>
      </ScrollView>
    </AppBottomSheet>
  </>;
}

const styles = StyleSheet.create({
  badge: { flex: 1, minWidth: 0, height: moderateScale(44), flexDirection: 'row', gap: moderateScale(4),
    paddingHorizontal: moderateScale(8), alignItems: 'center', backgroundColor: GameColors.card,
    borderColor: GameColors.cardBorder, borderWidth: 1, borderRadius: moderateScale(20) },
  badgeTemperature: { fontSize: moderateScale(13), fontWeight: '700', color: GameColors.text, fontVariant: ['tabular-nums'] },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16 },
  title: { fontSize: 24, fontWeight: '800', color: GameColors.text },
  report: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  reportText: { flex: 1, gap: 4 },
  temperature: { fontSize: 28, fontWeight: '700', color: GameColors.text, fontVariant: ['tabular-nums'] },
  label: { fontSize: 16, fontWeight: '700', color: GameColors.text },
  hint: { fontSize: 14, lineHeight: 20, color: GameColors.textMuted },
  options: { gap: 8 },
  option: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    borderRadius: 12, borderWidth: 2, borderColor: GameColors.cardBorder, backgroundColor: GameColors.card },
  optionText: { flex: 1, gap: 4 },
  selected: { borderColor: GameColors.secondary },
  pressed: { backgroundColor: GameColors.background },
  checkSpace: { width: 20 },
  close: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12,
    borderWidth: 1, borderColor: GameColors.cardBorder, backgroundColor: GameColors.card },
});
