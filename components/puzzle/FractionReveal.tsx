import { PieSelectionProof } from './fraction/PieSelectionProof';
import { EquivalentProof } from './fraction/EquivalentProof';
import { useProofModelScroll } from '@/components/puzzle/place-value/ExchangeDetail';
import { FractionPairBadge } from '@/components/puzzle/FractionMatchTask';
import { FractionGridChart } from '@/components/puzzle/FractionGridChart';
import { createPieGeometry, createWedgePath, PiePieces, pieFaceRadius } from '@/components/puzzle/FractionPieChart';
import { PlayProofCaption, useProofViewport } from '@/components/puzzle/PlayProofCaption';
import { FractionStrip, fractionStripGap, fractionStripHeight } from '@/components/puzzle/fraction/FractionStrip';
import { FractionGroupTape } from '@/components/puzzle/fraction/FractionGroupTape';
import { FractionWholeFace } from '@/components/puzzle/fraction/FractionWholeFace';
import { FractionNotation } from '@/components/puzzle/fraction/FractionNotation';
import { StackedEquation } from '@/components/puzzle/fraction/StackedEquation';
import { countabilityFloor } from '@/components/puzzle/kit/DenseLayout';
import { Caption, ProofCaption } from '@/components/puzzle/kit/Focus';
import { ProofFinale } from '@/components/puzzle/kit/ProofFeedback';
import { ProofCanvas, useProofCanvasPaint, type TrackProofCanvas } from './ProofCanvas';
import { RevealSurface } from '@/components/puzzle/kit/RevealSurface';
import { useRevealBeats } from '@/components/puzzle/kit/useRevealBeats';
import { Ink, ProofMotion, Quantity, Shape } from '@/constants/puzzle-theme';
import { fractionGridDimensions } from '@/utils/fraction-models';
import { fractionRevealBeatCount, type FractionDiagram, type FractionRevealPlan } from '@/utils/fraction-reveal';
import { Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, useReducedMotion, type SharedValue } from 'react-native-reanimated';

const violet = Quantity.violet;

const barHeight = fractionStripHeight;

function CutFace({ width, parts, shaded, position, beat, reduced }: {
  width: number; parts: number; shaded: boolean; position: SharedValue<number>; beat: number; reduced: boolean;
}) {
  const cut = useAnimatedStyle(() => {
    const amount = Math.max(0, Math.min(1, position.get() - beat));
    return reduced ? { height: barHeight, opacity: amount } : { height: barHeight * amount };
  });
  const filled = shaded ? 1 : 0;
  return <View style={styles.cutFace}>
    <FractionStrip gap={fractionStripGap} width={width} height={barHeight} parts={1} shaded={filled} />
    <Animated.View pointerEvents="none" style={[styles.cutOverlay, cut]}>
      <FractionStrip gap={fractionStripGap} width={width} height={barHeight} parts={parts} shaded={shaded ? parts : 0} />
    </Animated.View>
  </View>;
}

