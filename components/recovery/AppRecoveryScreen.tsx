import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import i18n from '@/i18n';
import { GameColors } from '@/constants/game';

export function AppRecoveryScreen({ retry }: { retry: () => void }) {
  useEffect(() => {
    // Startup can fail before SplashGate has removed the native cover.
    const frame = requestAnimationFrame(() => { SplashScreen.hideAsync().catch(() => {}); });
    return () => cancelAnimationFrame(frame);
  }, []);
  return <View style={styles.container} accessibilityRole="alert">
    <Text style={styles.title}>{i18n.t('recovery.appTitle')}</Text>
    <Text style={styles.text}>{i18n.t('recovery.appHint')}</Text>
    <Pressable accessibilityRole="button" onPress={retry} style={styles.button}>
      <Text style={styles.buttonText}>{i18n.t('recovery.retry')}</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 16, backgroundColor: GameColors.background },
  title: { fontSize: 24, fontWeight: '800', color: GameColors.text, textAlign: 'center' },
  text: { fontSize: 16, lineHeight: 23, color: GameColors.textMuted, textAlign: 'center' },
  button: { minHeight: 48, padding: 14, paddingHorizontal: 24, borderRadius: 16, backgroundColor: GameColors.primary },
  buttonText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});
