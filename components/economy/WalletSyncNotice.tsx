import { GameColors } from '@/constants/game';
import { useGame } from '@/contexts/GameProvider';
import { moderateScale } from '@/utils/scale';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

/** Remains in the save until acknowledged, even if reconciliation ran at startup. */
export function WalletSyncNotice() {
  const { walletNotices, dismissWalletNotice } = useGame();
  const { t } = useTranslation();
  const notice = walletNotices[0];
  if (!notice) return null;
  const key = notice.kind === 'room' ? `store.roomStyles.${notice.itemId}.name`
    : notice.kind === 'life' ? 'lives.title' : `store.${notice.kind}Name.${notice.itemId}`;
  const name = t(key, { defaultValue: notice.itemId }).replace(/\n/g, ' ');
  const dismiss = () => dismissWalletNotice(notice.id);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>{t('store.syncCancelledTitle')}</Text>
          <Text style={styles.message}>{t(`store.syncCancelled.${notice.reason}`, { name })}</Text>
          <Pressable style={styles.button} onPress={dismiss} accessibilityRole="button">
            <Text style={styles.buttonText}>{t('store.syncAcknowledge')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(45,52,54,0.45)', justifyContent: 'center', padding: moderateScale(24) },
  card: { backgroundColor: GameColors.card, borderRadius: moderateScale(18), borderWidth: 2, borderColor: GameColors.cardBorder, padding: moderateScale(20), gap: moderateScale(16) },
  title: { fontSize: moderateScale(20), fontWeight: '800', color: GameColors.text, textAlign: 'center' },
  message: { fontSize: moderateScale(16), lineHeight: moderateScale(23), color: GameColors.textMuted, textAlign: 'center' },
  button: { minHeight: moderateScale(50), borderRadius: moderateScale(14), backgroundColor: GameColors.primary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: moderateScale(17), fontWeight: '800', color: '#FFFFFF' },
});
