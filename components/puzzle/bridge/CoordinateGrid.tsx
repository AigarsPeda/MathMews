import { Land } from '@/components/puzzle/tiles/TileMotion';
import { GridPoint } from '../GridPoint';
import { useModelStage } from '../kit/ModelStage';
import { PlayProofCaption, useProofViewport } from '../PlayProofCaption';
import { canSnapshotCanvas, canSnapshotModel, useModelPaint } from '../counting/useModelPaint';
import { Caption } from '@/components/puzzle/kit/Focus';
import { RevealSurface } from '@/components/puzzle/kit/RevealSurface';
import { useRevealBeats } from '@/components/puzzle/kit/useRevealBeats';
import { Ink, Motion, ProofMotion, PuzzleColors, Quantity, Shape } from '@/constants/puzzle-theme';
import type { Point } from '@/utils/bridge-models';
import { moderateScale } from '@/utils/scale';
import { Canvas, Group, Path, RoundedRect, Skia, useCanvasRef } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text as NativeText, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, useAnimatedStyle, useDerivedValue, ZoomIn } from 'react-native-reanimated';

const DOT = 28;
const RING = 28;
const DEST = 28;
const GIVEN = 28;
const AXIS_GUTTER = 32;
const TOP_GUTTER = 24;
const BOTTOM_GUTTER = 26;

export const formatPoint = (p: Point) => `(${p.x}, ${p.y})`;

/** The worked solution drawn after Check: a walk across then up/down, or a measured span counted unit by unit. */
export type CoordinateRoute = { from: Point; to: Point; kind: 'walk' | 'measure'; fromOrigin?: boolean; relativeResponse?: boolean };

const clamp01 = (v: number) => { 'worklet'; return Math.min(1, Math.max(0, v)); };