function StripComparison({ first, second, equation, onSolutionShown }: {
  first: FractionDiagram; second: FractionDiagram; equation: string; onSolutionShown: () => void;
}) {
  const { t } = useTranslation();
  const { width: screenWidth, fontScale } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const viewport = useProofViewport();
  const modelScroll = useProofModelScroll(viewport?.availableModelHeight);
  const availableWidth = viewport?.innerWidth ?? Math.max(1, screenWidth - 56);
  const width = Math.min(410, layoutWidth || availableWidth, availableWidth);
  const reduceMotion = useReducedMotion();
  const sameAmount = first.numerator * second.denominator === second.numerator * first.denominator;
  const split = second.denominator / first.denominator;
  const subdivide = !second.selected && sameAmount && Number.isInteger(split) && split > 1;
  const regroup = sameAmount && !!second.selected && second.numerator > 0 && second.numerator < second.denominator;
  // A miss keeps the child's cells. They first slide left under the 1/2 part, then the cells past its edge turn amber.
  const goalCount = Math.round(first.numerator / first.denominator * second.denominator);
  const picked = second.selected ? [...second.selected].sort((x, y) => x - y) : [];
  const extra = picked.length - goalCount;
  const missing = !!second.selected && !sameAmount;
  const lineUp = missing && picked.some((cell, index) => cell !== index);
  const miss = missing ? {
    over: extra > 0 ? picked.map((_, index) => index).slice(goalCount) : undefined,
    under: extra < 0 ? Array.from({ length: -extra }, (_, index) => picked.length + index) : undefined,
  } : undefined;
  const count = regroup ? 3 : subdivide && !reduceMotion ? first.denominator : 1;
  const beats = useRevealBeats(layoutWidth ? count : null, {
    lead: ProofMotion.beat[160], minTotal: 0, reducedSteps: true,
    step: () => subdivide ? ProofMotion.beat[120] : regroup ? ProofMotion.group : lineUp ? ProofMotion.beat[360] : ProofMotion.beat[160],
    hold: landed => landed === count ? ProofMotion.settle : regroup && landed === 2 ? ProofMotion.press : 0,
    onDone: onSolutionShown,
  });
  const { landed, position, settled, reduced } = beats;
  const shown = subdivide && landed < count ? first : second;
  const cue = subdivide ? t('fractionModels.cutParts', { count: second.denominator })
    : regroup ? landed < 2 ? t('fractionModels.lineUpParts')
      : t('fractionModels.cutParts', { count: second.denominator }) : lineUp && landed < count ? t('fractionModels.lineUpParts') : null;
  const gap = fractionStripGap;
  const faceWidth = width / first.denominator;
  return <RevealSurface beats={beats} style={styles.surface}>
    <View style={[styles.wrap, second.selected ? styles.stripBoard : undefined]} onLayout={event => setLayoutWidth(event.nativeEvent.layout.width)}>
      <View {...modelScroll} nativeID="play-proof-model" testID="play-proof-model" accessible accessibilityRole="image" accessibilityLabel={t('fractionModels.shaded', { count: shown.numerator, total: shown.denominator })}
        style={{ width, gap: gap }}>
        {second.selected ? <FractionStrip gap={fractionStripGap} width={width} height={barHeight} tone="teal"
          parts={first.denominator} shaded={first.numerator} /> : null}
        {subdivide ? <View style={styles.units}>
          {Array.from({ length: first.denominator }, (_, index) => <View key={index} style={index > 0 ? { marginLeft: gap } : undefined}>
            <CutFace width={faceWidth - gap + gap / first.denominator} parts={split} shaded={index < first.numerator}
              position={position} beat={reduced ? 0 : index} reduced={!!reduced} />
          </View>)}
        </View> : regroup ? <RegroupedStrip part={second} width={width} position={position} landed={landed} reduced={reduced} />
          : <FractionStrip gap={fractionStripGap} width={width} height={barHeight} parts={second.denominator} shaded={second.numerator}
            selected={lineUp && landed >= count ? picked.map((_, index) => index) : second.selected}
            alignment={lineUp && landed < count ? { position, snapped: reduced ? false : undefined } : undefined}
            over={lineUp && landed < count ? undefined : miss?.over} under={lineUp && landed < count ? undefined : miss?.under} />}
      </View>
      {settled || cue ? <PlayProofCaption>
        <View nativeID={settled ? "play-proof-equation" : undefined} testID={settled ? "play-proof-equation" : undefined}
          style={[styles.equationSlot, settled && styles.finaleRoom, subdivide && { minHeight: Math.max(34, (viewport ? 36 : 60) * fontScale) }]}>
          {settled ? <ProofFinale settled={settled}>
            <View testID="fraction-solution-equation">{subdivide ? <StackedEquation value={equation} />
              : <Text style={styles.numericEquation}>{equation}</Text>}</View>
          </ProofFinale> : <Caption strong>{cue}</Caption>}
        </View>
      </PlayProofCaption> : null}
    </View>
  </RevealSurface>;
}

