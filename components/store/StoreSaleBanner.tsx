import { AppIcon } from '@/components/ui/AppIcon';
import { GameColors } from '@/constants/game';
import { useWorldClockNow } from '@/hooks/use-world-clock-now';
import { getStoreServerTime, type StoreSale } from '@/utils/store-catalog';
import { getSaleCountdown, STORE_SALE_CATEGORIES } from '@/utils/store-promotion';
import { moderateScale } from '@/utils/scale';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StoreTab } from './StoreTabBar';

type Props = { sales: StoreSale[]; activeTab: StoreTab; onOpenSale: (sale: StoreSale) => void };

export function StoreSaleBanner({ sales, activeTab, onOpenSale }: Props) {
  const { t } = useTranslation();
  const now = useWorldClockNow(1000, sales.some(sale => sale.endsAt));
  const available = sales.filter(sale => !sale.endsAt || Date.parse(sale.endsAt) > getStoreServerTime(now));
  const primary = ['rooms', 'beds', 'toys', 'colors'].includes(activeTab) ? activeTab : 'living';
  const sale = available.find(sale => STORE_SALE_CATEGORIES[sale.kind].tab === primary) ?? available[0];
  if (!sale) return null;
  const discount = sale.maxPercent < 1 ? t('store.discountUnderOne') : t(
    sale.minPercent === sale.maxPercent ? 'store.discountPercent' : 'store.discountUpTo', { percent: sale.maxPercent });
  const title = t('store.saleBannerTitle', { category: t(STORE_SALE_CATEGORIES[sale.kind].label), discount });
  const countdown = sale.endsAt ? getSaleCountdown(Date.parse(sale.endsAt) - getStoreServerTime(now)) : null;
  const detail = [sale.label || t('store.sale'), countdown ? t(`store.saleCountdown.${countdown.key}`, countdown) : null].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={() => onOpenSale(sale)} style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
      accessibilityRole="button" accessibilityLabel={`${title}. ${detail}. ${t('store.viewDeals')}`}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <View style={styles.action}>
        <Text style={styles.actionText}>{t('store.viewDeals')}</Text>
        <AppIcon name="chevron-right" size={moderateScale(13)} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: moderateScale(12), backgroundColor: '#E8FAF8', borderColor: GameColors.secondary,
    borderWidth: 2, borderRadius: moderateScale(14), paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(10), minHeight: moderateScale(60) },
  pressed: { opacity: 0.8 },
  copy: { flex: 1, gap: moderateScale(3) },
  title: { color: '#1D625C', fontSize: moderateScale(15), lineHeight: moderateScale(20), fontWeight: '800' },
  detail: { color: '#1D625C', fontSize: moderateScale(12), lineHeight: moderateScale(17), fontWeight: '500', fontVariant: ['tabular-nums'] },
  action: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: moderateScale(3), maxWidth: '30%' },
  actionText: { color: '#1D625C', fontSize: moderateScale(12), fontWeight: '800', flexShrink: 1 },
});
