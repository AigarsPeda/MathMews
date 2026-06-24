import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

type CoinCounterProps = {
  coins: number;
  streak?: number;
};

export function CoinCounter({ coins, streak = 0 }: CoinCounterProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <View style={styles.pill}>
        <Text style={styles.coinEmoji}>🪙</Text>
        <Text style={styles.coinValue}>{coins}</Text>
      </View>
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
