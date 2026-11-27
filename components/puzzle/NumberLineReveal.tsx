import { HelpProofContext } from './kit/HelpProofContext';
import { focusedScale, LandmarkLine } from './number-line/LandmarkLine';
import { useProofModelScroll } from '@/components/puzzle/place-value/ExchangeDetail';
import { DenseLabel, denseSpacing, useMeasuredLabels, valueToken } from '@/components/puzzle/kit/DenseLayout';
import { Caption, ProofCaption } from '@/components/puzzle/kit/Focus';
import { ProofFinale } from '@/components/puzzle/kit/ProofFeedback';
import { RevealSurface } from '@/components/puzzle/kit/RevealSurface';
import { useRevealBeats } from '@/components/puzzle/kit/useRevealBeats';
import { ProofMotion, Quantity, Radius } from '@/constants/puzzle-theme';
import { integerHopStops, landingEquation, lineValue, type HopRoute } from '@/utils/number-line-reveal';
import { Path, Skia } from '@shopify/react-native-skia';
import { useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';

import { FractionLineMarker, FractionLineRail, fractionHopHeight, fractionLineBaseline, fractionLineLabelOffset, fractionLineGutter, fractionLineSpacing, fractionMarkerSize } from './number-line/FractionLineRail';
import { PlayProofCaption, useProofViewport } from './PlayProofCaption';
import { ProofCanvas, useProofCanvasPaint } from './ProofCanvas';

function hopHeight(distance: number, limit: number) {
  'worklet';
  return Math.min(limit, Math.max(17, Math.abs(distance) * .67));
}

function addHop(path: ReturnType<typeof Skia.Path.Make>, from: number, length: number, baseline: number, progress: number, limit: number) {
  'worklet';
  const height = hopHeight(length, limit);
  const x = from + length * progress;
  const y = baseline - 4 * height * progress * (1 - progress);
  path.moveTo(from, baseline);
  path.quadTo(from + length * progress / 2, baseline - 2 * height * progress, x, y);
  if (progress >= .75) {
    const at = .74;
    const tipX = from + length * at;
    const tipY = baseline - 4 * height * at * (1 - at);
    const angle = Math.atan2(4 * height * (2 * at - 1), length);
    path.moveTo(tipX - 8 * Math.cos(angle - .56), tipY - 8 * Math.sin(angle - .56));
    path.lineTo(tipX, tipY);
    path.lineTo(tipX - 8 * Math.cos(angle + .56), tipY - 8 * Math.sin(angle + .56));
  }
}

type NumberLineRevealProps = { route: HopRoute; submitted?: number; onSolutionShown: () => void };

export function NumberLineReveal({ route, submitted, onSolutionShown }: NumberLineRevealProps) {
  if (route.divisions) return <FractionLineProof route={{ ...route, divisions: route.divisions }} onSolutionShown={onSolutionShown} />;
  return <IntegerLineProof route={route} submitted={submitted} onSolutionShown={onSolutionShown} />;
}

function IntegerLineProof({ route, submitted, onSolutionShown }: NumberLineRevealProps) {
  const help = useContext(HelpProofContext);
  const start = route.stops[0], goal = route.stops.at(-1)!;
  const mismatch = submitted !== undefined && submitted !== goal;
  const missedJudgment = submitted !== undefined && route.claim !== undefined;
  const frozen = submitted !== undefined && !missedJudgment;
  const stops = frozen && route.kind === 'integer' ? integerHopStops(start, submitted)
    : frozen ? [submitted] : route.kind === 'signed-move' && start !== goal ? [start, goal] : route.stops;
  const count = stops.length - 1;
  const beats = useRevealBeats(count, {
    awaitInitialPaint: true, lead: 100, minTotal: 0, reducedSteps: true,
    step: count === 1 ? 960 : Math.min(880, Math.floor(2440 / Math.max(1, count))),
    hold: i => i === count ? 300 : stops[i] === 0 ? 220 : 0, onDone: onSolutionShown,
  });
  const trackCanvas = useProofCanvasPaint(beats, true, [0]);
  const scale = focusedScale(start, goal, Math.min(route.min, submitted ?? start), Math.max(route.max, submitted ?? start), submitted ?? start);
  const equation = landingEquation(route, route.stops.length - 1);
  return <RevealSurface beats={beats}>
    <LandmarkLine scale={scale} start={start} goal={goal} route={stops} position={beats.position}
      annotate={route.kind === 'signed-move' && 'total'} settled={beats.settled} trackCanvas={trackCanvas}
      landed={beats.landed} submitted={frozen ? submitted : undefined} missLastHop={missedJudgment} />
    {beats.settled && (!frozen || mismatch) && <PlayProofCaption><View nativeID="play-proof-equation" testID="play-proof-equation">
      {help ? <Caption strong style={{ fontSize: 28, lineHeight: 36 }}>{equation}</Caption>
        : <ProofCaption text={mismatch ? `${lineValue(submitted)} ≠ ${lineValue(goal)}` : equation} />}</View></PlayProofCaption>}
  </RevealSurface>;
}

function FractionLineProof({ route, onSolutionShown }: { route: HopRoute & { divisions: number }; onSolutionShown: () => void }) {
  const { t } = useTranslation();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const proofViewport = useProofViewport();
  const modelScroll = useProofModelScroll(proofViewport?.availableModelHeight);
  const viewport = measured || proofViewport?.innerWidth || windowWidth - 56;
  const { min, max, stops, divisions } = route;
  const start = stops[0], end = stops.at(-1)!;
  const count = stops.length - 1;
  const fractionAttempt = route.kind === 'fraction-attempt';
  const deltas = stops.slice(1).map((to, index) => to - stops[index]);
  const signedMove = route.kind === 'signed-move';
  const singleStep = signedMove && count === 1 && Math.abs(deltas[0]) === 1;
  const repeated = count > 1 && deltas.every(delta => delta === deltas[0]);
  const hopLabel = (delta: number) => valueToken(`${delta > 0 ? '+' : ''}${lineValue(delta)}`);
  const longestHop = Math.max(1, ...deltas.map(delta => Math.abs(delta)));
  const stride = Math.max(1, Math.ceil((max - min) / 16));
  const labels = divisions ? [min, max] : Array.from({ length: max - min + 1 }, (_, i) => min + i)
    .filter(tick => {
      const pinned = [min, max, 0, start, end];
      return pinned.includes(tick) || tick % stride === 0 && pinned.every(value => Math.abs(value - tick) >= stride);
    });
  const tickLabel = (tick: number) => divisions && tick === divisions ? '1' : valueToken(lineValue(tick));
  const axis = useMeasuredLabels(labels.map(tickLabel), 'readout');
  const annotations = useMeasuredLabels(deltas.map(delta => divisions ? `${delta}/${divisions}` : hopLabel(delta)), divisions ? 'axis' : 'value');
  const numeralHeight = axis.height || 24 * fontScale;
  const annotationHeight = annotations.height || 26 * fontScale;
  const axisWidth = (axis.width || Math.max(lineValue(min).length, lineValue(max).length) * 10 * fontScale) + denseSpacing.label;
  const annotationWidth = (annotations.width || (String(longestHop).length + 1) * 10 * fontScale) + denseSpacing.label;
  const edgePad = Math.max(19, axisWidth / 2, annotationWidth / 2);
  const minUnit = Math.max(18, axisWidth + (divisions ? 6 : 0));
  const scrolls = minUnit * (max - min) + edgePad * 2 > viewport;
  const visibleTicks = Math.max(1, Math.floor(viewport / minUnit));
  const unit = divisions ? fractionLineSpacing(viewport, divisions + 1, axisWidth)
    : scrolls ? viewport / visibleTicks : (viewport - 2 * edgePad) / Math.max(1, max - min);
  const pad = divisions ? fractionLineGutter : scrolls ? Math.max(edgePad, unit / 2) : edgePad;
  const width = divisions || scrolls ? unit * (max - min) + pad * 2 : viewport;
  const canScroll = divisions ? width > viewport + 1 : scrolls;
  // Settle between tick labels so the viewport edges never show half a numeral.
  const offsets = useMemo(() => divisions ? Array.from({ length: divisions + 1 }, (_, index) =>
    Math.max(0, Math.min(width - viewport, index * unit))) : scrolls
    ? Array.from({ length: Math.max(1, max - min + 2 - visibleTicks) }, (_, i) => pad - unit / 2 + i * unit)
    : [0], [divisions, max, min, pad, scrolls, unit, viewport, visibleTicks, width]);
  const annotationSpace = fractionAttempt ? 0 : annotationHeight + (divisions ? denseSpacing.mark : 0);
  const labelSpace = 14 + numeralHeight + denseSpacing.label;
  const arcSpace = fractionAttempt ? 24
    : Math.max(21, Math.min(48, (proofViewport?.availableModelHeight ?? Infinity) - annotationSpace - labelSpace - 12));
  const arcLimit = divisions ? fractionHopHeight : arcSpace - 4;
  const baseline = divisions ? fractionLineBaseline : arcSpace + annotationSpace;
  const labelsY = baseline + (divisions ? fractionLineLabelOffset : 14);
  const stageHeight = labelsY + numeralHeight + denseSpacing.label;
  const signed = route.kind === 'signed-move' || route.kind === 'signed-place';
  const layoutReady = measured > 0 && contentWidth > 0 && axis.ready && annotations.ready;
  const beats = useRevealBeats(layoutReady ? count : null, {
    awaitInitialPaint: true,
    lead: singleStep ? ProofMotion.beat[300] : ProofMotion.beat[120], minTotal: 0, reducedSteps: true,
    step: singleStep ? ProofMotion.beat[360] : signed ? ProofMotion.group : ProofMotion.travel,
    hold: index => singleStep ? ProofMotion.beat[360] : index === count ? ProofMotion.settle
      : signed || repeated && count <= 7 ? ProofMotion.repeatHold : 0, onDone: onSolutionShown,
  });
  const trackCanvas = useProofCanvasPaint(beats, layoutReady, [0]);
  const { landed, position, done, settled, reduced } = beats;
  const landingX = pad + (stops[landed] - min) * unit;
  const startX = pad + (start - min) * unit;
  const offsetFor = (point: number) => {
    const left = Math.min(point - axisWidth / 2, startX - annotationWidth / 2);
    const right = Math.max(point + axisWidth / 2, startX + annotationWidth / 2);
    const center = point - viewport / 2;
    const both = offsets.filter(offset => offset <= left && offset + viewport >= right);
    const choices = both.length ? both : offsets;
    return choices.reduce((nearest, offset) => Math.abs(offset - center) < Math.abs(nearest - center) ? offset : nearest);
  };
  const initialOffset = offsetFor(startX);
  const landingOffset = offsetFor(landingX);
  const contentOffset = useMemo(() => ({ x: initialOffset, y: 0 }), [initialOffset]);
  useLayoutEffect(() => {
    if (!measured || !contentWidth) return;
    scroll.current?.scrollTo({ x: landingOffset, animated: landed > 0 && !reduced });
  }, [contentWidth, landed, landingOffset, measured, reduced]);
  const frame = useDerivedValue(() => {
    const beat = reduced ? landed : position.get();
    const index = Math.max(0, Math.ceil(beat) - 1);
    const phase = beat - index;
    const from = stops[index];
    const length = count ? (stops[index + 1] - from) * unit : 0;
    const x = pad + (from - min) * unit + length * phase;
    const y = baseline - 4 * hopHeight(length, arcLimit) * phase * (1 - phase);
    return { index, phase, x, y };
  });
  const quantity = divisions ? Quantity.violet : Quantity.teal;
  const marker = useAnimatedStyle(() => {
    const { x, y, phase } = frame.get();
    const radius = fractionMarkerSize / 2;
    const landScale = divisions && !reduced ? 1 + .18 * Math.max(0, 1 - Math.abs(phase - .95) / .1) : 1;
    return { transform: [{ translateX: x - radius }, { translateY: y - radius }, { scale: landScale }] };
  });
  const recent = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const { index, phase } = frame.get();
    if (count) addHop(path, pad + (stops[index] - min) * unit, (stops[index + 1] - stops[index]) * unit, baseline, phase, arcLimit);
    return path;
  });
  const trail = useMemo(() => {
    const trail = Skia.Path.Make();
    for (let index = 0; index < landed; index++) {
      addHop(trail, pad + (stops[index] - min) * unit, (stops[index + 1] - stops[index]) * unit, baseline, 1, arcLimit);
    }
    return trail;
  }, [arcLimit, baseline, landed, min, pad, stops, unit]);
  const fractionValue = `${stops[landed]}/${divisions}`;
  const fractionResult = !settled ? fractionValue
    : route.equivalent || end === divisions ? landingEquation(route, landed)
    : repeated && deltas[0] === 1 ? `${count === 2 ? `1/${divisions} + 1/${divisions}` : `${count} × 1/${divisions}`} = ${fractionValue}` : fractionValue;
  const fractionEquation = divisions && settled ? <View testID="line-solution-equation" accessibilityLiveRegion="polite">
    <ProofFinale settled={settled}><ProofCaption text={fractionResult} /></ProofFinale>
  </View> : null;
  return <RevealSurface beats={beats} style={styles.surface} replayable={!fractionAttempt}>
    <View style={[styles.wrap, divisions ? styles.fractionWrap : undefined]}>
      <View {...modelScroll} nativeID="play-proof-model" testID="play-proof-model" style={styles.stage} onLayout={event => {
        modelScroll.onLayout(event);
        setMeasured(event.nativeEvent.layout.width);
      }}>
        {axis.probe}{annotations.probe}
        <ScrollView ref={scroll} horizontal scrollEnabled={canScroll} contentOffset={contentOffset} onContentSizeChange={setContentWidth}
          snapToOffsets={canScroll ? offsets : undefined} showsHorizontalScrollIndicator={canScroll} style={{ height: stageHeight }}>
          <View style={{ width, height: stageHeight }}>
            <FractionLineRail baseline={baseline} spacing={unit} count={divisions + 1} testPrefix="reveal-line-tick-" />
            <ProofCanvas trackCanvas={trackCanvas} style={StyleSheet.absoluteFill} accessible={false} pointerEvents="none">
              {/* friendly-ok: completed number-line hop arcs */}
              <Path path={trail} color={fractionAttempt ? Quantity.amber.fill : Quantity.violet.fill} style="stroke" strokeWidth={8} strokeCap="round" />
              {/* friendly-ok: current number-line hop arc */}
              {!done && !reduced ? <Path path={recent} color={fractionAttempt ? Quantity.amber.fill : Quantity.violet.fill} style="stroke" strokeWidth={8} strokeCap="round" /> : null}
            </ProofCanvas>
            <Animated.View pointerEvents="none" style={[styles.fractionMarker, marker]}>
              <FractionLineMarker amber={fractionAttempt} />
            </Animated.View>
            {!settled && count > 0 && (!divisions || landed === 0) ? (() => {
              const index = Math.min(count - 1, landed);
              const from = stops[index], delta = deltas[index];
              const at = pad + ((from + stops[index + 1]) / 2 - min) * unit;
              const captionWidth = annotationWidth;
              return <View style={[styles.label, {
                left: Math.max(0, Math.min(width - captionWidth, at - captionWidth / 2)), width: captionWidth,
                top: Math.max(0, baseline - hopHeight(delta * unit, arcLimit) - annotationHeight - denseSpacing.mark),
              }]}>{divisions ? <DenseLabel role="axis">{`${delta}/${divisions}`}</DenseLabel>
                : <DenseLabel role="value">{hopLabel(delta)}</DenseLabel>}</View>;
            })() : null}
            {labels.map(tick => <View key={tick} style={[styles.label, settled && tick === end && { backgroundColor: quantity.soft, borderRadius: Radius.piece },
              { top: labelsY, left: pad + (tick - min) * unit - axisWidth / 2, width: axisWidth }]}>
              <DenseLabel role="readout">{tickLabel(tick)}</DenseLabel>
            </View>)}
          </View>
        </ScrollView>
      </View>
      {route.claim ? <Caption>{t('puzzleTypes.minkaSays')} {route.claim}</Caption> : null}
      {settled && !fractionAttempt ? <PlayProofCaption>
        <View nativeID="play-proof-equation" testID="play-proof-equation" style={styles.equationSlot}>
          {divisions ? fractionEquation : <View testID="line-solution-equation">
            <ProofCaption text={landingEquation(route, landed, settled)}
              reserveTexts={stops.flatMap((_, index) => [landingEquation(route, index), landingEquation(route, index, false)])} />
          </View>}
        </View>
      </PlayProofCaption> : null}
    </View>
  </RevealSurface>;
}

const styles = StyleSheet.create({
  surface: { alignSelf: 'stretch' },
  wrap: { alignSelf: 'stretch', alignItems: 'center', gap: 10, paddingVertical: 8 },
  fractionWrap: { paddingTop: 0 },
  fractionMarker: { position: 'absolute', top: 0, left: 0 },
  stage: { width: '100%', maxWidth: 480 },
  label: { position: 'absolute', alignItems: 'center' },
  equationSlot: { alignSelf: 'stretch', justifyContent: 'center' },
});
