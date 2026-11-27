import { DecimalTenths, usesTenthsSquare } from './place-value/DecimalTenths';
import { useProofModelScroll } from '@/components/puzzle/place-value/ExchangeDetail';
import { PlayProofCaption, useProofViewport } from '@/components/puzzle/PlayProofCaption';
import { BaseTenGrid } from '@/components/puzzle/BaseTenGrid';
import { Caption } from '@/components/puzzle/kit/Focus';
import { ProofFinale } from '@/components/puzzle/kit/ProofFeedback';
import { RevealSurface } from '@/components/puzzle/kit/RevealSurface';
import { useRevealBeats } from '@/components/puzzle/kit/useRevealBeats';
import { DecimalPlaceMat } from '@/components/puzzle/place-value/DecimalPlaceMat';
import { ProofMotion } from '@/constants/puzzle-theme';
import { changeDecimalPlace, initialDecimalPlace, decimalLabel, decimalTotal, type DecimalPlaceState, type DecimalUnit } from '@/utils/decimal-models';
import { decimalEquation, decimalFillAt, decimalGroupingMasks, decimalRevealModel, type DecimalPuzzle } from '@/utils/decimal-reveal';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';

import { useProofCanvasPaint } from './ProofCanvas';

function placeDigits(amount: number) {
  return { ones: Math.floor(amount / 100), tenths: Math.floor(amount % 100 / 10), hundredths: amount % 10 };
}

