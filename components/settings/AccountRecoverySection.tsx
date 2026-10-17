import { ParentGateSheet } from '@/components/economy/ParentGateSheet';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { GameColors } from '@/constants/game';
import { getPlatformRestoreProviderLabel, isPlatformAuthEnabled } from '@/constants/platform-auth';
import { useAuth } from '@/contexts/AuthProvider';
import { useGame } from '@/contexts/GameProvider';
import { moderateScale } from '@/utils/scale';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';

export function AccountRecoverySection() {
  const { t } = useTranslation();
  const { userId, isAuthReady, isAccountChanging, isPlatformAccountLinked, linkedPlatformProvider,
    platformRestoreProvider, platformRestoreLabel, protectProgress, restoreProgress } = useAuth();
  const { syncToCloud } = useGame();
  const [action, setAction] = useState<'protect' | 'restore' | null>(null);
  const [parentPassed, setParentPassed] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const enabled = isPlatformAuthEnabled(platformRestoreProvider);
  const unavailable = !enabled || !isAuthReady || !userId || isAccountChanging || working;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') setParentPassed(false);
    });
    return () => subscription.remove();
  }, []);

  const start = (next: 'protect' | 'restore') => {
    setMessage(null); setParentPassed(false); setAction(next);
  };
  const run = async () => {
    if (!parentPassed || unavailable || !action) return;
    setWorking(true);
    try {
      await syncToCloud();
      const result = await (action === 'protect' ? protectProgress() : restoreProgress());
      if (result.ok) setMessage(t(`settings.account.${action}Success`));
      else if (!result.cancelled) setMessage(t(result.error === 'account_operation_busy'
        ? 'settings.account.busy' : 'settings.account.failed'));
    } catch { setMessage(t('settings.account.failed')); }
    finally { setWorking(false); setAction(null); setParentPassed(false); }
  };
  const close = () => { if (!working) { setAction(null); setParentPassed(false); } };

  return <View style={styles.section}>
    <Text style={styles.title}>{t('settings.account.title')}</Text>
    <Text style={styles.body}>{t(isPlatformAccountLinked ? 'settings.account.linked' : 'settings.account.guest', {
      provider: linkedPlatformProvider ? getPlatformRestoreProviderLabel(linkedPlatformProvider) : platformRestoreLabel,
    })}</Text>
    {!enabled ? <Text style={styles.body}>{t('settings.account.unavailable')}</Text> : null}
    {!isPlatformAccountLinked ? <Pressable accessibilityRole="button" disabled={unavailable}
      accessibilityState={{ disabled: unavailable }} onPress={() => start('protect')}
      style={[styles.button, unavailable && styles.disabled]}>
      <Text style={styles.buttonText}>{t('settings.account.protect')}</Text>
    </Pressable> : null}
    <Pressable accessibilityRole="button" disabled={unavailable}
      accessibilityState={{ disabled: unavailable }} onPress={() => start('restore')}
      style={[styles.button, unavailable && styles.disabled]}>
      <Text style={styles.buttonText}>{t('settings.account.restore')}</Text>
    </Pressable>
    {message ? <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text> : null}
    {action ? <AppBottomSheet visible onClose={close}>
      {parentPassed ? <View style={styles.section}>
        <Text style={styles.title}>{t(`settings.account.${action}`)}</Text>
        <Text style={styles.body}>{t(action === 'restore' ? 'settings.account.restoreWarning' : 'settings.account.protectHint')}</Text>
        <Text selectable style={styles.body}>{t('settings.account.accountId', { id: userId })}</Text>
        <Pressable accessibilityRole="button" disabled={unavailable} onPress={() => { void run(); }} style={[styles.button, unavailable && styles.disabled]}>
          {working ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{t('settings.account.continue', { provider: platformRestoreLabel })}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" disabled={working} onPress={close} style={styles.cancel}>
          <Text style={styles.body}>{t('common.cancel')}</Text>
        </Pressable>
      </View> : <ParentGateSheet visible embedded onPass={() => setParentPassed(true)} onClose={close} />}
    </AppBottomSheet> : null}
  </View>;
}

const styles = StyleSheet.create({
  section: { backgroundColor: GameColors.card, borderRadius: moderateScale(16), borderWidth: 2,
    borderColor: GameColors.cardBorder, padding: moderateScale(16), gap: moderateScale(10) },
  title: { fontSize: moderateScale(18), fontWeight: '800', color: GameColors.text },
  body: { fontSize: moderateScale(14), lineHeight: moderateScale(20), color: GameColors.textMuted },
  button: { minHeight: moderateScale(50), borderRadius: moderateScale(14), paddingHorizontal: moderateScale(14),
    backgroundColor: GameColors.secondary, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: moderateScale(15), fontWeight: '800', textAlign: 'center' },
  cancel: { minHeight: moderateScale(48), justifyContent: 'center', alignItems: 'center' },
  disabled: { opacity: 0.5 },
});
