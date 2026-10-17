import { CoinPackSheet } from "@/components/economy/CoinPackSheet";
import { CoinCounter } from "@/components/economy/CoinCounter";
import { useGame } from "@/contexts/GameProvider";
import { HEADER_CHIP_SIZE } from "@/constants/game";
import type { LivesState } from "@/types/game";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

type GameHeaderStatsProps = {
  layout?: 'inline' | 'home';
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
  layout = 'inline',
  coins,
  streak = 0,
}: GameHeaderStatsProps) {
  const { recordInteraction } = useGame();
  const [showCoinSheet, setShowCoinSheet] = useState(false);

  const handleOpenCoinSheet = useCallback(() => {
    recordInteraction();
    triggerHaptic();
    setShowCoinSheet(true);
  }, [recordInteraction]);

  return (
    <View style={[styles.row, layout === 'home' && styles.homeRow]}>

      <CoinCounter
        coins={coins}
        streak={streak}
        compact
        layout={layout}
        onPress={handleOpenCoinSheet}
      />
      <CoinPackSheet
        visible={showCoinSheet}
        onClose={() => setShowCoinSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  homeRow: { flex: 1, minWidth: 0, height: undefined },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8),
    height: moderateScale(HEADER_CHIP_SIZE),
  },
});