export function CoordinateGrid({ moveChip, min, max, side: preferredSide, points, learner, route, submitted, onTap, disabled, testID, onSettled }: {
  moveChip?: boolean; puzzleId: string; min: number; max: number; side: number;
  points: { at: Point; label: string }[];
  learner?: Point | null; submitted?: Point | number;
  /** The worked route, drawn once the task is answered. */
  route?: CoordinateRoute | null;
  onTap?: (p: Point) => void; disabled?: boolean; testID?: string;
  /** Told when the worked route has finished (and again, false, when it replays). */
  onSettled?: (settled: boolean) => void; playback?: boolean;
}) {
  const span = max - min;
  const viewport = useProofViewport();
  const compact = (viewport?.fontScale ?? 1) >= 1.5;
  const stage = useModelStage();
  const columns = span + 1;
  const availableWidth = (stage.width || viewport?.innerWidth || preferredSide) - (moveChip ? 24 : 0);
  const cell = Math.max(1, (availableWidth - 2 * AXIS_GUTTER) / columns);
  const side = span * cell;
  const left = AXIS_GUTTER + cell / 2;
  const top = TOP_GUTTER + cell / 2;
  const px = (p: Point) => ({ x: left + (p.x - min) * cell, y: top + (max - p.y) * cell });
  const measure = route?.kind === 'measure' && (route.from.x === route.to.x || route.from.y === route.to.y);
  const corner = route ? { x: route.to.x, y: route.from.y } : null;
  const units = route ? Math.abs(route.to.x - route.from.x) + Math.abs(route.to.y - route.from.y) : 0;
  // A walk has three held beats: across, then up or down (either can be a "stay"), then the landing.
  const legUnits = route && corner ? [Math.abs(corner.x - route.from.x), Math.abs(route.to.y - corner.y)] : [];
  // Alternate plot questions move one step from A. Only axes named by that
  // displacement take a beat; the last beat labels the point reached.
  const horizontalBeats = route?.relativeResponse && legUnits[0] === 0 ? 0 : 1;
  const verticalBeats = route?.relativeResponse && legUnits[1] === 0 ? 0 : 1;
  const travelBeats = horizontalBeats + verticalBeats;
  const submittedPoint = typeof submitted === 'object' ? submitted : null;
  const stop = measure && typeof submitted === 'number' && route ? {
    x: Math.max(min, Math.min(max, route.from.x + Math.sign(route.to.x - route.from.x) * submitted)),
    y: Math.max(min, Math.min(max, route.from.y + Math.sign(route.to.y - route.from.y) * submitted)),
  } : null;
  const shownUnits = stop && route ? Math.abs(stop.x - route.from.x) + Math.abs(stop.y - route.from.y) : units;
  const wrongLanding = submittedPoint && route && (submittedPoint.x !== route.to.x || submittedPoint.y !== route.to.y) ? submittedPoint : null;
  const missDiameter = DOT;
  const landingBeat = wrongLanding ? 2 : travelBeats;
  const count = !route ? 0 : measure ? Math.max(1, shownUnits) : landingBeat + 1;
  // Consensus tempo: a measured span traces one grid interval per 180 ms (a long span traces continuously);
  // a walk spends 240 ms on each nonzero leg (120 ms for a "stay") and lands its labelled point in 120 ms.
  const beats = useRevealBeats(count, {
    awaitInitialPaint: !!route && canSnapshotCanvas,
    step: beat => measure ? ProofMotion.beat[180] : beat >= travelBeats ? ProofMotion.beat[120] : (legUnits[horizontalBeats ? beat : 1] ?? 0) > 0 ? ProofMotion.beat[240] : ProofMotion.beat[120],
    hold: landed => measure && units > 6 && landed < count ? 0 : ProofMotion.repeatHold,
    // The start is pinned for 120 ms before the first move.
    lead: ProofMotion.beat[120], minTotal: 0, reducedSteps: true,
  });
  const legs = useMemo(() => {
    if (!route || !corner) return [];
    const stops = measure ? [route.from, route.to] : [route.from, corner, route.to];
    return stops.slice(1).map((to, i) => {
      const a = px(stops[i]), b = px(to);
      const line = Skia.Path.Make(); line.moveTo(a.x, a.y); line.lineTo(b.x, b.y);
      const len = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / (len || 1), uy = (b.y - a.y) / (len || 1), h = moderateScale(9);
      const head = Skia.Path.Make();
      head.moveTo(b.x, b.y);
      head.lineTo(b.x - ux * h - uy * h * .6, b.y - uy * h + ux * h * .6);
      head.lineTo(b.x - ux * h + uy * h * .6, b.y - uy * h - ux * h * .6);
      head.close();
      return { line, head, empty: len === 0 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.from.x, route?.from.y, route?.to.x, route?.to.y, measure, min, max, cell, top]);
  const width = 2 * AXIS_GUTTER + columns * cell, height = TOP_GUTTER + columns * cell + BOTTOM_GUTTER;
  const walking = !!route && !measure;
  const arrived = walking && beats.landed >= landingBeat;
  const landedPoint = walking && beats.landed >= count;
  const from = route ? px(route.from) : { x: 0, y: 0 }, mid = corner ? px(corner) : from, dest = route ? px(route.to) : from;
  const attemptedEnd = stop ? px(stop) : wrongLanding ? px(wrongLanding) : dest;
  const walker = useAnimatedStyle(() => {
    const pos = beats.position.value, a = clamp01(pos), b = clamp01(pos - horizontalBeats);
    if (measure) {
      const ratio = clamp01(pos / Math.max(1, shownUnits));
      return { transform: [{ translateX: from.x + (attemptedEnd.x - from.x) * ratio - DOT / 2 }, { translateY: from.y + (attemptedEnd.y - from.y) * ratio - DOT / 2 }] };
    }
    if (wrongLanding && !moveChip) {
      const correction = clamp01(pos - 1);
      return { transform: [
        { translateX: from.x + (attemptedEnd.x - from.x) * a + (dest.x - attemptedEnd.x) * correction - DOT / 2 },
        { translateY: from.y + (attemptedEnd.y - from.y) * a + (dest.y - attemptedEnd.y) * correction - DOT / 2 },
      ] };
    }
    // Across on beat 1 (the corner shares the start's y), then up or down on beat 2.
    return { transform: [{ translateX: from.x + (mid.x - from.x) * a - DOT / 2 }, { translateY: mid.y + (dest.y - mid.y) * b - DOT / 2 }] };
  }, [from.x, from.y, mid.x, mid.y, dest.x, dest.y, horizontalBeats, measure, shownUnits, wrongLanding, moveChip, attemptedEnd.x, attemptedEnd.y]);
  const learnerShown = !submittedPoint && learner && !(route && !measure && learner.x === route.to.x && learner.y === route.to.y) ? learner : null;
  const canvas = useCanvasRef();
  const [laidOutHeight, setLaidOutHeight] = useState(0);
  const planeReady = !!route && laidOutHeight > 0 && Math.abs(laidOutHeight - height) < 1;
  const modelRef = useModelPaint(planeReady, beats, canSnapshotModel ? undefined : canvas);
  const finished = !!route && beats.settled;
  useEffect(() => { onSettled?.(finished); }, [finished, onSettled]);
  const axis = route?.from.x === route?.to.x ? 'y' : 'x';
  const equation = route && (measure ? `${Math.max(route.from[axis], route.to[axis])} − ${Math.min(route.from[axis], route.to[axis])} = ${units}`
    : `${formatPoint(route.from)} → ${formatPoint(route.to)}`);

  // A miss traces one difference. Its single Skip or Replay control leaves the
  // same space for the grid as the editor, without a multi-step control row.
  const controls = submitted === undefined ? beats : { ...beats, pause: undefined, resume: undefined, nextStep: undefined };
  return <RevealSurface beats={controls} replayable={count > 0}><View style={styles.stack}>
    <View testID={testID ? `${testID}-frame` : undefined} style={{ width, height }}>
    <View ref={modelRef} collapsable={false} style={{ width, height, alignSelf: 'center' }} nativeID={route ? "play-proof-model" : "play-entry-model"} testID={route ? "play-proof-model" : "play-entry-model"}
      onLayout={({ nativeEvent: { layout } }) => setLaidOutHeight(layout.height)}>
      {Array.from({ length: columns * columns }, (_, i) => {
        const size = cell - Shape.space.seam;
        return <View key={i} pointerEvents="none" style={{ position: 'absolute',
          left: AXIS_GUTTER + (i % columns) * cell + Shape.space.seam / 2,
          top: TOP_GUTTER + Math.floor(i / columns) * cell + Shape.space.seam / 2,
          width: size, height: size, borderRadius: Math.min(10, size / 4), backgroundColor: Shape.empty }} />;
      })}
      <Canvas ref={canvas} style={StyleSheet.absoluteFill} pointerEvents="none">
        {!measure && !wrongLanding && !finished && legs.map((leg, i) => leg.empty ? null : <Leg key={i} index={i === 0 ? 0 : horizontalBeats} line={leg.line} head={leg.head} beats={beats} span={measure ? count : 1} arrow={!measure} />)}
        {measure && Array.from({ length: Math.min(shownUnits, beats.landed) }, (_, i) => {
          const horizontal = from.y === dest.y;
          const x = Math.min(from.x + (attemptedEnd.x - from.x) * i / shownUnits, from.x + (attemptedEnd.x - from.x) * (i + 1) / shownUnits);
          const y = Math.min(from.y + (attemptedEnd.y - from.y) * i / shownUnits, from.y + (attemptedEnd.y - from.y) * (i + 1) / shownUnits);
          return <RoundedRect key={i} x={horizontal ? x + 2 : x - 5} y={horizontal ? y - 5 : y + 2}
            width={horizontal ? cell - 4 : 10} height={horizontal ? 10 : cell - 4} r={4} color={Quantity.violet.fill} />;
        })}
      </Canvas>
      {Array.from({ length: span + 1 }, (_, i) => {
        const n = min + i;
        return <View key={n} pointerEvents="none" style={StyleSheet.absoluteFill}>
          <NativeText numberOfLines={1} allowFontScaling={false} style={[styles.tick, { left: AXIS_GUTTER + i * cell, width: cell, height: BOTTOM_GUTTER, top: top + side + cell / 2 }]}>{n}</NativeText>
          <NativeText numberOfLines={1} allowFontScaling={false} style={[styles.tick, styles.yTick, { left: 0, top: top + (max - n) * cell - (compact ? 15 : 12) }]}>{n}</NativeText>
        </View>;
      })}
      <NativeText maxFontSizeMultiplier={1.2} pointerEvents="none" style={[styles.axisName, { left: width - AXIS_GUTTER + 3, top: height - BOTTOM_GUTTER }]}>x</NativeText>
      <NativeText maxFontSizeMultiplier={1.2} pointerEvents="none" style={[styles.axisName, { left: 8, top: 0 }]}>y</NativeText>
      {onTap ? <Pressable testID={testID} accessible={false} disabled={disabled}
        style={{ position: 'absolute', left: left - cell / 2, top: top - cell / 2, width: side + cell, height: side + cell }}
        onPress={e => {
          const x = Math.round((e.nativeEvent.locationX - cell / 2) / cell) + min;
          const y = max - Math.round((e.nativeEvent.locationY - cell / 2) / cell);
          onTap({ x: Math.min(max, Math.max(min, x)), y: Math.min(max, Math.max(min, y)) });
        }} /> : null}
      {submittedPoint && <GridPoint diameter={missDiameter} hue={Quantity.amber}
        style={{ position: 'absolute', left: px(submittedPoint).x - missDiameter / 2, top: px(submittedPoint).y - missDiameter / 2 }} />}
      {points.map(({ at, label }) => {
        const isSubmitted = at.x === submittedPoint?.x && at.y === submittedPoint.y;
        const p = px(at);
        return <GridPoint key={label} label={label} hue={isSubmitted ? Quantity.amber : label === 'B' ? Quantity.violet : Quantity.teal}
          style={{ position: 'absolute', left: p.x - GIVEN / 2, top: p.y - GIVEN / 2 }} />;
      })}
      {walking && !moveChip && !wrongLanding && !finished && route && corner ? legUnits.map((n, i) => {
        const legBeat = (i === 0 ? 0 : horizontalBeats) + 1;
        if (!n || beats.landed < legBeat || (compact && beats.landed !== legBeat)) return null;
        const a = px(i === 0 ? route.from : corner), b = px(i === 0 ? corner : route.to);
        const delta = i === 0 ? corner.x - route.from.x : route.to.y - corner.y;
        const style = i === 0 ? { left: (a.x + b.x) / 2 - moderateScale(18), top: a.y + (route.from.y > min ? moderateScale(6) : -moderateScale(30)) }
          : { left: a.x + (corner.x < max ? moderateScale(8) : -moderateScale(46)), top: (a.y + b.y) / 2 - moderateScale(11) };
        return <View key={`l${i}-${beats.runId}`} pointerEvents="none" style={[styles.legLabelBox, style]}><Land><NativeText maxFontSizeMultiplier={1.4} style={styles.legLabel}>{delta >= 0 ? '+' : '−'}{Math.abs(delta)}</NativeText></Land></View>;
      }) : null}
      {learnerShown ? <Animated.View key={`${learnerShown.x},${learnerShown.y}`} entering={ZoomIn.duration(Motion.tap * 2).reduceMotion(ReduceMotion.System)} pointerEvents="none"
        style={[styles.ring, route && styles.ringGuess, { left: px(learnerShown).x - RING / 2, top: px(learnerShown).y - RING / 2 }]}>
        <GridPoint hue={Quantity.violet}><View style={styles.ringDot} /></GridPoint>
      </Animated.View> : null}
      {((measure && beats.landed > 0 && (stop || !finished)) || (walking && !arrived && !(wrongLanding && moveChip))) ? <Animated.View pointerEvents="none" style={[styles.walker, walker]}>
        <GridPoint hue={stop ? Quantity.amber : Quantity.teal} />
      </Animated.View> : null}
      {wrongLanding && moveChip ? <GridPoint diameter={missDiameter} hue={Quantity.teal} style={{ position: 'absolute', left: dest.x - missDiameter / 2, top: dest.y - missDiameter / 2 }} /> : arrived && route ? <View key={`d-${beats.runId}`} pointerEvents="none" style={[styles.destination, { left: dest.x - DEST / 2, top: dest.y - DEST / 2 }]}>
        {landedPoint ? <Animated.View entering={FadeIn.duration(Motion.fade).reduceMotion(ReduceMotion.System)} style={styles.destinationDot}><GridPoint><View style={styles.destinationCore} /></GridPoint></Animated.View> : <GridPoint />}
      </View> : null}
    </View>
    </View>
    {submitted === undefined && equation && <PlayProofCaption><View testID={finished ? "play-proof-equation" : undefined} nativeID={finished ? "play-proof-equation" : undefined} style={styles.readout}>{finished && <Caption strong>{equation}</Caption>}</View></PlayProofCaption>}
  </View></RevealSurface>;
}

function Leg({ line, head, index, beats, span, arrow }: { line: ReturnType<typeof Skia.Path.Make>; head: ReturnType<typeof Skia.Path.Make>; index: number;
  beats: ReturnType<typeof useRevealBeats>; span: number; arrow: boolean }) {
  const { position } = beats;
  // A walk leg owns one beat; a measured span is one leg drawn over all of its unit beats.
  const end = useDerivedValue(() => clamp01((position.value - index) / span), [index, span]);
  const headOpacity = useDerivedValue(() => arrow && clamp01((position.value - index) / span) > .92 ? 1 : 0, [index, span, arrow]);
  return <Group>
    {/* friendly-ok: the learner follows this path from one coordinate to the next. */}
    <Path path={line} style="stroke" strokeWidth={10} strokeCap="round" color={Quantity.teal.edge} start={0} end={end} />
    <Path path={head} color={Quantity.teal.edge} opacity={headOpacity} />
  </Group>;
}

const styles = StyleSheet.create({
  stack: { gap: moderateScale(6), alignItems: 'center' },
  readout: { minHeight: moderateScale(26), alignItems: 'center' },
  walker: { position: 'absolute', left: 0, top: 0, width: DOT, height: DOT },
  destination: { position: 'absolute', width: DEST, height: DEST, alignItems: 'center', justifyContent: 'center' },
  destinationDot: { width: DEST, height: DEST, borderRadius: DEST / 2, alignItems: 'center', justifyContent: 'center' },
  destinationCore: { width: moderateScale(5), height: moderateScale(5), borderRadius: moderateScale(2.5), backgroundColor: Quantity.teal.edge },
  ringGuess: { opacity: Motion.dimOpacity },
  legLabelBox: { position: 'absolute' },
  legLabel: { minWidth: moderateScale(36), fontSize: 18, lineHeight: moderateScale(20), fontWeight: '800', color: Quantity.teal.edge, textAlign: 'center',
    backgroundColor: PuzzleColors.background, borderRadius: 4, overflow: 'hidden', paddingHorizontal: 3, fontVariant: ['tabular-nums'] },
  tick: { position: 'absolute', textAlign: 'center', fontSize: 20, lineHeight: 24, fontWeight: '800', color: Ink.text, fontVariant: ['tabular-nums'] },
  yTick: { width: AXIS_GUTTER - 3 },
  axisName: { position: 'absolute', fontSize: 20, lineHeight: 24, fontWeight: '800', color: Ink.text },
  ring: { position: 'absolute', width: RING, height: RING, borderRadius: RING / 2, alignItems: 'center', justifyContent: 'center' },
  ringDot: { width: moderateScale(6), height: moderateScale(6), borderRadius: moderateScale(3), backgroundColor: PuzzleColors.primary },
});
