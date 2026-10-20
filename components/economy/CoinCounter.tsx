import { AppIcon } from "@/components/ui/AppIcon";
import { HeaderChip } from "@/components/home/HeaderChip";
import { GameColors, HEADER_CHIP_SIZE } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

type CoinCounterProps = {
  layout?: 'inline' | 'home';
  coins: number;
  streak?: number;
  compact?: boolean;
  onPress?: () => void;
  homeAccessory?: (stacked: boolean) => ReactNode;
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
  const [stacked, setStacked] = useState(false);

  if (layout === 'home') return <View style={[styles.homeRow, stacked && styles.stackedRow]}
    onLayout={event => setStacked(event.nativeEvent.layout.width < moderateScale(352))}>
    <Pressable onPress={onPress} style={({ pressed }) => [styles.homeMetric, stacked && styles.stackedMetric, pressed && { opacity: .7 }]}
      accessibilityRole="button" accessibilityLabel={t('economy.a11yCoins', { coins })}>
      <Text style={styles.metricLabel}>{t('economy.coinsLabel')}</Text>
      <View style={styles.metricValueRow}>
        <AppIcon name="coin" size={moderateScale(16)} />
        <Text style={[styles.coinValue, styles.homeValue]}>{coins}</Text>
      </View>
    </Pressable>
    {!stacked ? <View style={styles.metricDivider}/> : null}
    <View style={[styles.homeMetric, stacked && styles.stackedMetric]} accessible accessibilityLabel={`${t('economy.streakLabel')}: ${t('economy.streakDay', { count: streak })}`}>
      <Text style={styles.metricLabel}>{t('economy.streakLabel')}</Text>
      <View style={styles.metricValueRow}>
        <AppIcon name="flame" size={moderateScale(16)} />
        <Text style={[styles.streakValue, styles.homeValue]}>{t('economy.streakDay', { count: streak })}</Text>
      </View>
    </View>
    {homeAccessory ? <>{!stacked ? <View style={styles.metricDivider}/> : null}{homeAccessory(stacked)}</> : null}
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