function RegroupedStrip({ part, width, position, landed, reduced }: {
  part: FractionDiagram; width: number; position: SharedValue<number>; landed: number; reduced: boolean;
}) {
  const joined = useAnimatedStyle(() => {
    const step = reduced ? landed : position.get();
    return { opacity: Math.max(0, Math.min(step - 1, 3 - step, 1)) };
  });
  const span = width * part.numerator / part.denominator;
  return <View>
    <FractionStrip gap={fractionStripGap} width={width} height={barHeight} parts={part.denominator} shaded={part.numerator}
      selected={landed === 0 ? part.selected : undefined}
      alignment={landed === 0 ? { position, snapped: reduced ? false : undefined } : undefined} />
    <Animated.View pointerEvents="none" style={[styles.joined, joined, { width: span }]}>
      <FractionStrip height={barHeight} parts={1} shaded={1} />
    </Animated.View>
  </View>;
}

function FractionModel({ part, width, landed, count, start, position, readingInEquation, settled, reduced, trackCanvas, canvasIndex }: {
  part: FractionDiagram; width: number; landed: number; count: number; position: SharedValue<number>;
  start: number; readingInEquation: boolean; settled: boolean; reduced: boolean; trackCanvas: TrackProofCanvas; canvasIndex: number;
}) {
  const { numerator, denominator, shape, selected } = part;
  const strip = shape === 'strip';
  const localLanded = Math.max(0, Math.min(count, landed - start));
  const shown = Math.floor(localLanded * numerator / count);
  const filled = selected ? numerator : shown;
  const prior = Math.floor(Math.max(0, localLanded - 1) * numerator / count);
  const traced = !settled && shown > prior
    ? Array.from({ length: shown - prior }, (_, i) => selected?.[prior + i] ?? prior + i) : undefined;
  const next = Math.floor(Math.min(count, localLanded + 1) * numerator / count);
  const pie = useMemo(() => shape === 'pie' ? createPieGeometry(width, denominator) : undefined, [denominator, shape, width]);
  const paths = useMemo(() => {
    if (shape !== 'pie') return null;
    const area = (pieces: readonly number[]) => {
      const path = Skia.Path.Make();
      for (const index of pieces) {
        path.addPath(createWedgePath(width / 2, width / 2, pieFaceRadius(width), -90 + index * 360 / denominator, 360 / denominator));
      }
      return path;
    };
    return { fill: area(selected ?? Array.from({ length: filled }, (_, i) => i)),
      preview: area(Array.from({ length: next - shown }, (_, i) => shown + i)), trace: area(traced ?? []) };
  }, [denominator, filled, next, selected, shape, shown, traced, width]);
  const opacity = useDerivedValue(() => Math.max(0, Math.min(1, position.get() - start - localLanded)) * .55);
  const model = strip ? <FractionStrip width={width} parts={denominator} shaded={filled} selected={selected}
    height={barHeight} highlighted={traced} /> : pie && paths ? <ProofCanvas trackCanvas={trackCanvas} canvasIndex={canvasIndex}
    style={{ width, height: width }} accessible={false} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <PiePieces geometry={pie} filled={paths.fill}>
      {!reduced && !selected ? <Path path={paths.preview} color={violet.fill} opacity={opacity} /> : null}
      {selected && traced ? <Path path={paths.trace} color={violet.onFill} opacity={.38} /> : null}
    </PiePieces>
  </ProofCanvas> : <FractionGridChart denominator={denominator} shaded={filled} size={width} selected={selected}
    highlighted={selected ? traced : undefined} preview={!reduced && !selected ? { start: shown, end: next, opacity } : undefined} />;
  return <View style={styles.part}>
    {model}
    {!readingInEquation ? <View nativeID="play-proof-equation" testID="play-proof-equation">
      <View testID="fraction-solution-count" accessibilityLabel={`${filled}/${denominator}`} accessible>
        <FractionNotation numerator={filled} denominator={denominator} />
      </View>
    </View> : null}
    {settled && part.equivalents?.length ? <StackedEquation value={part.equivalents.join(' = ')} /> : null}
  </View>;
}

