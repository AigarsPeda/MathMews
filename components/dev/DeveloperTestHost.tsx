import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { RecoveryBoundary } from '@/components/recovery/RecoveryBoundary';
import { DEVELOPER_TESTS, type DeveloperTest } from '@/constants/developer-tests';
import { GameColors } from '@/constants/game';
import { setDeveloperMode, useDeveloperMode } from '@/lib/developer-mode';

function TestScreen({ test }: { test: DeveloperTest }) {
  const [Screen] = useState(() => test.load());
  return <Screen />;
}
export function DeveloperTestHost() {
  const router = useRouter(), { t } = useTranslation();
  const mode = useDeveloperMode();
  const test = DEVELOPER_TESTS.find(entry => entry.id === mode);
  if (!test) return <Redirect href="/" />;
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.header}>
      <Text style={styles.title} numberOfLines={2}>{test.title}</Text>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.replace('/settings/developer')}><Text style={styles.action}>{t('settings.title')}</Text></Pressable>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setDeveloperMode(null); router.dismissTo('/'); }}><Text style={styles.action}>{t('developer.off')}</Text></Pressable>
      </View>
    </View>
    <RecoveryBoundary key={test.id} scope="developer-test" fallback={() => <Text style={styles.error}>{t('developer.failed')}</Text>}>
      <SafeAreaProvider style={styles.content}><TestScreen test={test}/></SafeAreaProvider>
    </RecoveryBoundary>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GameColors.background }, content: { flex: 1 },
  header: { borderBottomWidth: 2, borderColor: GameColors.cardBorder, paddingHorizontal: 16, paddingTop: 4 },
  title: { color: GameColors.text, fontSize: 16, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  button: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  action: { color: GameColors.secondaryDark, fontSize: 16, fontWeight: '700' },
  error: { padding: 24, color: GameColors.text, fontSize: 16 },
});
