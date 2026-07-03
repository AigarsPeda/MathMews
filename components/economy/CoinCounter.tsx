import { HeaderChip } from "@/components/home/HeaderChip";
import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

type CoinCounterProps = {
  coins: number;
  streak?: number;
  compact?: boolean;
  onPress?: () => void;
};

export function CoinCounter({
  coins,
  streak = 0,
  compact = false,
  onPress,
}: CoinCounterProps) {
  const { t } = useTranslation();

  const content = (
    <>
      <Text style={[styles.coinEmoji, compact && styles.compactText]}>
        🪙
      </Text>
      <Text style={[styles.coinValue, compact && styles.compactText]}>
        {coins}
      </Text>
    </>
  );

  const coinChip = compact ? (
    <HeaderChip
      shape="pill"
      borderColor={GameColors.coin}
      onPress={onPress}
      accessibilityLabel={t("economy.a11yCoins", { coins })}
    >
      {content}
    </HeaderChip>
  ) : onPress ? (
    <HeaderChip
      shape="pill"
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
      {streak > 0 && (
        <View style={[styles.pill, styles.streakPill]}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakValue}>
            {t("economy.streakDay", { count: streak })}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(10),
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(6),
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(20),
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(14),
    borderWidth: 2,
    borderColor: GameColors.coin,
  },
  coinEmoji: {
    fontSize: moderateScale(18),
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
  streakEmoji: {
    fontSize: moderateScale(16),
  },
  streakValue: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.text,
  },
});
