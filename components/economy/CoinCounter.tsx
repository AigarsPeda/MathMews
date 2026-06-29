import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { useTranslation } from "react-i18next";
import { StyleSheet, Pressable, Text, View } from "react-native";

type CoinCounterProps = {
  coins: number;
  streak?: number;
  onPress?: () => void;
};

export function CoinCounter({ coins, streak = 0, onPress }: CoinCounterProps) {
  const { t } = useTranslation();

  const content = (
    <>
      <Text style={styles.coinEmoji}>🪙</Text>
      <Text style={styles.coinValue}>{coins}</Text>
    </>
  );

  return (
    <View style={styles.row}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
          accessibilityRole="button"
          accessibilityLabel={t("economy.a11yCoins", { coins })}
        >
          {content}
        </Pressable>
      ) : (
        <View style={styles.pill}>{content}</View>
      )}
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
  pillPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
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
