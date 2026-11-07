import { DecorationSpriteImage } from '@/components/pet/DecorationSpriteImage';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { getCatPlanReward } from '@/constants/cat-plan-rewards';
import { PuzzleColors } from '@/constants/puzzle-theme';
import { moderateScale } from '@/utils/scale';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

export function CatPlanDecoration({ lessonId, earned = false }: { lessonId: string; earned?: boolean }) {
  const { t } = useTranslation();
  const reward = getCatPlanReward(lessonId);
  if (!reward) return null;
  const name = t(`store.decorationName.${reward.decorationId}`).replace(/\n/g, ' ');
  return <View style={[styles.row, earned && styles.earned]} accessible accessibilityLabel={`${t(earned ? 'catPlans.decorationEarned' : 'catPlans.decorationPreview', { name })}. ${t(earned ? 'catPlans.inYourItems' : 'catPlans.forYourHouse')}`}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <DecorationSpriteImage decorationId={reward.decorationId} still size={moderateScale(earned ? 120 : 60)} />
    </View>
    <View style={[styles.copy, earned && styles.earnedCopy]}>
      <Text style={[styles.title, earned && styles.earnedTitle]}>{t(earned ? 'catPlans.decorationEarned' : 'catPlans.decorationPreview', { name })}</Text>
      <Text style={[styles.detail, earned && styles.earnedDetail]}>{t(earned ? 'catPlans.inYourItems' : 'catPlans.forYourHouse')}</Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  row: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: moderateScale(12), paddingVertical: moderateScale(10) },
  earned: { flexDirection: 'column', gap: moderateScale(10) },
  earnedCopy: { flex: 0, alignItems: 'center' },
  earnedTitle: { fontSize: moderateScale(22), lineHeight: moderateScale(29), textAlign: 'center' },
  earnedDetail: { textAlign: 'center' },
  copy: { flex: 1, gap: moderateScale(4) },
  title: { fontSize: moderateScale(15), lineHeight: moderateScale(21), fontWeight: '800', color: PuzzleColors.text },
  detail: { fontSize: moderateScale(13), lineHeight: moderateScale(18), color: PuzzleColors.textMuted },
});
