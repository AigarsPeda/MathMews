import { CoinPackSheet } from "@/components/economy/CoinPackSheet";
import { CoinCounter, type HomeMetricLayout } from "@/components/economy/CoinCounter";
import { BuyLifeSheet } from "@/components/economy/BuyLifeSheet";
import { AppIcon } from "@/components/ui/AppIcon";
import { useGameActions } from "@/contexts/GameProvider";
import { GameColors, HEADER_CHIP_SIZE, MAX_LIVES } from "@/constants/game";
import { useWorldClockNow } from "@/hooks/use-world-clock-now";
import type { LivesState } from "@/types/game";
import { applyLifeRegen, formatRegenClock, msUntilNextLife } from "@/utils/lives";
import { moderateScale } from "@/utils/scale";
import * as Haptics from "expo-haptics";
import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

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

function HomeLivesStat({ lives, coins, layout }: { lives: LivesState; coins: number; layout: HomeMetricLayout }) {
  const { t } = useTranslation();
  const { recordInteraction, buyLife } = useGameActions();
  const [showLives, setShowLives] = useState(false);
  const now = useWorldClockNow(1000, lives.current < MAX_LIVES);
  const synced = applyLifeRegen(lives, now);
  const regenMs = msUntilNextLife(synced, now);
  const countdown = regenMs === null ? null : formatRegenClock(regenMs);
  const label = t('lives.a11yLives', { current: synced.current, max: MAX_LIVES });
  const compact = layout === 'compact';

  return <>
    <Pressable style={({ pressed }) => [styles.livesMetric, compact && styles.compactMetric, layout === 'stacked' && styles.stackedMetric, pressed && { opacity: .7 }]}
      accessibilityRole="button"
      accessibilityLabel={countdown === null ? label : `${label} ${t('lives.a11yTimer', { time: countdown })}`}
      onPress={() => { recordInteraction(); triggerHaptic(); setShowLives(true); }}>
      {!compact ? <Text style={styles.metricLabel}>{t('lives.title')}</Text> : null}
      <View style={styles.livesValueRow}>
        <AppIcon name="heart" size={moderateScale(16)} />
        <Text style={styles.livesCount}>{synced.current}</Text>
        {countdown !== null ? <Text style={[styles.countdown, compact && styles.compactCountdown]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.85}>{countdown}</Text> : null}
      </View>
    </Pressable>
    <BuyLifeSheet visible={showLives} lives={lives} coins={coins}
      onBuyLife={buyLife} onClose={() => setShowLives(false)} />
  </>;
}

export const GameHeaderStats = memo(function GameHeaderStats({
  layout = 'inline',
  coins,
  streak = 0,
  lives,
}: GameHeaderStatsProps) {
  const { recordInteraction } = useGameActions();
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
        homeAccessory={layout === 'home' ? metricLayout => <HomeLivesStat lives={lives} coins={coins} layout={metricLayout} /> : undefined}
      />
      <CoinPackSheet
        visible={showCoinSheet}
        onClose={() => setShowCoinSheet(false)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  livesMetric: { flex: 1, minWidth: 0, minHeight: 56, paddingHorizontal: moderateScale(4), paddingVertical: moderateScale(8), gap: moderateScale(3), justifyContent: 'center' },
  compactMetric: { minHeight: 48, paddingHorizontal: moderateScale(2), paddingVertical: moderateScale(4) },
  stackedMetric: { flex: 0, width: '50%' },
  metricLabel: { color: GameColors.textMuted, fontSize: moderateScale(11), lineHeight: moderateScale(14), fontWeight: '600', textAlign: 'center' },
  livesValueRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: moderateScale(2) },
  livesCount: { color: GameColors.primary, fontSize: moderateScale(16), lineHeight: moderateScale(20), fontWeight: '700', fontVariant: ['tabular-nums'] },
  countdown: { flexShrink: 1, color: GameColors.textMuted, fontSize: moderateScale(11), fontWeight: '600', fontVariant: ['tabular-nums'], marginLeft: moderateScale(2) },
  compactCountdown: { width: '100%', marginLeft: 0, textAlign: 'center' },
  homeRow: { flex: 1, minWidth: 0, height: undefined },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8),
    height: moderateScale(HEADER_CHIP_SIZE),
  },
});
