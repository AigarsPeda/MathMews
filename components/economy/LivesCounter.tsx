import { GameColors, LIFE_BUY_COST, MAX_LIVES } from '@/constants/game';
import { LifeRegenClock } from '@/components/economy/LifeRegenClock';
import type { LivesState } from '@/types/game';
import {
  applyLifeRegen,
  msUntilNextLife,
} from '@/utils/lives';
import { moderateScale } from '@/utils/scale';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

function useRegenNow() {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return now;
}

type LivesCounterProps = {
  lives: LivesState;
  compact?: boolean;
  onPress?: () => void;
};

export function LivesCounter({ lives, compact = false, onPress }: LivesCounterProps) {
  const now = useRegenNow();

  const synced = applyLifeRegen(lives, now);
  const regenMs = msUntilNextLife(synced, now);

  const content = (
    <>
      <Text style={styles.emoji}>❤️</Text>
      <Text style={styles.value}>
        {synced.current}/{MAX_LIVES}
      </Text>
      {regenMs !== null && synced.current < MAX_LIVES ? (
        <LifeRegenClock regenMs={regenMs} compact={compact} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.pill,
          compact && styles.pillCompact,
          pressed && styles.pillPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Lives ${synced.current} of ${MAX_LIVES}. Tap to buy more.`}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.pill, compact && styles.pillCompact]}>{content}</View>
  );
}

type NoLivesPanelProps = {
  lives: LivesState;
  coins: number;
  onBuyLife: () => void;
  onBack?: () => void;
};

export function NoLivesPanel({
  lives,
  coins,
  onBuyLife,
  onBack,
}: NoLivesPanelProps) {
  const now = useRegenNow();

  const synced = applyLifeRegen(lives, now);
  const regenMs = msUntilNextLife(synced, now);
  const canBuy = synced.current < MAX_LIVES && coins >= LIFE_BUY_COST;

  return (
    <View style={styles.panel}>
      <Text style={styles.panelEmoji}>💔</Text>
      <Text style={styles.panelTitle}>Out of lives</Text>
      {regenMs !== null ? (
        <View style={styles.panelClockWrap}>
          <Text style={styles.panelClockLabel}>Next life in</Text>
          <LifeRegenClock regenMs={regenMs} compact={false} showProgress />
        </View>
      ) : (
        <Text style={styles.panelText}>Take a break and come back soon!</Text>
      )}

      {canBuy ? (
        <Pressable
          style={styles.buyBtn}
          onPress={onBuyLife}
          accessibilityRole="button"
          accessibilityLabel={`Buy a life for ${LIFE_BUY_COST} coins`}
        >
          <Text style={styles.buyBtnText}>
            Buy a life · {LIFE_BUY_COST} 🪙
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.cantBuy}>
          {coins < LIFE_BUY_COST
            ? `Need ${LIFE_BUY_COST} coins to buy a life`
            : 'Lives full'}
        </Text>
      )}

      {onBack ? (
        <Pressable
          style={styles.backBtn}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backBtnText}>Back to puzzle path</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(20),
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    borderWidth: 2,
    borderColor: GameColors.primary,
  },
  pillCompact: {
    paddingVertical: moderateScale(6),
    paddingHorizontal: moderateScale(10),
  },
  pillPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  emoji: {
    fontSize: moderateScale(16),
  },
  value: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: GameColors.text,
    fontVariant: ['tabular-nums'],
  },
  panelClockWrap: {
    alignItems: 'center',
    gap: moderateScale(8),
    width: '100%',
    maxWidth: moderateScale(220),
  },
  panelClockLabel: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: GameColors.textMuted,
  },
  panel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(20),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    padding: moderateScale(24),
    gap: moderateScale(10),
  },
  panelEmoji: {
    fontSize: moderateScale(40),
  },
  panelTitle: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    color: GameColors.text,
    textAlign: 'center',
  },
  panelText: {
    fontSize: moderateScale(15),
    fontWeight: '500',
    color: GameColors.textMuted,
    textAlign: 'center',
    lineHeight: moderateScale(22),
  },
  buyBtn: {
    marginTop: moderateScale(8),
    minHeight: moderateScale(48),
    borderRadius: moderateScale(14),
    backgroundColor: GameColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(20),
    width: '100%',
  },
  buyBtnText: {
    fontSize: moderateScale(16),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cantBuy: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: GameColors.textMuted,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: moderateScale(4),
    minHeight: moderateScale(44),
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: GameColors.text,
  },
});
