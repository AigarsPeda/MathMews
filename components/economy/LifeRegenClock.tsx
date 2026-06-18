import { GameColors, LIFE_REGEN_MINUTES } from '@/constants/game';
import { formatRegenClock, regenProgress } from '@/utils/lives';
import { moderateScale } from '@/utils/scale';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

type LifeRegenClockProps = {
  regenMs: number;
  compact?: boolean;
  showProgress?: boolean;
};

function BlinkingColon({ large = false }: { large?: boolean }) {
  return (
    <Animated.Text
      style={[large ? styles.colonLarge : styles.colon, styles.colonBlink]}
    >
      :
    </Animated.Text>
  );
}

function DigitalTime({ display, large = false }: { display: string; large?: boolean }) {
  const parts = display.split(':');
  const timeStyle = large ? styles.timeLarge : styles.time;

  return (
    <View style={styles.digitsRow}>
      {parts.map((part, index) => (
        <View key={`${part}-${index}`} style={styles.digitGroup}>
          {index > 0 ? <BlinkingColon large={large} /> : null}
          <Text style={timeStyle}>{part}</Text>
        </View>
      ))}
    </View>
  );
}

export function LifeRegenClock({
  regenMs,
  compact = true,
  showProgress = !compact,
}: LifeRegenClockProps) {
  const display = useMemo(() => formatRegenClock(regenMs), [regenMs]);
  const progress = useMemo(() => regenProgress(regenMs), [regenMs]);

  return (
    <View
      style={[styles.wrap, compact && styles.wrapCompact]}
      accessibilityRole="timer"
      accessibilityLabel={`Next life in ${display}`}
    >
      <View style={styles.timeRow}>
        {compact ? <Text style={styles.plus}>+</Text> : null}
        <DigitalTime display={display} large={!compact && showProgress} />
      </View>

      {showProgress ? (
        <View
          style={styles.progressTrack}
          accessibilityLabel={`${Math.round(progress * 100)} percent until next life`}
        >
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      ) : null}

      {!compact && showProgress ? (
        <Text style={styles.progressHint}>
          Refills every {LIFE_REGEN_MINUTES} min
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: moderateScale(8),
    width: '100%',
    maxWidth: moderateScale(220),
  },
  wrapCompact: {
    alignItems: 'flex-start',
    gap: 0,
    width: 'auto',
    maxWidth: 'none',
    marginLeft: moderateScale(2),
    paddingLeft: moderateScale(6),
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 107, 107, 0.2)',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  plus: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: GameColors.textMuted,
    marginRight: moderateScale(1),
  },
  digitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  digitGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: GameColors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  timeLarge: {
    fontSize: moderateScale(36),
    fontWeight: '800',
    color: GameColors.primary,
    fontVariant: ['tabular-nums'],
  },
  colon: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: GameColors.textMuted,
  },
  colonLarge: {
    fontSize: moderateScale(36),
    fontWeight: '800',
    color: GameColors.primary,
  },
  colonBlink: {
    animationName: {
      '0%': { opacity: 1 },
      '50%': { opacity: 0.25 },
      '100%': { opacity: 1 },
    },
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  },
  progressTrack: {
    height: moderateScale(4),
    borderRadius: moderateScale(2),
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    borderRadius: moderateScale(2),
    backgroundColor: GameColors.primary,
  },
  progressHint: {
    fontSize: moderateScale(12),
    fontWeight: '500',
    color: GameColors.textMuted,
    textAlign: 'center',
  },
});
