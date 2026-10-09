import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { GameColors } from '@/constants/game';
import { setSimpleGraphics, useGraphicsMode } from '@/lib/graphics-mode';

export function GraphicsSettings() {
  const mode = useGraphicsMode();
  const router = useRouter();
  const { t } = useTranslation();
  return <View style={styles.card}>
    <View style={styles.row}>
      <Text style={styles.title}>{t('recovery.graphicsTitle')}</Text>
      <Switch value={mode === 'simple'} disabled={mode === 'loading'} onValueChange={setSimpleGraphics}
        accessibilityLabel={t('recovery.graphicsTitle')} trackColor={{ true: GameColors.secondary }}/>
    </View>
    <Text style={styles.hint}>{t('recovery.graphicsDescription')}</Text>
    <Pressable style={styles.link} accessibilityRole="button" onPress={() => router.push('/settings/diagnostics')}>
      <Text style={styles.title}>{t('recovery.diagnostics')}</Text>
      <Text style={styles.hint}>{t('recovery.diagnosticsHint')}</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: GameColors.card, borderRadius: 16, borderWidth: 2, borderColor: GameColors.cardBorder, padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { color: GameColors.text, fontWeight: '800', fontSize: 18, flexShrink: 1 },
  hint: { color: GameColors.textMuted, fontSize: 14, lineHeight: 20 },
  link: { borderTopWidth: 1, borderColor: GameColors.cardBorder, paddingTop: 16, paddingBottom: 4, gap: 6 },
});
