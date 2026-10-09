import { useSyncExternalStore } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButtonLabel } from '@/components/ui/BackButtonLabel';
import { GameColors } from '@/constants/game';
import { formatAppDiagnostics, getAppDiagnostics, reportAppError, subscribeAppDiagnostics } from '@/lib/app-diagnostics';

export default function DiagnosticsScreen() {
  const entries = useSyncExternalStore(subscribeAppDiagnostics, getAppDiagnostics, getAppDiagnostics);
  const router = useRouter();
  const { t } = useTranslation();
  const share = async () => {
    try { await Share.share({ title: t('recovery.diagnostics'), message: formatAppDiagnostics() }); }
    catch (error) { reportAppError('diagnostics-share', error); }
  };
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable style={styles.button} accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/settings')}>
        <BackButtonLabel/>
      </Pressable>
      <Text style={styles.title}>{t('recovery.diagnostics')}</Text>
      <Text style={styles.hint}>{t('recovery.diagnosticsInfo')}</Text>
      {entries.length ? <Pressable accessibilityRole="button" onPress={share} style={styles.button}>
        <Text style={styles.link}>{t('recovery.share')}</Text>
      </Pressable> : <Text style={styles.hint}>{t('recovery.empty')}</Text>}
      {[...entries].reverse().map((entry, index) => <View key={`${entry.at}:${index}`} style={styles.card}>
        <Text style={styles.label}>{new Date(entry.at).toLocaleString()} · {t(entry.fatal ? 'recovery.fatal' : 'recovery.recovered')}</Text>
        <Text selectable style={styles.label}>{entry.scope}</Text>
        <Text selectable style={styles.message}>{entry.message}</Text>
        {entry.stack ? <Text selectable style={styles.stack}>{entry.stack}</Text> : null}
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GameColors.background },
  content: { padding: 20, gap: 16 },
  button: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  title: { fontSize: 28, fontWeight: '800', color: GameColors.text },
  hint: { color: GameColors.textMuted, fontSize: 15, lineHeight: 22 },
  link: { color: GameColors.primary, fontSize: 17, fontWeight: '700' },
  card: { padding: 16, gap: 8, backgroundColor: GameColors.card, borderRadius: 16, borderWidth: 1, borderColor: GameColors.cardBorder },
  label: { fontSize: 13, fontWeight: '700', color: GameColors.textMuted },
  message: { color: GameColors.text, fontSize: 16, lineHeight: 22 },
  stack: { color: GameColors.textMuted, fontSize: 12, lineHeight: 17 },
});