export function FractionReveal({ plan, onSolutionShown }: { plan: FractionRevealPlan; onSolutionShown: () => void }) {
  const [first, second] = plan.diagrams;
  if (plan.mechanic === 'wedges' || plan.mechanic === 'halves') return <PieSelectionProof diagrams={plan.diagrams}
    halves={plan.mechanic === 'halves' ? plan.submitted ?? 2 : undefined} onSolutionShown={onSolutionShown} />;
  if (plan.mechanic === 'equivalent') return <EquivalentProof given={first} target={second} submitted={plan.submitted}
    submittedFraction={plan.submittedFraction} onSolutionShown={onSolutionShown} />;
  if (plan.diagrams.length === 1 && first.shape === 'pie' && first.numerator === 2 && first.denominator === 2 && !first.selected) {
    return <WholeHalvesReveal onSolutionShown={onSolutionShown} />;
  }
  if (plan.diagrams.length === 1 && first.shape === 'set' && first.groupSize && plan.equation) {
    return <GroupTapeReveal part={first} groupSize={first.groupSize} equation={plan.equation} onSolutionShown={onSolutionShown} />;
  }
  if (plan.diagrams.length === 1 && first.shape === 'strip' && first.selected) {
    return <CountStripReveal part={first} onSolutionShown={onSolutionShown} />;
  }
  if (plan.diagrams.length === 2 && first.shape === 'strip' && second.shape === 'strip' && plan.equation) {
    return <StripComparison first={first} second={second} equation={plan.equation} onSolutionShown={onSolutionShown} />;
  }
  return <FractionParts plan={plan} onSolutionShown={onSolutionShown} />;
}

function GroupTapeReveal({ part, groupSize, equation, onSolutionShown }: {
  part: FractionDiagram; groupSize: number; equation: string; onSolutionShown: () => void;
}) {
  const { t } = useTranslation();
  const viewport = useProofViewport();
  const modelScroll = useProofModelScroll(viewport?.availableModelHeight);
  const { denominator, numerator } = part;
  const total = denominator * groupSize;
  const split = `${total} ÷ ${denominator} = ${groupSize}`;
  const count = 6;
  const beats = useRevealBeats(count, {
    lead: ProofMotion.beat[140], minTotal: 0, reducedSteps: true,
    step: index => index < 4 ? ProofMotion.beat[180] : ProofMotion.group,
    hold: landed => landed === 5 ? ProofMotion.inspection : landed === count ? ProofMotion.settle : 0,
    onDone: onSolutionShown,
  });
  const { landed, position, settled } = beats;
  const distributed = Math.min(denominator, Math.ceil(Math.min(4, landed) * denominator / 4));
  const highlighted = !settled && landed === 5 ? [0] : !settled && landed === 6
    ? Array.from({ length: numerator }, (_, index) => index) : undefined;
  return <RevealSurface beats={beats} style={styles.surface}>
    <View style={[styles.wrap, styles.stripBoard]}>
      <View {...modelScroll} nativeID="play-proof-model" testID="play-proof-model" style={styles.tape}
        accessible accessibilityRole="image" accessibilityLabel={settled ? equation : landed < 4
          ? `${total} · ${t('fractionModels.shaded', { count: numerator, total: denominator })}`
          : `${split} · ${t('fractionModels.groupedParts', { groups: numerator, size: groupSize })}`}>
        <FractionGroupTape total={total} parts={denominator} shaded={numerator}
          groupSize={groupSize} distributed={distributed} highlighted={highlighted} position={position}
          caption={landed >= 4 ? <View nativeID={settled ? 'play-proof-equation' : undefined} testID={settled ? 'play-proof-equation' : undefined}>
            <ProofFinale settled={settled}><ProofCaption text={landed < count ? split : equation} /></ProofFinale>
          </View> : undefined} />
      </View>
    </View>
  </RevealSurface>;
}

