import { IconText as Text } from '@/components/ui/IconText';
import { GameColors } from '@/constants/game';
import type { StorePrice } from '@/types/store';
import { useWorldClockNow } from '@/hooks/use-world-clock-now';
import { getSaleCountdown, getStorePromotion } from '@/utils/store-promotion';
import { moderateScale } from '@/utils/scale';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export function StorePromotion({ price }: { price: StorePrice }) {
  if (price.kind === 'iap' || price.originalAmount === undefined) return null;
  return <ActivePromotion price={price} />;
}

function ActivePromotion({ price }: { price: Exclude<StorePrice, { kind: 'iap' }> }) {
  const { t, i18n } = useTranslation();
  const now = useWorldClockNow(1000, Boolean(price.promotionEndsAt));
  const promotion = getStorePromotion(price, now);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const endDate = useMemo(() => !price.promotionEndsAt ? '' : new Date(price.promotionEndsAt).toLocaleString(language, {
    dateStyle: 'medium', timeStyle: 'short',
  }), [price.promotionEndsAt, language]);
  if (!promotion) return null;
  const countdown = promotion.remainingMs === undefined ? null : getSaleCountdown(promotion.remainingMs);
  const discount = promotion.percent < 1 ? t('store.discountUnderOne') : t('store.discountPercent', { percent: promotion.percent });
  return (
    <View style={styles.promotion}>
      <View style={styles.row}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{discount}</Text>
        </View>
        <Text style={styles.previous}>{t('store.wasPrice', { cost: price.originalAmount })}</Text>
      </View>
      <Text style={styles.sale}>{price.promotion || t('store.sale')}</Text>
      {countdown ? (
        <Text style={styles.countdown} accessibilityRole="timer" accessibilityLiveRegion="none"
          accessibilityLabel={t('store.saleEndsAt', { date: endDate })}>
          {t(`store.saleCountdown.${countdown.key}`, countdown)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  promotion: { alignItems: 'center', gap: moderateScale(4), width: '100%' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: moderateScale(6) },
  badge: { backgroundColor: '#23766F', borderRadius: moderateScale(8), paddingHorizontal: moderateScale(8), paddingVertical: moderateScale(4) },
  badgeText: { color: GameColors.card, fontSize: moderateScale(13), fontWeight: '800', textAlign: 'center' },
  previous: { color: GameColors.textMuted, fontSize: moderateScale(12), textDecorationLine: 'line-through' },
  sale: { color: '#23766F', fontSize: moderateScale(12), fontWeight: '700', textAlign: 'center' },
  countdown: { color: GameColors.textMuted, fontSize: moderateScale(12), lineHeight: moderateScale(17), fontWeight: '600', fontVariant: ['tabular-nums'], textAlign: 'center' },
});
