import { useProofModelScroll } from '@/components/puzzle/place-value/ExchangeDetail';
import { PercentageShareBar } from './percentage/PercentageShareBar';
import { useRevealBeats } from '@/components/puzzle/kit/useRevealBeats';
import { RevealSurface } from '@/components/puzzle/kit/RevealSurface';
import { countabilityFloor } from '@/components/puzzle/kit/DenseLayout';
import { PlayProofCaption, useProofViewport } from '@/components/puzzle/PlayProofCaption';
import { BaseTenGrid } from '@/components/puzzle/BaseTenGrid';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { Caption, ProofCaption } from '@/components/puzzle/kit/Focus';
import { Ink, ProofMotion, Shape, Stroke } from '@/constants/puzzle-theme';
import { decimalFillAt } from '@/utils/decimal-reveal';
import { percentageAmount, percentageShareParts, type PercentagePart, type PercentagePlan } from '@/utils/percentage-reveal';
import { moderateScale } from '@/utils/scale';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { useProofCanvasPaint, type TrackProofCanvas } from './ProofCanvas';

function PercentageGrid({ part, progress, count, settled, size, compact, share, submitted, trackCanvas, canvasIndex }: {
  part: PercentagePart; progress: SharedValue<number>; count: number; settled: boolean; size: number; compact: boolean; share: number | null; submitted?: number;
  trackCanvas?: TrackProofCanvas; canvasIndex: number;
}) {
  const { t } = useTranslation();
  const { percent, whole, label } = part;
  const fill = useDerivedValue(() => Math.max(0, Math.min(percent, progress.get())));
  const shown = Math.max(0, Math.min(count, percent));
  const amount = percentageAmount(part);
  const wholeLabel = t('percentageSolution.whole', { whole: t('percentageSolution.coins', { count: whole }) });
  const rate = settled && compact ? t('challenges.discount', { percent }) : `${shown}/100 = ${shown}%`;
  return <View style={[styles.part, compact && { maxWidth: size + 18 }]}>
    {label && <Caption strong>{label}</Caption>}
    {share ? <PercentageShareBar parts={share} width={size} progress={progress}
      whole={whole} settled={settled} submitted={submitted} /> : <>
      <Caption>{wholeLabel}</Caption>
      <BaseTenGrid trackCanvas={trackCanvas} canvasIndex={canvasIndex} size={size} amount={shown} preview={fill} />
      {(compact || !settled) && <Text testID={compact ? undefined : "percentage-rate"} style={[styles.rate, compact && styles.smallRate]}>{rate}</Text>}
    </>}
    {settled && compact ? <Caption strong>{`${whole} − ${amount} = ${whole - amount}`}</Caption> : null}
  </View>;
}