function CountStripReveal({ part, onSolutionShown }: { part: FractionDiagram; onSolutionShown: () => void }) {
  const { t } = useTranslation();
  const viewport = useProofViewport();
  const modelScroll = useProofModelScroll(viewport?.availableModelHeight);
  const { denominator, numerator, selected } = part;
  const all = Array.from({ length: denominator }, (_, index) => index);
  const beats = useRevealBeats(2, {
    lead: ProofMotion.beat[140], minTotal: 0, reducedSteps: true,
    step: () => ProofMotion.group, hold: () => ProofMotion.inspection, onDone: onSolutionShown,
  });
  const { landed, settled } = beats;
  return <RevealSurface beats={beats} style={styles.surface}>
    <View style={[styles.wrap, styles.stripBoard]}>
      <View {...modelScroll} nativeID="play-proof-model" testID="play-proof-model" style={styles.tape}
        accessible accessibilityRole="image" accessibilityLabel={t('fractionModels.shaded', { count: numerator, total: denominator })}>
        <FractionStrip gap={fractionStripGap} parts={denominator} shaded={numerator} selected={selected} height={barHeight} pulseKey={landed}
          highlighted={settled || landed === 0 ? undefined : landed === 1 ? all : selected} />
      </View>
      {!settled ? <PlayProofCaption><ProofCaption text={landed < 2
        ? t('fractionModels.parts', { count: denominator })
        : t('fractionModels.countShadedParts', { defaultValue: 'Count the shaded parts' })} /></PlayProofCaption> : null}
    </View>
  </RevealSurface>;
}

function WholeHalvesReveal({ onSolutionShown }: { onSolutionShown: () => void }) {
  const { t } = useTranslation();
  const viewport = useProofViewport();
  const { fontScale } = useWindowDimensions();
  const size = Math.max(72, Math.min(fontScale >= 2 ? 120 : 148, (viewport?.availableModelHeight ?? 177) - 29));
  const beats = useRevealBeats(3, {
    lead: ProofMotion.beat[140], minTotal: 0, reducedSteps: true,
    step: () => ProofMotion.group, hold: landed => landed === 3 ? ProofMotion.inspection : ProofMotion.press,
    onDone: onSolutionShown,
  });
  const { landed, position, settled, reduced } = beats;
  return <RevealSurface beats={beats} style={styles.surface}>
    <View style={styles.wrap}>
      <View nativeID="play-proof-model" testID="play-proof-model" accessibilityRole="image" accessible
        accessibilityLabel={t('fractionModels.shaded', { count: 2, total: 2 })}>
        <FractionWholeFace size={size} position={position} landed={landed} reduced={reduced} settled={settled} />
      </View>
      <PlayProofCaption>
        <View nativeID={settled ? 'play-proof-equation' : undefined} testID={settled ? 'play-proof-equation' : undefined}>
          <ProofCaption text={settled ? '2/2 = 1' : t('fractionModels.parts', { count: 2 })} />
        </View>
      </PlayProofCaption>
    </View>
  </RevealSurface>;
}

