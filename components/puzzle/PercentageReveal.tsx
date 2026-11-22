import { distanceAtStops } from '@/utils/puzzle-motion';
import { BaseTenGrid } from '@/components/puzzle/BaseTenGrid';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { PuzzleColors as Colors } from '@/constants/puzzle-theme';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { percentageAmount, percentageFraction, type PercentagePart, type PercentagePlan } from '@/utils/percentage-reveal';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { cancelAnimation, Easing, useAnimatedReaction, useDerivedValue, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

function PercentageGrid({ part, progress, count, done, size, compact }: {
  part: PercentagePart; progress: SharedValue<number>; count: number; done: boolean; size: number; compact: boolean;
}) {
  const { t } = useTranslation();
  const { percent, whole, label, kind } = part;
  const fill = useDerivedValue(() => Math.max(0, Math.min(percent, progress.get())));
  const shown = Math.max(0, Math.min(count, percent));
  const amount = percentageAmount(part);
  let rate = `${shown}/100 = ${shown}%`;
  if (done) rate = compact ? t('challenges.discount', { percent }) : `${rate} = ${percentageFraction(percent)}`;
  return <View style={[styles.part, compact && { maxWidth: size + 18 }]}>
    {label && <Text style={styles.item}>{label}</Text>}
    <Text style={styles.whole}>{t('percentageSolution.whole', { whole: t('percentageSolution.coins', { count: whole }) })}</Text>
    <BaseTenGrid size={size} amount={fill} />
    <Text testID={compact ? undefined : "percentage-rate"} style={[styles.rate, compact && styles.smallRate]}>
      {rate}
    </Text>
    {done && (compact || kind === 'sale') && (compact
      ? <Text style={styles.detail}>{`${whole} − ${amount} = ${whole - amount}`}</Text>
      : <Text style={styles.detail}>{t('percentageSolution.saved', { percent, amount: t('percentageSolution.coins', { count: amount }) })}</Text>)}
  </View>;
}

export function PercentageReveal({ plan, onSolutionShown }: { plan: PercentagePlan; onSolutionShown: () => void }) {
  const { t } = useTranslation();
  const { active, reduceMotion } = useAnimationActivity();
  const { width, height, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [count, setCount] = useState(-1);
  const clock = useSharedValue(0);
  const target = Math.max(0, ...plan.parts.map(part => part.percent));
  const stops = useMemo(() => {
    const rows = Array.from({ length: Math.floor(target / 10) + 1 }, (_, i) => i * 10);
    return [...new Set([...rows, ...plan.parts.map(part => part.percent)])].sort((a, b) => a - b);
  }, [plan, target]);
  const progress = useDerivedValue(() => distanceAtStops(clock.get(), stops, 2));
  const done = count === target;
  useEffect(() => {
    if (!active || reduceMotion || target === 0) {
      clock.set(target);
    } else if (clock.get() < target) {
      clock.set(withDelay(220, withTiming(target, {
        duration: Math.max(1700, Math.min(4400, target * 105)), easing: Easing.linear,
      })));
    }
    return () => cancelAnimation(clock);
  }, [active, reduceMotion, target, clock]);
  useAnimatedReaction(() => Math.floor(Math.max(0, Math.min(target, progress.get()))), (next, last) => {
    if (next !== last) scheduleOnRN(setCount, next);
  });
  useEffect(() => { if (done) onSolutionShown(); }, [done, onSolutionShown]);
  const { parts, budget } = plan;
  const compact = parts.length > 1;
  const stacked = compact && fontScale > 1.3;
  const available = measuredWidth || width - 56;
  const size = compact ? Math.min(132, stacked ? available : (available - 48) / parts.length) : Math.min(210, height * .28, available);
  const first = parts[0];
  const saved = percentageAmount(first);
  const prices = parts.map(part => part.whole - percentageAmount(part));
  const coins = (count: number) => t('percentageSolution.coins', { count });
  const result = budget !== undefined
    ? t('percentageSolution.budget', { budget, prices: prices.join(' − '), remaining: coins(budget - prices.reduce((sum, price) => sum + price, 0)) })
    : first.kind === 'sale'
      ? t('percentageSolution.sale', { whole: first.whole, amount: saved, price: coins(first.whole - saved) })
      : t('percentageSolution.amount', { percent: first.percent, whole: first.whole, amount: coins(saved) });
  return <View style={[styles.wrap, compact && styles.cart]} onLayout={e => setMeasuredWidth(e.nativeEvent.layout.width)}>
    <View style={[styles.grids, stacked && styles.stacked]}>
      {parts.map((part, i) => <PercentageGrid key={i} part={part} count={count} done={done} size={size} progress={progress} compact={compact} />)}
    </View>
    {done &&
      <Text testID="percentage-result" style={styles.result} accessibilityLiveRegion="polite">{result}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', alignSelf: 'stretch', gap: 10, paddingVertical: 8 },
  cart: { paddingTop: 18 },
  grids: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 10 },
  stacked: { flexDirection: 'column', alignItems: 'center' },
  part: { alignItems: 'center', gap: 6, flexShrink: 1 },
  item: { color: Colors.text, textAlign: 'center', fontSize: 16, fontWeight: '800' },
  whole: { color: Colors.coinText, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  rate: { color: Colors.primaryDark, textAlign: 'center', fontSize: 25, fontWeight: '800', fontVariant: ['tabular-nums'] },
  smallRate: { fontSize: 17 },
  detail: { color: Colors.text, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  result: { color: Colors.text, textAlign: 'center', fontSize: 21, fontWeight: '800' },
});