export function DecimalReveal({ puzzle, selected, submitted, mode = 'worked', onSolutionShown }: {
  puzzle: DecimalPuzzle; selected?: readonly number[]; submitted?: DecimalPlaceState;
  mode?: 'attempt' | 'worked'; onSolutionShown: () => void;
}) {
  const mask = useMemo(() => selected ? [...new Set(selected)].sort((a, b) => a - b) : undefined, [selected]);
  const model = useMemo(() => decimalRevealModel(puzzle, mask, mode === 'attempt' ? submitted : undefined), [mask, mode, puzzle, submitted]);
  const { t, i18n } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const viewport = useProofViewport();
  const modelScroll = useProofModelScroll(viewport?.availableModelHeight);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const { exchange, total, grid, scale } = model;
  const size = Math.min(fontScale >= 1.5 ? 208 : 280, width - 56);
  const tenthsSquare = puzzle.type === 'decimal_place_value' && usesTenthsSquare(puzzle) && !(submitted?.ones || submitted?.hundredths);
  const checkedMask = useMemo(() => grid ? mask ?? Array.from({ length: total * scale / 100 }, (_, i) => i) : undefined,
    [grid, mask, scale, total]);
  const steps = useMemo(() => grid && scale === 100
    ? model.steps.filter((step, i) => step % 10 === 0 || i === model.steps.length - 1)
    : model.steps, [grid, model.steps, scale]);
  const grouping = checkedMask && grid && scale === 100 ? decimalGroupingMasks(checkedMask, steps) : null;
  const submittedOnly = mode === 'attempt' && Boolean(submitted);
  const traceSubmitted = !submittedOnly && !exchange && submitted && decimalTotal(submitted) === total ? submitted : undefined;
  const count = tenthsSquare ? total / 10 : submittedOnly ? 1 : exchange ? 2 : steps.length - 1;
  const canvasIndices = grid && !checkedMask ? [0] : [];
  const beats = useRevealBeats(measuredWidth ? count : null, {
    awaitInitialPaint: canvasIndices.length > 0,
    lead: ProofMotion.beat[120], minTotal: 0, reducedSteps: true,
    step: index => tenthsSquare ? 230 : submittedOnly ? ProofMotion.beat[120] : exchange ? index ? 1150 : 300
      : grid ? grouping ? ProofMotion.beat[300] : ProofMotion.beat[160] : ProofMotion.beat[180],
    hold: index => index === count
      ? exchange && !submittedOnly ? ProofMotion.inspection : ProofMotion.settle
      : !tenthsSquare && !grid && !exchange ? ProofMotion.press : 0,
    onDone: onSolutionShown,
  });
  const trackCanvas = useProofCanvasPaint(beats, measuredWidth > 0, canvasIndices);
  const { landed, progress, position, settled, reduced } = beats;
  const preview = useDerivedValue(() => decimalFillAt(steps, position.get()));
  const exchangeProgress = useDerivedValue(() => Math.max(0, position.get() - 1));
  const readStep = landed;
  const shown = exchange ? total : steps[readStep];
  const exchangeLanded = landed === count;
  const stable = (submittedOnly ? submitted : traceSubmitted)
    ?? (exchange ? (exchangeLanded ? exchange.after : exchange.before) : placeDigits(shown));
  const incoming = exchange?.after ?? placeDigits(steps[Math.min(steps.length - 1, readStep + 1)]);
  const final = decimalEquation(model, total, true, i18n.language);
  const captions = steps.map(amount => {
    const { ones, tenths, hundredths } = placeDigits(amount);
    return [
      ones ? String(ones) : null,
      tenths || scale === 10 ? t('decimalModels.countTenths', { count: tenths }) : null,
      scale === 100 && hundredths ? t('decimalModels.countHundredths', { count: hundredths }) : null,
    ].filter(Boolean).join(' + ');
  });

  const units: readonly DecimalUnit[] = ['ones', 'tenths', 'hundredths'];
  const traced = placeDigits(shown);
  const preceding = placeDigits(steps[Math.max(0, readStep - 1)]);
  const traceUnit = traceSubmitted && !settled && readStep > 0 ? units.find(unit => traced[unit] > preceding[unit]) : undefined;
  const expectedExchange = exchange && puzzle.type === 'decimal_place_value' && submittedOnly && settled
    ? changeDecimalPlace(puzzle, initialDecimalPlace(puzzle), { kind: exchange.mode, unit: exchange.unit }) : undefined;
  // A rejected true statement still has the right counts. Mark the exchanged piece.
  const exchangedUnit = exchange?.mode === 'bundle' ? exchange.unit === 'hundredths' ? 'tenths' : 'ones' : exchange?.unit;
  const differenceUnit = expectedExchange && (units.find(unit => stable[unit] > expectedExchange[unit])
    ?? units.find(unit => stable[unit] && stable[unit] < expectedExchange[unit]) ?? exchangedUnit);
  const trace = differenceUnit ? { unit: differenceUnit, index: stable[differenceUnit] - 1 } : traceUnit ? { unit: traceUnit, index: traced[traceUnit] - 1 } : undefined;
  const decimal = decimalLabel(total, puzzle.payload.digits, i18n.language);
  const digits = placeDigits(total);
  const terms = puzzle.type === 'decimal_place_value' && !exchange && !submittedOnly
    ? puzzle.payload.units.filter(unit => digits[unit]).map(unit => {
      const weight = unit === 'ones' ? '1' : decimalLabel(unit === 'tenths' ? 10 : 1, unit === 'tenths' ? 1 : 2, i18n.language);
      return `${digits[unit]} × ${weight}`;
    }) : [];
  const wanted = puzzle.payload.hundredths;
  const visibleMask = grouping?.[landed]?.cells ?? checkedMask;
  const targetCount = wanted * scale / 100;
  const difference = !settled || !visibleMask || visibleMask.length === targetCount ? undefined : visibleMask.length > targetCount
    ? [...visibleMask].sort((a, b) => a - b).slice(targetCount)
    : Array.from({ length: scale }, (_, i) => i).filter(i => !visibleMask.includes(i)).slice(0, targetCount - visibleMask.length);
  const placeMat = puzzle.type === 'decimal_place_value';
  const finalCaption = mode === 'attempt' && wanted !== total
    ? `${decimalLabel(total, total % 10 ? 2 : puzzle.payload.digits, i18n.language)} ≠ ${decimalLabel(wanted, puzzle.payload.digits, i18n.language)}`
    : grid ? `${captions.at(-1) || '0'} = ${decimal}` : terms.length ? `${terms.join(' + ')} = ${decimal}` : final;
  return <RevealSurface beats={beats} style={styles.surface} replayable>
    <View style={[styles.wrap, placeMat && { paddingVertical: 0 }]} onLayout={event => setMeasuredWidth(event.nativeEvent.layout.width)}>
      <View {...modelScroll} nativeID="play-proof-model" testID="play-proof-model" style={styles.models}>
        {tenthsSquare ? <DecimalTenths count={total / 10} selected={submitted?.selectedTenths} target={wanted / 10} checked={settled} />
          : puzzle.type === 'decimal_place_value' ? <DecimalPlaceMat viewport={viewport} state={stable} units={exchange?.unit === 'hundredths' && !stable.ones ? ['tenths', 'hundredths'] : puzzle.payload.units} trace={trace} exchangeUnit={exchange?.unit}
          capacity={exchange ? { ...exchange.before, ones: Math.max(exchange.before.ones, exchange.after.ones),
            tenths: Math.max(exchange.before.tenths, exchange.after.tenths), hundredths: Math.max(exchange.before.hundredths, exchange.after.hundredths) } : placeDigits(total)}
          preview={submittedOnly || traceSubmitted || reduced || exchangeLanded || exchange && landed === 0 ? undefined : { state: incoming, progress: exchange ? exchangeProgress : progress }} /> : <>
          <BaseTenGrid trackCanvas={trackCanvas} size={size} amount={checkedMask ? total : shown}
            preview={reduced || checkedMask ? undefined : preview} scale={scale} hue="teal"
            groupedColumns={grouping ? Math.floor(shown / 10) : 0} difference={difference}
            selected={visibleMask} moving={reduced ? undefined : grouping?.[landed + 1]?.moving}
            transfer={reduced || !grouping ? undefined : { position, beat: landed }} />
        </>}
      </View>
      {settled ? <PlayProofCaption>
        <View testID="decimal-solution-equation" style={styles.proofLane}>
          <ProofFinale settled={settled}>
            <Caption strong nativeID="play-proof-equation" testID="play-proof-equation"
              numberOfLines={exchange && fontScale >= 2 ? 1 : undefined} adjustsFontSizeToFit={!!exchange && fontScale >= 2} minimumFontScale={0.65}
              accessible accessibilityRole="text" accessibilityLiveRegion="polite">{finalCaption}</Caption>
          </ProofFinale>
        </View>
      </PlayProofCaption> : placeMat ? <PlayProofCaption>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Caption strong>{'\u00a0'}</Caption></View>
      </PlayProofCaption> : null}
    </View>
  </RevealSurface>;
}

const styles = StyleSheet.create({
  surface: { alignSelf: 'stretch' },
  wrap: { alignSelf: 'stretch', alignItems: 'center', gap: 10, paddingVertical: 8 },
  models: { alignSelf: 'stretch', alignItems: 'center', gap: 10 },
  proofLane: { alignSelf: 'stretch', minWidth: 0 },
});