function FractionParts({ plan, onSolutionShown }: { plan: FractionRevealPlan; onSolutionShown: () => void }) {
  const { t } = useTranslation();
  const { width: screenWidth, fontScale } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const viewport = useProofViewport();
  const modelScroll = useProofModelScroll(viewport?.availableModelHeight);
  const width = layoutWidth || viewport?.innerWidth || Math.max(100, screenWidth - 56);
  const { diagrams, equation, matchCards, matchedIds } = plan;
  const canvasIndices = diagrams.flatMap((part, index) => part.shape === 'pie' ? [index] : []);
  const [first] = diagrams;
  const paired = diagrams.length > 1;
  const compact = paired && diagrams.every(part => part.shape === 'pie' || part.shape === 'grid');
  const setup = first.selected ? 0 : 1;
  const counts = diagrams.map(part => Math.max(1, part.selected?.length ?? fractionRevealBeatCount([part], false)));
  const starts = counts.map((_, index) => setup + counts.slice(0, index).reduce((total, count) => total + count, 0));
  const count = counts.reduce((total, count) => total + count, 0);
  const dense = diagrams.some(part => part.shape === 'strip' && part.denominator === 20);
  const beats = useRevealBeats(layoutWidth ? count + setup : null, {
    lead: first.selected ? ProofMotion.beat[160] : ProofMotion.beat[120], minTotal: 0, reducedSteps: true,
    awaitInitialPaint: canvasIndices.length > 0,
    step: index => {
      if (first.selected) return first.shape === 'strip' ? ProofMotion.beat[180] : ProofMotion.travel;
      if (index < setup) return ProofMotion.beat[120];
      if (first.shape === 'pie' && paired) return ProofMotion.countStride;
      return dense || !paired && first.shape === 'pie' && first.numerator === first.denominator
        ? ProofMotion.travel : ProofMotion.beat[160];
    },
    hold: landed => landed === count + setup ? dense ? ProofMotion.denseHold : ProofMotion.settle : 0,
    onDone: onSolutionShown,
  });
  const trackCanvas = useProofCanvasPaint(beats, layoutWidth > 0, canvasIndices);
  const { landed, position, settled, reduced } = beats;
  const stripReading = !paired && first.shape === 'strip' ? `${first.numerator}/${first.denominator}` : undefined;
  const final = equation ?? (!paired && first.numerator === first.denominator ? `${first.numerator}/${first.denominator} = 1` : stripReading);
  const cutCaption = t('fractionModels.cutParts', { count: first.denominator });
  const shadeCaption = first.selected
    ? t('fractionModels.countShadedParts', { defaultValue: 'Count the shaded parts' })
    : t('fractionModels.shadePieces');
  const running = stripReading && landed > 0 && first.selected
      ? t('fractionModels.piecesCounted', { count: Math.min(landed, first.selected.length), total: first.denominator })
      : landed < setup ? cutCaption : shadeCaption;
  const tracedCount = Math.min(landed, first.selected?.length ?? 0);
  const spokenTrace = !paired && tracedCount && !beats.skipped && !settled
    ? t('fractionModels.piecesCounted', { count: tracedCount, total: first.denominator }) : '';
  const { announce } = beats;
  useEffect(() => {
    if (spokenTrace) announce(spokenTrace);
  }, [announce, spokenTrace]);
  const scale = viewport?.fontScale ?? fontScale;
  const modelHeight = (viewport?.availableModelHeight ?? 350) - 20 - (viewport || matchCards ? 0 : 42 * scale);
  const modelWidth = Math.min(410, width);
  const cellFloor = countabilityFloor('cell', scale >= 1.5);
  const faceWidth = (part: FractionDiagram) => {
    if (part.shape === 'grid') {
      const { cols } = fractionGridDimensions(part.denominator);
      return cols * cellFloor + (cols - 1) * Shape.space.seam;
    }
    if (part.shape === 'pie' && part.denominator > 1) return Math.max(72, 19 + cellFloor / Math.sin(Math.PI / part.denominator));
    return 72;
  };
  const cardFloor = Math.max(...diagrams.map(faceWidth), 48 * scale) + 14;
  const matchColumns = width >= 2 * cardFloor + 12 ? 2 : 1;
  const cardSize = Math.max(cardFloor, Math.min(120, (width + 12) / matchColumns - 12, (modelHeight - 12) / 2));
  const diagramWidth = (part: FractionDiagram) => {
    const { cols, rows } = fractionGridDimensions(part.denominator);
    const heightLimit = part.shape === 'grid' ? modelHeight * cols / rows : modelHeight;
    return Math.max(faceWidth(part), Math.min(heightLimit, compact ? 144 : 224, compact ? (width - 16) / 2 : width));
  };
  const renderModel = (part: FractionDiagram, index: number) => <FractionModel part={part}
    readingInEquation={Boolean(final || matchCards)} trackCanvas={trackCanvas} canvasIndex={index}
    position={position} count={counts[index]} start={starts[index]} landed={landed} settled={settled} reduced={reduced}
    width={matchCards ? cardSize - 14 : part.shape === 'pie' || part.shape === 'grid'
      ? diagramWidth(part) : modelWidth} />;
  return <RevealSurface beats={beats} style={styles.surface}>
    <View style={[styles.wrap, stripReading ? styles.stripBoard : undefined]}
      onLayout={event => setLayoutWidth(event.nativeEvent.layout.width)}>
      {matchCards ? <View {...modelScroll} nativeID="play-proof-model" testID="play-proof-model" style={[styles.matchBoard, { width: matchColumns * (cardSize + 12) - 12 }]}>
        {matchCards.map((card, i) => {
          const visual = card.kind === 'visual';
          const index = matchCards.slice(0, i).filter(item => item.kind === 'visual').length;
          const pair = matchedIds ? Math.floor(matchedIds.indexOf(card.id) / 2) + 1
            : diagrams.findIndex(part => part.numerator === card.numerator && part.denominator === card.denominator) + 1;
          return <View key={card.id} style={[styles.matchCard, pair > 0 && styles.matchBound, { width: cardSize, minHeight: cardSize }]}
            accessible accessibilityLabel={visual ? t('fractionModels.shaded', { count: card.numerator, total: card.denominator })
              : `${card.numerator}/${card.denominator}`}>
            {visual ? renderModel(diagrams[index], index) : <FractionNotation numerator={card.numerator} denominator={card.denominator} />}
            {pair > 0 ? <FractionPairBadge pair={pair} /> : null}
          </View>;
        })}
      </View> : <View {...modelScroll} nativeID="play-proof-model" testID="play-proof-model" style={[styles.models, compact && styles.sideBySide]}>
        {diagrams.map((part, index) => <View key={index}>{renderModel(part, index)}</View>)}
      </View>}
      {!matchCards && (settled ? final?.trim() : running.trim()) ? <PlayProofCaption>
        <View nativeID={settled && final ? "play-proof-equation" : undefined} testID={settled && final ? "play-proof-equation" : undefined} style={[styles.proofLane, settled && stripReading ? styles.stripReadingLane : undefined]}>
          {settled ? final ? <ProofFinale settled={settled}>
            <View style={[styles.equationSlot, { minHeight: Math.max(34, (viewport ? 36 : 60) * fontScale) }]} testID="fraction-solution-equation">
              {stripReading ? <ProofCaption text={final} /> : <StackedEquation value={final} />}
            </View>
          </ProofFinale> : null : <ProofCaption text={running}
            reserveTexts={[cutCaption, shadeCaption]} />}
        </View>
      </PlayProofCaption> : null}
    </View>
  </RevealSurface>;
}

const styles = StyleSheet.create({
  surface: { alignSelf: 'stretch' },
  wrap: { alignItems: 'center', alignSelf: 'stretch', paddingVertical: 10, gap: 10 },
  tape: { alignSelf: 'center', width: '100%', maxWidth: 410 },
  stripBoard: { paddingTop: 0 },
  models: { alignItems: 'center', gap: 8 },
  sideBySide: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  matchBoard: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  matchCard: { alignItems: 'center', justifyContent: 'center', padding: 5, borderRadius: 12, backgroundColor: Shape.empty },
  matchBound: { backgroundColor: violet.soft },
  part: { alignItems: 'center', gap: 4 },
  units: { flexDirection: 'row' },
  joined: { position: 'absolute', top: 0, left: 0 },
  cutFace: { overflow: 'hidden' },
  cutOverlay: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', backgroundColor: Shape.seamColor },
  proofLane: { alignSelf: 'stretch', minWidth: 0 },
  stripReadingLane: { paddingHorizontal: 10 },
  numericEquation: { color: Ink.text, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'], textAlign: 'center' },
  equationSlot: { justifyContent: 'center', alignItems: 'center' },
  finaleRoom: { paddingVertical: 4 },
});
