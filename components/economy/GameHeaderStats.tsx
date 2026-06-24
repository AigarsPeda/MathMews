import { BuyLifeSheet } from "@/components/economy/BuyLifeSheet";
import { CoinCounter } from "@/components/economy/CoinCounter";
import { LivesCounter } from "@/components/economy/LivesCounter";
import { useGame } from "@/contexts/GameProvider";
import type { LivesState } from "@/types/game";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

type GameHeaderStatsProps = {
  coins: number;
  streak?: number;
  lives: LivesState;
};

function triggerHaptic(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light,
) {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(style);
  }
}

export function GameHeaderStats({
  coins,
  streak = 0,
  lives,
}: GameHeaderStatsProps) {
  const { buyLife, recordInteraction } = useGame();
  const [showBuySheet, setShowBuySheet] = useState(false);

  const handleOpenBuySheet = useCallback(() => {
    recordInteraction();
    triggerHaptic();
    setShowBuySheet(true);
  }, [recordInteraction]);

  const handleBuyLife = useCallback(() => {
    recordInteraction();
    const purchased = buyLife();
    if (purchased) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    }
    return purchased;
  }, [buyLife]);

  return (
    <View style={styles.row}>
      <LivesCounter lives={lives} compact onPress={handleOpenBuySheet} />
      <CoinCounter coins={coins} streak={streak} />
      <BuyLifeSheet
        visible={showBuySheet}
        lives={lives}
        coins={coins}
        onBuyLife={handleBuyLife}
        onClose={() => setShowBuySheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8),
  },
});
