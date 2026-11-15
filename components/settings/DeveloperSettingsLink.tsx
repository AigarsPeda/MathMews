import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { GameColors } from '@/constants/game';
import { setDeveloperMode, useDeveloperMode } from '@/lib/developer-mode';

export function DeveloperSettingsLink() {
  const router = useRouter(), { t } = useTranslation();
  const mode = useDeveloperMode();
  if (!__DEV__) return null;
  return <View style={styles.card}>
    <View style={styles.row}>
      <Text style={styles.title}>{t('developer.title')}</Text>
      <Switch accessibilityLabel={t('developer.enabled')} value={mode !== null}
        trackColor={{ true: GameColors.secondary }} onValueChange={enabled => setDeveloperMode(enabled ? 'cat-feeding' : null)}/>
    </View>
    <Text style={styles.hint}>{t('developer.sessionHint')}</Text>
    <Pressable accessibilityRole="button" onPress={() => router.push('/settings/developer')} style={styles.link}>
      <Text style={styles.action}>{t('developer.choose')}</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: GameColors.card, borderRadius: 16, borderWidth: 2, borderColor: GameColors.cardBorder, padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { color: GameColors.text, fontWeight: '800', fontSize: 18, flexShrink: 1 },
  hint: { color: GameColors.textMuted, fontSize: 14, lineHeight: 20 },
  link: { minHeight: 44, justifyContent: 'center' },
  action: { color: GameColors.secondaryDark, fontSize: 16, fontWeight: '700' },
});
