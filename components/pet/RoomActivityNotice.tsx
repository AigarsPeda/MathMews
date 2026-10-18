import { AppIcon } from '@/components/ui/AppIcon';
import { GameColors } from '@/constants/game';
import { moderateScale } from '@/utils/scale';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Keep failed navigation readable until the player chooses what to do next. */
export function RoomActivityNotice({ name, target, onMove, onDismiss }: {
  name: string;
  target?: string;
  onMove: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return <View style={styles.notice}>
    <View style={styles.heading}>
      <AppIcon name="warning" size={24} />
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.title}>
        {t(target ? 'home.catCannotReachItem' : 'home.catCannotReach', { name, item: target })}
      </Text>
    </View>
    <Text style={styles.hint}>{t('home.catPathBlockedHint')}</Text>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={onMove} style={({ pressed }) => [styles.move, pressed && styles.pressed]}>
        <Text style={styles.moveLabel}>{t('home.moveFurniture')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onDismiss} style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}>
        <Text style={styles.dismissLabel}>{t('common.close')}</Text>
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  notice: { backgroundColor: GameColors.card, borderColor: GameColors.cardBorder, borderWidth: 1,
    borderRadius: 16, padding: 14, gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: moderateScale(16), fontWeight: '700', color: GameColors.text },
  hint: { fontSize: moderateScale(14), lineHeight: moderateScale(20), color: GameColors.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  move: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center',
    backgroundColor: GameColors.secondaryDark, borderRadius: 12 },
  moveLabel: { fontSize: moderateScale(15), fontWeight: '700', color: GameColors.card },
  dismiss: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' },
  dismissLabel: { fontSize: moderateScale(15), fontWeight: '600', color: GameColors.text },
  pressed: { opacity: .8 },
});
