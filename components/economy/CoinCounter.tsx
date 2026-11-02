import { AppIcon } from "@/components/ui/AppIcon";
import { HeaderChip } from "@/components/home/HeaderChip";
import { GameColors, HEADER_CHIP_SIZE } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

export type HomeMetricLayout = 'regular' | 'compact' | 'stacked';

type CoinCounterProps = {
  layout?: 'inline' | 'home';
  coins: number;
  streak?: number;
  compact?: boolean;
  onPress?: () => void;
  homeAccessory?: (layout: HomeMetricLayout) => ReactNode;
};

export function CoinCounter({
  layout = 'inline',
  coins,
  streak = 0,
  compact = false,
  onPress,
  homeAccessory,
}: CoinCounterProps) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const [homeWidth, setHomeWidth] = useState(0);
  const stacked = fontScale > 1.35 && homeWidth < moderateScale(520) * fontScale;
  const compactHome = !stacked && homeWidth < moderateScale(352);
  const metricLayout: HomeMetricLayout = stacked ? 'stacked' : compactHome ? 'compact' : 'regular';

  if (layout === 'home') return <View style={[styles.homeRow, stacked && styles.stackedRow]}
    onLayout={event => setHomeWidth(event.nativeEvent.layout.width)}>
    <Pressable onPress={onPress} style={({ pressed }) => [styles.homeMetric, compactHome && styles.compactMetric, compactHome && coins >= 100000 && styles.wideCoinMetric, stacked && styles.stackedMetric, pressed && { opacity: .7 }]}
      accessibilityRole="button" accessibilityLabel={t('economy.a11yCoins', { coins })}>
      {!compactHome ? <Text style={styles.metricLabel}>{t('economy.coinsLabel')}</Text> : null}
      <View style={styles.metricValueRow}>
        <AppIcon name="coin" size={moderateScale(16)} />
        <Text style={[styles.coinValue, styles.homeValue]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.85}>{coins}</Text>
      </View>
    </Pressable>
    {!stacked ? <View style={styles.metricDivider}/> : null}
    <View style={[styles.homeMetric, compactHome && styles.compactMetric, stacked && styles.stackedMetric]} accessible accessibilityLabel={`${t('economy.streakLabel')}: ${t('economy.streakDay', { count: streak })}`}>
      {!compactHome ? <Text style={styles.metricLabel}>{t('economy.streakLabel')}</Text> : null}
      <View style={styles.metricValueRow}>
        <AppIcon name="flame" size={moderateScale(16)} />
        <Text style={[styles.streakValue, styles.homeValue]}>{compactHome ? streak : t('economy.streakDay', { count: streak })}</Text>
      </View>
    </View>
    {homeAccessory ? <>{!stacked ? <View style={styles.metricDivider}/> : null}{homeAccessory(metricLayout)}</> : null}
  </View>;

  const content = (
    <>
      <AppIcon name="coin" size={moderateScale(compact ? 22 : 25)} />
      <Text style={[styles.coinValue, compact && styles.compactText]}>
        {coins}
      </Text>
    </>
  );

  const coinChip = compact ? (
    <HeaderChip
      shape="pill"
      style={styles.headerChip}
      borderColor={GameColors.coin}
      onPress={onPress}
      accessibilityLabel={t("economy.a11yCoins", { coins })}
    >
      {content}
    </HeaderChip>
  ) : onPress ? (
    <HeaderChip
      shape="pill"
      style={styles.headerChip}
      borderColor={GameColors.coin}
      onPress={onPress}
      accessibilityLabel={t("economy.a11yCoins", { coins })}
    >
      {content}
    </HeaderChip>
  ) : (
    <View style={styles.pill}>{content}</View>
  );

  return (
    <View style={styles.row}>
      {coinChip}
      <View style={[styles.pill, styles.streakPill]}>
        <AppIcon name="flame" size={moderateScale(16) * 1.2} />
        <Text style={styles.streakValue}>
          {t("economy.streakDay", { count: streak })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  homeRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  homeMetric: { flex: 1, minWidth: 0, minHeight: 56, paddingHorizontal: moderateScale(4), paddingVertical: moderateScale(8), gap: moderateScale(3), justifyContent: 'center' },
  compactMetric: { minHeight: 48, paddingHorizontal: moderateScale(2), paddingVertical: moderateScale(4) },
  wideCoinMetric: { flex: 2 },
  stackedRow: { flexWrap: 'wrap', alignItems: 'stretch' },
  stackedMetric: { flex: 0, width: '50%' },
  metricLabel: { color: GameColors.textMuted, fontSize: moderateScale(11), lineHeight: moderateScale(14), fontWeight: '600', textAlign: 'center' },
  metricValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: moderateScale(2) },
  homeValue: { flexShrink: 1, minWidth: 0, fontSize: moderateScale(16), lineHeight: moderateScale(20) },
  metricDivider: { width: 1, height: moderateScale(28), backgroundColor: GameColors.cardBorder },
  headerChip: { borderRadius: moderateScale(12) },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(10),
  },
  pill: {
    height: moderateScale(HEADER_CHIP_SIZE),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(6),
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    borderWidth: 2,
    borderColor: GameColors.coin,
  },
  coinValue: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: GameColors.coinText,
    fontVariant: ["tabular-nums"],
  },
  compactText: {
    fontSize: moderateScale(16),
  },
  streakPill: {
    borderColor: GameColors.primary,
  },
  streakValue: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.text,
  },
});