export function PercentageReveal({ plan, onSolutionShown, submitted }: { plan: PercentagePlan; submitted?: number; onSolutionShown: () => void }) {
  const { t } = useTranslation();
  const { width, height, fontScale } = useWindowDimensions();
  const viewport = useProofViewport();
  const modelScroll = useProofModelScroll(viewport?.availableModelHeight);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const { parts, budget } = plan;
  const compact = parts.length > 1;
  const first = parts[0];
  const share = !compact && first.kind === 'amount' ? percentageShareParts(first.percent) : null;
  const target = Math.max(0, ...parts.map(part => part.percent));
  const stops = useMemo(() => {
    if (share) return [0, 0, 0, target];
    const chunk = target > 70 ? 20 : 10;
    const columns = Array.from({ length: Math.floor(target / chunk) + 1 }, (_, i) => i * chunk);
    return [...new Set([...columns, ...parts.map(part => part.percent)])].sort((a, b) => a - b);
  }, [parts, share, target]);
  const canvasIndices = share ? [] : parts.map((_, index) => index);
  const beats = useRevealBeats(measuredWidth ? stops.length - 1 : null, {
    awaitInitialPaint: canvasIndices.length > 0,
    lead: 0, minTotal: 0, reducedSteps: true,
    step: index => share ? [ProofMotion.beat[120], ProofMotion.group, ProofMotion.travel][index] : ProofMotion.beat[160],
    hold: index => index === stops.length - 1 ? ProofMotion.settle : 0,
    onDone: onSolutionShown,
  });
  const trackCanvas = useProofCanvasPaint(beats, measuredWidth > 0, canvasIndices);
  const { landed, position, settled, reduced } = beats;
  const shareProgress = useDerivedValue(() => reduced ? Math.max(0, landed - 1) : Math.max(0, position.get() - 1));
  const preview = useDerivedValue(() => decimalFillAt(stops, position.get()));
  const count = stops[landed];
  const scale = viewport?.fontScale ?? fontScale;
  const available = measuredWidth || viewport?.innerWidth || width - 56;
  const gridFloor = 10 * (countabilityFloor('cell', scale >= 1.5) + Shape.space.seam + Shape.stroke.seam) + Stroke.outline;
  const stacked = compact && (scale > 1.3 || Boolean(viewport && available < parts.length * gridFloor + 24));
  const gridBudget = viewport ? viewport.availableModelHeight - 52 * scale - 16 : height * .34;
  const size = share ? (viewport?.innerWidth ?? width - 52)
    : viewport ? Math.max(gridFloor, Math.min(268, gridBudget, stacked || !compact ? available : (available - 24) / parts.length))
      : compact ? Math.min(132, stacked ? available : (available - 24) / parts.length) : Math.min(268, gridBudget, available);
  const saved = percentageAmount(first);
  const prices = parts.map(part => part.whole - percentageAmount(part));
  const coins = (count: number) => t('percentageSolution.coins', { count });
  const result = budget !== undefined
    ? t('percentageSolution.budget', { budget, prices: prices.join(' − '), remaining: coins(budget - prices.reduce((sum, price) => sum + price, 0)) })
    : first.kind === 'sale'
      ? t('percentageSolution.sale', { whole: first.whole, amount: saved, price: coins(first.whole - saved) })
      : t('percentageSolution.amount', { percent: first.percent, whole: first.whole, amount: coins(saved) });
  return <RevealSurface beats={beats} style={styles.surface}>
    <View style={[styles.wrap, compact && styles.cart]} onLayout={e => setMeasuredWidth(e.nativeEvent.layout.width)}>
      <View {...modelScroll} nativeID="play-proof-model" testID="play-proof-model" style={[styles.grids, stacked && styles.stacked]}>
        {parts.map((part, i) => <PercentageGrid key={i} part={part} count={count} settled={settled}
          size={size} progress={share ? shareProgress : preview} compact={compact} share={share} submitted={submitted} trackCanvas={trackCanvas} canvasIndex={i} />)}
      </View>
      {settled ? <PlayProofCaption>
        <View nativeID="play-proof-equation" testID="play-proof-equation" style={styles.resultSlot}>
          <View testID="percentage-result">
            <ProofCaption text={submitted != null && share && submitted !== saved ? `${submitted} ≠ ${first.percent}% × ${first.whole}` : result} />
          </View>
        </View>
      </PlayProofCaption> : null}
    </View>
  </RevealSurface>;
}

const styles = StyleSheet.create({
  surface: { alignSelf: 'stretch' },
  resultSlot: { minHeight: 30 },
  wrap: { alignItems: 'center', alignSelf: 'stretch', gap: 10, paddingVertical: 8 },
  cart: { paddingTop: 18 },
  grids: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 10 },
  stacked: { flexDirection: 'column', alignItems: 'center' },
  part: { alignItems: 'center', gap: 6, flexShrink: 1 },
  rate: { color: Ink.text, textAlign: 'center', fontSize: moderateScale(25), fontWeight: '800', fontVariant: ['tabular-nums'] },
  smallRate: { fontSize: moderateScale(17) },
});
