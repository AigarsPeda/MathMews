import { CoinPackSheet } from "@/components/economy/CoinPackSheet";
import { ParentGateSheet } from "@/components/economy/ParentGateSheet";
import { CoinCounter } from "@/components/economy/CoinCounter";
import { useGame } from "@/contexts/GameProvider";
import { useIAP } from "@/contexts/IAPProvider";
import { HEADER_CHIP_SIZE } from "@/constants/game";
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
}: GameHeaderStatsProps) {
  const { recordInteraction } = useGame();
  const { isSupported } = useIAP();
  const [showParentGate, setShowParentGate] = useState(false);
  const [showCoinSheet, setShowCoinSheet] = useState(false);

  const handleOpenCoinSheet = useCallback(() => {
    recordInteraction();
    triggerHaptic();
    if (isSupported) {
      setShowParentGate(true);
      return;
    }
    setShowCoinSheet(true);
  }, [isSupported, recordInteraction]);

  const handleParentGatePass = useCallback(() => {
    setShowParentGate(false);
    setShowCoinSheet(true);
  }, []);

  return (
    <View style={styles.row}>

      <CoinCounter
        coins={coins}
        streak={streak}
        compact
        onPress={handleOpenCoinSheet}
      />
      <ParentGateSheet
        visible={showParentGate}
        onPass={handleParentGatePass}
        onClose={() => setShowParentGate(false)}
      />
      <CoinPackSheet
        visible={showCoinSheet}
        onClose={() => setShowCoinSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8),
    height: moderateScale(HEADER_CHIP_SIZE),
  },
});
