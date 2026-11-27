import { FindAllPairsTask } from './FindAllPairsTask';
import { RouteGridSurface, ROUTE_CELL, ROUTE_GAP } from './RouteGridSurface';
import { placeLineLabels } from './number-line/LineMarks';
import { EquationTile, OperationEquation, PairEquation } from './OperationEquation';
import { HINT_LANE, orderLayout } from '@/components/puzzle/OrderNumbersTask';
import { HOP_LANE, PATTERN_GAP as PATTERN_GAP_SHARED, patternDigitSize, patternTileSize } from '@/components/puzzle/PatternNextTask';
import { useKeepModelOrigin, useModelStage } from './kit/ModelStage';
import { estimateScale, LandmarkLine } from './number-line/LandmarkLine';
import { useProofCanvasPaint } from './ProofCanvas';
/**
 * Checked explanations for the operations family: balance, equation board,
 * estimate, pairs, fix-the-mistake, function machine, operation path, order,
 * pair sum, patterns, route grid, target build and true/false.
 *
 * Every proof is one RevealSurface on one clock (useRevealBeats). A step
 * commits the drawing, the caption and the accessible text together; landed
 * pieces stay fully opaque, and the caption lane is mounted from the first
 * frame. Plans (utils/operations-reveal) decide the steps; this file only
 * draws them. `mode="attempt"` plays the child's submitted work up to its
 * first mismatch; `mode="worked"` plays a valid solution.
 */
import { PlayProofCaption, useProofViewport } from './PlayProofCaption';
import { canSnapshotModel, useModelPaint } from './counting/useModelPaint';
import { BalanceGroups, BalanceWeight } from './BalanceModel';
import { balanceTilt, BalanceScale } from '@/components/puzzle/BalanceScale';
import { EquationBoardModel } from '@/components/puzzle/EquationBoardModel';
import { DiagramIcon } from '@/components/puzzle/kit/DiagramIcon';
import { MachineLane } from './MachineLane';
import { UnknownWell } from './kit/PuzzleKit';
import { ProofCaption } from '@/components/puzzle/kit/Focus';
import { ProofLanding } from '@/components/puzzle/kit/ProofFeedback';
import { RevealSurface } from '@/components/puzzle/kit/RevealSurface';
import { useRevealBeats, type RevealBeats } from '@/components/puzzle/kit/useRevealBeats';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { Land } from '@/components/puzzle/tiles/TileMotion';
import { Ink, ProofMotion, PuzzleColors, Quantity, Shape } from '@/constants/puzzle-theme';
import {
  balancePlan, buildPlan, claimPlan, equationLabel, equationPlan, estimatePlan, findPairsPlan, fixPlan, machinePlan, minus,
  orderPlan, pairPlan, pathPlan, patternPlan, PROOF_HOLD, proofAnswer, proofChoice, repairPlan, routePlan, sign, stepLabel,
  type OperationsPuzzle, type ProofMode, type ProofStep,
} from '@/utils/operations-reveal';
import type { PuzzleAnswer } from '@/utils/puzzle-type';
import { moderateScale } from '@/utils/scale';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

export { hasOperationsReveal, operationsWorkedAnswer, OPERATIONS_REVEAL_TYPES } from '@/utils/operations-reveal';

const teal = Quantity.teal;
const amber = Quantity.amber;
/** Neutral face and lower lip for empty units. */
const EMPTY = Shape.empty;

const SEAM = Shape.space.seam;

type Props = {
  puzzle: OperationsPuzzle;
  /** The checked answer. Without one (QA fixtures) a valid worked answer is used. */
  answer?: PuzzleAnswer | null;
  /** The submitted answer passed Play's checker (decides whether a worked proof may reuse it). */
  isCorrect?: boolean;
  /** `attempt`: only the submitted work, up to its first mismatch. `worked`: a valid solution. */
  mode?: ProofMode;
  onSolutionShown?: () => void;
};

/* ------------------------------------------------------------------ */
/* Shared clock, caption lane and atoms                                 */
/* ------------------------------------------------------------------ */

function useProof(steps: readonly ProofStep[], onSolutionShown?: () => void, lead: number = ProofMotion.lead, hasCanvas = false) {
  return useRevealBeats(steps.length, {
    step: b => steps[b]?.ms ?? ProofMotion.beat[120],
    hold: n => steps[n - 1]?.hold ?? PROOF_HOLD,
    awaitInitialPaint: hasCanvas && canSnapshotModel, lead, minTotal: 0, reducedSteps: true, onDone: onSolutionShown,
  });
}

/** The caption of the current committed state; the final equation replaces it on settle. */
function captionOf(beats: RevealBeats, steps: readonly ProofStep[], final: string) {
  if (beats.settled) return final;
  return steps[Math.max(0, beats.landed - 1)]?.caption ?? final;
}

/** One reveal: model, a reserved caption lane, and the shared Pause / Skip / Watch again row. */
function ProofFrame({ beats, steps, final, children, label, finalOnly = false }: {
  beats: RevealBeats; steps: readonly ProofStep[]; final: string; children: ReactNode; label: string; finalOnly?: boolean;
}) {
  const text = finalOnly && !beats.settled ? '' : captionOf(beats, steps, final);
  const [laidOut, setLaidOut] = useState(false);
  const modelRef = useModelPaint(laidOut && !beats.nativePaintPending, beats);
  return <RevealSurface beats={beats} style={styles.frame}>
    <View ref={modelRef} collapsable={false} nativeID="play-proof-model" testID="play-proof-model" accessible accessibilityLabel={label} style={styles.model}
      onLayout={({ nativeEvent: { layout } }) => setLaidOut(layout.width > 0 && layout.height > 0)}>{children}</View>
    {text ? <PlayProofCaption><View testID={beats.settled ? "play-proof-equation" : undefined} nativeID={beats.settled ? "play-proof-equation" : undefined}><ProofCaption text={text} /></View></PlayProofCaption> : null}
  </RevealSurface>;
}

type Tone = 'given' | 'plain' | 'empty' | 'active' | 'right' | 'wrong' | 'soft';
const TONES: Record<Tone, { fill: string; edge: string; text: string }> = {
  given: { fill: teal.fill, edge: teal.edge, text: Ink.text },
  plain: { fill: Quantity.amber.fill, edge: Quantity.amber.edge, text: Ink.text },
  soft: { fill: Ink.tray, edge: Ink.trayEdge, text: Ink.text },
  empty: { fill: Shape.empty, edge: Shape.emptyLip, text: Ink.soft },
  active: { fill: Quantity.violet.fill, edge: Quantity.violet.edge, text: Ink.text },
  right: { fill: PuzzleColors.successSurface, edge: PuzzleColors.success, text: Ink.text },
  wrong: { fill: PuzzleColors.incorrectSurface, edge: PuzzleColors.incorrect, text: Ink.text },
};

/** A passive rounded number tile: a given, a computed value or an empty slot. Never pressable here. */
function FaceText(props: ComponentProps<typeof Text>) {
  // A digit or tick fits its physical piece. Play exposes the full-size equation independently.
  return <Text maxFontSizeMultiplier={1.4} numberOfLines={1} adjustsFontSizeToFit {...props} />;
}

function Num({ value, tone = 'plain', size = 'md', style, fit, flat = false }: { value: ReactNode; tone?: Tone; size?: 'sm' | 'md' | 'lg'; style?: StyleProp<ViewStyle>; fit?: number; flat?: boolean }) {
  const t = TONES[tone];
  const { fontScale } = useWindowDimensions();
  // A fixed-width tile sizes its digits to the tile itself (font auto-fit can collapse inside animated tiles).
  const digits = typeof value === 'string' || typeof value === 'number' ? String(value).length : 1;
  const fitSize = fit ? (fit >= 48 ? patternDigitSize(fit, digits, fontScale) : Math.max(12, Math.min(moderateScale(21), (fit - 10) / (digits * .62) / Math.min(fontScale, 1.4)))) : undefined;
  const box = size === 'sm' ? moderateScale(38) : size === 'lg' ? moderateScale(56) : moderateScale(46);
  return <View style={[styles.num, { minWidth: box, minHeight: box, borderRadius: Shape.tile(box), backgroundColor: t.fill, borderBottomColor: t.edge,
    borderBottomWidth: flat ? 0 : Shape.lip }, style]}>
    {typeof value === 'string' || typeof value === 'number'
      ? <FaceText adjustsFontSizeToFit={false} style={[styles.numText, size === 'sm' && styles.numTextSm, size === 'lg' && styles.numTextLg, fitSize ? { fontSize: fitSize, lineHeight: fitSize * 1.25 } : null, { color: t.text }]}>{value}</FaceText> : value}
  </View>;
}

function Sym({ children }: { children: string }) {
  return <FaceText adjustsFontSizeToFit={false} style={styles.sym}>{children}</FaceText>;
}

/** Measured segments keep the same unit width as the last piece grows. */
type Seg = { units: number; fill: string; edge: string; label?: string; ghost?: boolean };
function Tape({ segments, unit, height = moderateScale(26), grow, origin = 0, style }: {
  segments: readonly Seg[]; unit: number; height?: number; grow?: { index: number; progress: RevealBeats['progress'] } | null; origin?: number; style?: StyleProp<ViewStyle>;
}) {
  const lefts = segments.reduce<number[]>((acc, s) => [...acc, acc[acc.length - 1] + s.units * unit], [origin]);
  return <View style={[{ height }, style]} pointerEvents="none">
    {segments.map((s, i) => {
      const left = lefts[i], width = Math.max(2, s.units * unit - (i < segments.length - 1 ? SEAM : 0));
      return <TapeFace key={i} seg={s} left={left} width={width} height={height} first={i === 0} last={i === segments.length - 1}
        growing={grow?.index === i ? grow.progress : null} />;
    })}
  </View>;
}

function TapeFace({ seg, left, width, height, first, last, growing }: { seg: Seg; left: number; width: number; height: number; first: boolean; last: boolean; growing: RevealBeats['progress'] | null }) {
  const end = Shape.stripEnd(height);
  const motion = useAnimatedStyle(() => ({ width: growing ? width * Math.min(1, Math.max(0, growing.value)) : width }), [growing, width]);
  return <Animated.View style={[styles.face, { left, height, backgroundColor: seg.ghost ? EMPTY : seg.fill, borderBottomColor: seg.ghost ? Shape.emptyLip : seg.edge,
    borderTopLeftRadius: first ? end : 2, borderBottomLeftRadius: first ? end : 2,
    borderTopRightRadius: last ? end : 2, borderBottomRightRadius: last ? end : 2 }, motion]}>
    {seg.label && width >= moderateScale(22) ? <FaceText numberOfLines={1} style={[styles.faceText, { color: seg.ghost ? Ink.soft : Ink.text }]}>{seg.label}</FaceText> : null}
  </Animated.View>;
}

const TEAL_SEG = (units: number, label?: string): Seg => ({ units, fill: teal.fill, edge: teal.edge, label });
const LIGHT_SEG = (units: number, label?: string): Seg => ({ units, fill: teal.light, edge: teal.edge, label });


/** Hop arcs over evenly placed nodes; arc i draws during beat `from + i`. */
function HopArcs({ xs, beats, labels, labelBoxes, width, height, laneHeight }: {
  xs: readonly number[]; beats: RevealBeats; labels: readonly string[]; labelBoxes: ReturnType<typeof placeLineLabels>;
  width: number; height: number; laneHeight: number;
}) {
  const arcTop = height - 42;
  const paths = useMemo(() => xs.slice(1).map((x, i) => {
    const p = Skia.Path.Make();
    p.moveTo(xs[i], height - 2); p.quadTo((xs[i] + x) / 2, arcTop - 29, x, height - 2);
    return p;
  }), [xs, height, arcTop]);
  return <View style={{ height }} pointerEvents="none">
    <Canvas style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      {paths.map((p, i) => <Arc key={i} path={p} beats={beats} at={i + 1} color={Quantity.violet.fill} />)}
    </Canvas>
    {labelBoxes.map(({ n: i, left, width: labelWidth, row }) => beats.landed >= i + 1 ? <View key={`${i}-${beats.runId}`} style={[styles.arcLabel, { left, width: labelWidth, top: row * laneHeight }]}>
      <Land><FaceText adjustsFontSizeToFit={false} style={styles.arcText}>{labels[i]}</FaceText></Land>
    </View> : null)}
  </View>;
}

/** One hop: a soft violet band (centre to centre of two tiles) in the reserved lane above them, its rule written inside. */
function HopBand({ x0, x1, label, runKey }: { x0: number; x1: number; label: string | null; runKey: string }) {
  return <Land key={runKey} style={[styles.hopBand, { left: x0, width: x1 - x0 }]}>
    {label ? <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.hopText}>{label}</Text> : null}
  </Land>;
}

function Arc({ path, beats, at, color }: { path: ReturnType<typeof Skia.Path.Make>; beats: RevealBeats; at: number; color: string }) {
  const end = useDerivedValue(() => Math.min(1, Math.max(0, beats.position.value - at)), [at]);
  const visible = at >= 0;
  // friendly-ok: the animated hop arc joins the two terms being compared.
  return visible ? <Path path={path} style="stroke" strokeWidth={10} strokeCap="round" color={color} start={0} end={end} /> : null;
}

/** A single 28 pt dot follows the beat clock through the supplied rail positions (the shared chunky number line). */
function RailDot({ xs, position, firstBeat = 0, top }: { xs: number[]; position: RevealBeats['position']; firstBeat?: number; top: number }) {
  const motion = useAnimatedStyle(() => {
    const step = Math.max(0, Math.min(xs.length - 1, position.value - firstBeat));
    const i = Math.floor(step);
    const x = xs[i] + (xs[Math.min(i + 1, xs.length - 1)] - xs[i]) * (step - i);
    return { transform: [{ translateX: x }] };
  }, [xs, firstBeat]);
  return <Animated.View style={[{ position: 'absolute', top, left: -14, width: 28, height: 31 }, motion]}><LipDot fill={teal.fill} lip={teal.edge} /></Animated.View>;
}

/** A round piece: its lip is a darker disc of the same size, 3 pt lower, behind the face (a crescent, never a flat band). */
function LipDot({ fill, lip, size = 28 }: { fill: string; lip: string; size?: number }) {
  return <View style={{ width: size, height: size + 3 }}>
    <View style={{ position: 'absolute', top: 3, width: size, height: size, borderRadius: size / 2, backgroundColor: lip }} />
    <View style={{ position: 'absolute', top: 0, width: size, height: size, borderRadius: size / 2, backgroundColor: fill }} />
  </View>;
}

/** Measures the width a model can use. */
function useWidth() {
  const window = useWindowDimensions();
  const [width, setWidth] = useState(Math.max(1, window.width - moderateScale(64)));
  return { width, onLayout: (e: { nativeEvent: { layout: { width: number } } }) => setWidth(e.nativeEvent.layout.width) };
}

/** Beat k is in flight (0-based): its drawing may follow the clock. */
const playing = (beats: RevealBeats, k: number) => !beats.settled && beats.landed === k;

/* ------------------------------------------------------------------ */
/* Balance                                                              */
/* ------------------------------------------------------------------ */



function BalanceProof({ puzzle, answer, mode, onSolutionShown }: Required<Pick<Props, 'mode'>> & Props & { puzzle: Extract<OperationsPuzzle, { type: 'balance' }> }) {
  const index = proofChoice(answer, puzzle.correctIndex, mode);
  const { t } = useTranslation();
  const plan = useMemo(() => balancePlan(puzzle, index, mode, t), [puzzle, index, mode, t]);
  const beats = useProof(plan.steps, onSolutionShown, 0, true);
  const { landed, settled } = beats;
  const rowsMode = plan.rows > 0;
  // Rows dealt so far (beats 1..dealt are the deals).
  const dealt = rowsMode ? (settled ? plan.dealt : plan.dealtAt[Math.max(0, landed - 1)] ?? 0) : 0;
  const leftLoad = rowsMode ? dealt * plan.value : landed >= 3 ? plan.left ?? 0 : 0;
  const tilt = useSharedValue(rowsMode ? balanceTilt(0, plan.right) : 0);
  const target = rowsMode ? balanceTilt(leftLoad, plan.right) : landed >= 4 || settled ? balanceTilt(plan.left ?? 0, plan.right) : 0;
  useEffect(() => { tilt.set(withTiming(target, { duration: ProofMotion.beat[180], easing: Easing.out(Easing.cubic) })); }, [target, tilt]);

  const parts = plan.parts;
  const substituted = landed >= 2 || settled;
  const focus = rowsMode ? (Math.max(0, dealt - 1) + .5) / plan.rows : .5;
  const left = rowsMode
    ? <BalanceGroups rows={plan.rows} value={String(plan.value)} dealt={dealt} right={plan.right} />
    : landed >= 3 || settled ? <Num size="sm" value={minus(plan.left ?? 0)} tone="given" /> : <View style={styles.load}>
      {parts ? <View style={styles.inline}>
        <Num size="sm" value={parts.a === '?' ? (substituted ? String(plan.value) : '?') : parts.a} tone={parts.a === '?' ? (substituted ? 'active' : 'empty') : 'given'} />
        <Sym>{parts.op}</Sym>
        <Num size="sm" value={parts.b === '?' ? (substituted ? String(plan.value) : '?') : parts.b} tone={parts.b === '?' ? (substituted ? 'active' : 'empty') : 'given'} />
      </View> : <FaceText style={styles.sym}>{puzzle.payload.leftDisplay}</FaceText>}
    </View>;
  const right = <BalanceWeight value={plan.right} />;
  return <ProofFrame finalOnly beats={beats} steps={plan.steps} final={plan.final} label={`${puzzle.payload.leftDisplay} = ${plan.right}`}>
    {/* Rows mode: a narrow right tray for the single weight, so the 44 pt rows fit the left tray (same as BalanceModel). */}
    <BalanceScale wide={rowsMode} rightWidth={rowsMode ? 96 : undefined} proofFocus={focus} tilt={tilt} left={left} right={right} />
  </ProofFrame>;
}

/* ------------------------------------------------------------------ */
/* Equation board                                                       */
/* ------------------------------------------------------------------ */

function EquationProof({ puzzle, answer, mode, onSolutionShown }: Required<Pick<Props, 'mode'>> & Props & { puzzle: Extract<OperationsPuzzle, { type: 'equation_board' }> }) {
  const { t } = useTranslation();
  const a0 = useMemo(() => answer ?? proofAnswer(puzzle, null, mode, true), [puzzle, answer, mode]);
  const plan = useMemo(() => equationPlan(puzzle, a0, mode, t), [puzzle, a0, mode, t]);
  const beats = useProof(plan.steps, onSolutionShown, ProofMotion.lead, plan.tiles);
  const { landed, settled } = beats;
  const at = settled ? plan.steps.length - 1 : Math.max(0, landed - 1);
  const inFlight = !settled && landed < plan.steps.length ? landed : -1;
  const moveIndex = inFlight >= 0 ? plan.stepMove[inFlight] : -1;
  // While a move plays, draw the state it starts from; it lands as the next state.
  const shown = plan.states[plan.stepState[at]];
  const progress = useDerivedValue(() => Math.min(1, Math.max(0, beats.position.value - inFlight)));
  const move = moveIndex >= 0 ? plan.moves[moveIndex] : null;
  if (!plan.tiles) {
    return <RevealSurface beats={beats} style={styles.frame}>
      <Text nativeID="play-proof-equation" testID="play-proof-equation" style={styles.eqLine}>{equationLabel(shown)}</Text>
    </RevealSurface>;
  }
  // A miss redraws the entry scale itself (same size, same place) and plays the child's moves on its own tiles.
  if (mode === 'attempt' && !plan.ok) {
    return <ProofFrame finalOnly beats={beats} steps={plan.steps} final={plan.final} label={equationLabel(plan.states[0])}>
      <EquationBoardModel equation={shown} imbalance lean={settled}
        driven={move ? { from: plan.states[moveIndex], to: plan.states[moveIndex + 1], landed: move.operation === 'add' && move.amount > 0 ? 1 : 0, progress }
          : { from: shown, to: shown, landed: 2, progress }} />
    </ProofFrame>;
  }
  const leaving = move?.operation === 'add' && move.amount < 0 ? -move.amount : 0;
  const arriving = move?.operation === 'add' && move.amount > 0 ? move.amount : 0;
  const sharing = move?.operation === 'divide' ? move.amount : 0;
  const xLabel = settled && plan.ok && shown.a === 1 && shown.b === 0 ? String(shown.c) : 'x';
  const side = (units: number) => <UnitRow count={units} leaving={leaving ? { n: leaving, progress } : null} arriving={arriving ? { n: arriving, progress } : null} />;
  return <ProofFrame finalOnly beats={beats} steps={plan.steps} final={plan.final} label={equationLabel(plan.states[0])}>
    <BalanceScale wide proofFocus={move ? 1 : .5}
      left={<View style={styles.eqPan}>
        <ProofLanding landed={landed > 0 && plan.stepMove[at] >= 0}><View style={styles.wrapRow}>{Array.from({ length: shown.a }, (_, i) => <XTile key={i} label={xLabel} fading={sharing && i > 0 ? progress : null} />)}</View></ProofLanding>
        {side(shown.b)}
      </View>}
      right={<View style={styles.eqPan}>
        {sharing ? <View style={styles.wrapRow}>{Array.from({ length: sharing }, (_, g) => <View key={g} style={styles.shareGroup}><UnitRow count={shown.c / sharing} /></View>)}</View>
          : side(shown.c)}
      </View>} />
  </ProofFrame>;
}

function XTile({ label, fading = null }: { label: string; fading?: RevealBeats['progress'] | null }) {
  const motion = useAnimatedStyle(() => ({ opacity: fading ? 1 - .85 * fading.value : 1 }), [fading]);
  return <Animated.View style={[styles.xTile, motion]}><FaceText style={styles.xText}>{label}</FaceText></Animated.View>;
}

/** Unit tiles in rows of five. The trailing `leaving` units drop away; `arriving` units fade in, on both sides together. */
function UnitRow({ count, leaving = null, arriving = null }: { count: number; leaving?: { n: number; progress: RevealBeats['progress'] } | null; arriving?: { n: number; progress: RevealBeats['progress'] } | null }) {
  const total = count + (arriving?.n ?? 0);
  if (total <= 0) return null;
  return <View style={[styles.wrapRow, styles.units]}>
    {Array.from({ length: total }, (_, i) => {
      const leaves = !!leaving && i >= count - leaving.n;
      const arrives = !!arriving && i >= count;
      return <UnitTile key={i} motion={leaves ? { kind: 'leave', progress: leaving!.progress } : arrives ? { kind: 'arrive', progress: arriving!.progress } : null} />;
    })}
  </View>;
}

const UNIT_DROP = moderateScale(14);

function UnitTile({ motion }: { motion: { kind: 'leave' | 'arrive'; progress: RevealBeats['progress'] } | null }) {
  const style = useAnimatedStyle(() => {
    if (!motion) return { opacity: 1 };
    const p = motion.progress.value;
    return motion.kind === 'leave'
      ? { opacity: 1 - p, transform: [{ translateY: p * UNIT_DROP }] }
      : { opacity: p, transform: [{ translateY: (1 - p) * -UNIT_DROP }] };
  }, [motion]);
  return <Animated.View style={[styles.unit, motion?.kind === 'leave' && styles.unitLeaving, style]}><FaceText style={styles.unitText}>1</FaceText></Animated.View>;
}

/* ------------------------------------------------------------------ */
/* Estimate                                                             */
/* ------------------------------------------------------------------ */

function EstimateProof({ puzzle, answer, mode, onSolutionShown }: Required<Pick<Props, 'mode'>> & Props & { puzzle: Extract<OperationsPuzzle, { type: 'estimate' }> }) {
  const index = proofChoice(answer, puzzle.correctIndex, mode);
  const { t } = useTranslation();
  const plan = useMemo(() => estimatePlan(puzzle, index, mode, t), [puzzle, index, mode, t]);
  const attempt = mode === 'attempt' && plan && !plan.ok;
  const stops = plan ? attempt ? [plan.chosen] : [...new Set([plan.a, plan.total, plan.nearest])] : [];
  const count = Math.max(0, stops.length - 1);
  const beats = useRevealBeats(count, { awaitInitialPaint: true, lead: 100, step: count > 1 ? 900 : 1400, minTotal: 0,
    hold: i => i === count ? 400 : 160, reducedSteps: true, onDone: onSolutionShown });
  const trackCanvas = useProofCanvasPaint(beats, !!plan, [0]);
  if (!plan) return null;
  const submitted = attempt ? plan.chosen : undefined;
  return <RevealSurface beats={beats}>
    <LandmarkLine start={plan.a} goal={plan.nearest} scale={estimateScale(plan.a, plan.total, submitted)} route={stops}
      trackCanvas={trackCanvas} position={beats.position} landed={beats.landed} settled={beats.settled}
      submitted={submitted} annotate />
    {beats.settled && <PlayProofCaption><View testID="play-proof-equation" nativeID="play-proof-equation">
      <ProofCaption text={attempt ? `${plan.chosen} ≠ ${plan.nearest}` : plan.final} /></View></PlayProofCaption>}
  </RevealSurface>;
}

/* ------------------------------------------------------------------ */
/* Find all pairs                                                       */
/* ------------------------------------------------------------------ */

/** Move the same tile from its submitted position to its place in the proof. */
function TravellingTile({ from, to, start, duration = 1, position, children }: {
  from: { x: number; y: number }; to: { x: number; y: number }; start: number; duration?: number;
  position: RevealBeats['position']; children: ReactNode;
}) {
  const motion = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, (position.value - start) / duration));
    return { transform: [{ translateX: from.x + (to.x - from.x) * progress }, { translateY: from.y + (to.y - from.y) * progress }] };
  }, [from.x, from.y, to.x, to.y, start, duration]);
  return <Animated.View style={[styles.traveller, motion]}>{children}</Animated.View>;
}

function PairsProof({ puzzle, answer, isCorrect, mode, onSolutionShown }: Required<Pick<Props, 'mode'>> & Props & { puzzle: Extract<OperationsPuzzle, { type: 'find_all_pairs' }> }) {
  const a0 = useMemo(() => proofAnswer(puzzle, answer, mode, !!isCorrect), [puzzle, answer, mode, isCorrect]);
  const plan = useMemo(() => findPairsPlan(puzzle, a0, mode), [puzzle, a0, mode]);
  const beats = useProof(plan.steps, onSolutionShown);
  const failed = plan.sums.findIndex(sum => sum !== puzzle.payload.target);
  const shown = beats.settled ? plan.pairs : plan.pairs.slice(0, Math.max(0, beats.landed - 1));
  return <ProofFrame finalOnly beats={beats} steps={plan.steps} final={plan.final} label={puzzle.question}>
    <FindAllPairsTask puzzle={puzzle} pairs={shown} answered onChange={() => {}} missedPair={failed >= 0 ? plan.pairs[failed] : undefined} />
  </ProofFrame>;
}

/* ------------------------------------------------------------------ */
/* Fix the mistake (column work)                                        */
/* ------------------------------------------------------------------ */

function FixProof({ puzzle, answer, mode, onSolutionShown }: Required<Pick<Props, 'mode'>> & Props & { puzzle: Extract<OperationsPuzzle, { type: 'fix_mistake' }> }) {
  const { t } = useTranslation();
  const index = proofChoice(answer, puzzle.correctIndex, mode);
  const plan = useMemo(() => fixPlan(puzzle, index, mode), [puzzle, index, mode]);
  const equationDetail = (useProofViewport()?.fontScale ?? 1) >= 2;
  const showSignature = !equationDetail && (mode !== 'attempt' || !!plan?.ok);
  const beats = useProof(plan?.steps ?? [], onSolutionShown, ProofMotion.lead, showSignature);
  if (!plan) return null;
  const { landed, settled } = beats;
  const offset = plan.op !== plan.written ? 2 : 1;
  const done = settled ? plan.work.length : Math.max(0, Math.min(plan.work.length, landed - offset));
  const committed = plan.work.slice(0, done);
  const active = !settled && done > 0 ? plan.work[done - 1] : null;
  const digits = new Map<number, number>();
  const carries = new Set<number>();
  for (const s of committed) {
    if (s.kind === 'column') digits.set(s.column, s.digit);
    else carries.add(plan.op === '+' ? s.column + 1 : s.column);
  }
  const w = plan.width;
  const cells = (s: string) => s.padStart(w, ' ').split('');
  const claimed = cells(plan.claimed);
  const shownDigits = claimed.map((ch, k) => String(digits.get(w - 1 - k) ?? ch));
  const opShown = landed >= 2 || settled ? plan.op : plan.written;
  const columnOf = (k: number) => w - 1 - k;
  const row = (chars: string[], tone: (k: number) => Tone | null, key: string) => <View key={key} style={styles.colRow}>
    {chars.map((ch, k) => {
      const tn = tone(k);
      return <View key={k} style={[styles.colCell, active && columnOf(k) === active.column && styles.colActive]}>
        {ch.trim() ? <View style={[styles.digitFace, tn ? { backgroundColor: TONES[tn].fill, borderBottomColor: TONES[tn].edge } : null]}>
          <Text maxFontSizeMultiplier={1.2} style={styles.digit}>{ch}</Text></View> : null}
      </View>;
    })}
  </View>;
  return <ProofFrame beats={beats} steps={plan.steps} final={plan.ok && !equationDetail ? '' : plan.final} label={plan.ok && settled ? plan.final : `${plan.a} ${opShown} ${plan.b} = ${shownDigits.join('').trim()}`}>
    <View style={[styles.claimCard, equationDetail && styles.compactClaim]}>
      {showSignature && <View style={styles.signature}><DiagramIcon name="cat" size={moderateScale(26)} /><Text maxFontSizeMultiplier={1.7} style={styles.signatureText}>{t('puzzleTypes.minkaTried')}</Text></View>}
      {plan.columns ? <View style={styles.columns}>
        <View style={styles.colRow}><View style={styles.opCell} />{cells(plan.a).map((_, k) => <View key={k} style={[styles.colCell]}>
          {!settled && carries.has(columnOf(k)) ? <Land><View style={styles.carry}><FaceText style={styles.carryText}>{plan.op === '+' ? '1' : '10'}</FaceText></View></Land> : null}
        </View>)}</View>
        <View style={styles.inline}><View style={styles.opCell} />{row(cells(plan.a), () => 'given', 'a')}</View>
        <View style={styles.inline}><View style={styles.opCell}><Text maxFontSizeMultiplier={1.2} style={[styles.columnOperator, opShown !== plan.written && { color: PuzzleColors.success }]}>{opShown}</Text></View>{row(cells(plan.b), () => 'given', 'b')}</View>
        <View style={styles.colRule} />
        <View style={styles.inline}>
          <View style={styles.opCell} />
          {row(shownDigits, k => columnOf(k) === plan.mismatchColumn ? 'plain' : digits.has(columnOf(k)) ? 'given' : !settled && plan.work.some(step => step.kind === 'column' && step.column === columnOf(k) && String(step.digit) !== claimed[k]) ? 'plain' : 'given', 'result')}
        </View>
      </View> : <View style={styles.factRows}>
        <Text style={styles.eqLine}>{plan.mismatchColumn !== undefined || (mode === 'attempt' && !plan.ok) ? `${plan.a} ${plan.written} ${plan.b} = ${plan.claimed}` : landed >= 2 || settled ? plan.steps[1].caption : puzzle.payload.wrongWork[0]}</Text>
      </View>}
    </View>
  </ProofFrame>;
}

/* ------------------------------------------------------------------ */
/* Function machine                                                     */
/* ------------------------------------------------------------------ */

function MachineProof({ puzzle, answer, mode, onSolutionShown }: Required<Pick<Props, 'mode'>> & Props & { puzzle: Extract<OperationsPuzzle, { type: 'function_machine' }> }) {
  const index = proofChoice(answer, puzzle.correctIndex, mode);
  const plan = useMemo(() => machinePlan(puzzle, index), [puzzle, index]);
  const beats = useProof(plan?.steps ?? [], onSolutionShown);
  if (!plan) return null;
  return <ProofFrame beats={beats} steps={plan.steps} final={plan.final} label={puzzle.question}>
    <MachineLane input={puzzle.payload.input} output={puzzle.payload.output} proof={{ plan, beats }}
      socket={<UnknownWell label={plan.rule} filled />} />
  </ProofFrame>;
}

/* ------------------------------------------------------------------ */
/* Operation path                                                       */
/* ------------------------------------------------------------------ */

function PathProof({ puzzle, answer, isCorrect, mode, onSolutionShown }: Required<Pick<Props, 'mode'>> & Props & { puzzle: Extract<OperationsPuzzle, { type: 'operation_path' }> }) {
  const a0 = useMemo(() => proofAnswer(puzzle, answer, mode, !!isCorrect), [puzzle, answer, mode, isCorrect]);
  const plan = useMemo(() => pathPlan(puzzle, a0.kind === 'operators' ? a0.operators : []), [puzzle, a0]);
  const beats = useProof(plan.steps, onSolutionShown);
  const reached = beats.settled ? plan.rows : Math.max(0, beats.landed - 1);
  return <ProofFrame finalOnly beats={beats} steps={plan.steps} final={plan.final} label={puzzle.question}>
    <OperationEquation numbers={[puzzle.payload.start, ...puzzle.payload.steps.map(step => step.operand)]}
      operators={plan.operators.slice(0, reached)} target={puzzle.payload.target} miss={!plan.ok && reached >= plan.rows}
      missedSlot={plan.operators.findIndex((op, i) => op !== puzzle.payload.steps[i]?.operator)} />
  </ProofFrame>;
}

/* ------------------------------------------------------------------ */
/* Order numbers                                                        */
/* ------------------------------------------------------------------ */

function OrderProof({ puzzle, answer, isCorrect, mode, onSolutionShown }: Required<Pick<Props, 'mode'>> & Props & { puzzle: Extract<OperationsPuzzle, { type: 'order_numbers' }> }) {
  const a0 = useMemo(() => proofAnswer(puzzle, answer, mode, !!isCorrect), [puzzle, answer, mode, isCorrect]);
  const order = a0.kind === 'order' ? a0.numbers : puzzle.payload.correctOrder;
  const plan = useMemo(() => orderPlan(puzzle, order, mode), [puzzle, order, mode]);
  const beats = useProof(plan.steps, onSolutionShown);
  const { width, onLayout } = useWidth();
  const { width: screen } = useWindowDimensions();
  const compared = Math.min(plan.compared, Math.max(0, beats.landed - 1));
  const active = beats.settled || compared === 0 ? -1 : compared - 1;
  // The entry row's tiles, kept in place: the same size, the same even gaps, centred. A miss flags one tile amber and moves nothing.
  const { tile: size, gap, width: rowW } = orderLayout(screen, order.length);
  const left = Math.max(0, (width - rowW) / 2);
  const stopX = (i: number) => left + i * (size + gap);
  const flagged = mode === 'attempt' && !plan.ok ? plan.inversion : -1;
  return <ProofFrame finalOnly beats={beats} steps={plan.steps} final={plan.final} label={order.join(', ')}>
    <View style={{ alignSelf: 'stretch' }}>
    <View style={{ height: HINT_LANE }} />
    <View onLayout={onLayout} style={{ alignSelf: 'stretch', height: size }}>
      {active >= 0 && <FaceText style={[styles.relation, { top: (size - 28) / 2, left: stopX(active) + size + gap / 2 - 10 }]}>
        {order[active] < order[active + 1] ? '<' : order[active] > order[active + 1] ? '>' : '='}
      </FaceText>}
      {order.map((n, i) => <View key={i} style={{ position: 'absolute', left: stopX(i), top: 0 }}>
        <Num value={n} tone={i === flagged ? 'plain' : 'given'} fit={size} style={{ width: size, minWidth: size, height: size, minHeight: size }} />
      </View>)}
    </View>
    <View style={{ height: HINT_LANE }} />
    </View>
  </ProofFrame>;
}

/* ------------------------------------------------------------------ */
/* Pair sum                                                             */
/* ------------------------------------------------------------------ */

function PairProof({ puzzle, answer, isCorrect, mode, onSolutionShown }: Required<Pick<Props, 'mode'>> & Props & { puzzle: Extract<OperationsPuzzle, { type: 'pair_sum' }> }) {
  const a0 = useMemo(() => proofAnswer(puzzle, answer, mode, !!isCorrect), [puzzle, answer, mode, isCorrect]);
  const indices = a0.kind === 'pair' ? a0.indices : puzzle.payload.correctIndices;
  const plan = useMemo(() => pairPlan(puzzle, indices), [puzzle, indices]);
  const beats = useProof(plan.steps, onSolutionShown);
  return <ProofFrame finalOnly beats={beats} steps={plan.steps} final={plan.final} label={puzzle.question}>
    <PairEquation target={plan.target} miss={beats.settled && !plan.ok} slots={indices.map((index, part) => {
      const landed = beats.settled || beats.landed > part;
      return <ProofLanding key={part} landed={landed}><EquationTile value={landed ? puzzle.payload.numbers[index] : undefined}
        face={landed ? beats.settled && !plan.ok && part === 1 ? 'target' : 'number' : 'empty'} /></ProofLanding>;
    })} />
  </ProofFrame>;
}

/* ------------------------------------------------------------------ */
/* Pattern next / repair                                                */
/* ------------------------------------------------------------------ */

const PATTERN_GAP = PATTERN_GAP_SHARED;

/** The same 56–64 pt tile as the entry row, so the proof only transforms it in place. */
function usePatternTile(n: number) {
  const { width } = useWindowDimensions();
  return patternTileSize(width, n);
}

function slotXs(n: number, tile: number) {
  return Array.from({ length: n }, (_, i) => i * (tile + PATTERN_GAP) + tile / 2);
}

function PatternProof({ puzzle, answer, mode, onSolutionShown }: Required<Pick<Props, 'mode'>> & Props & { puzzle: Extract<OperationsPuzzle, { type: 'pattern_next' }> }) {
  const index = proofChoice(answer, puzzle.correctIndex, mode);
  const plan = useMemo(() => patternPlan(puzzle, index), [puzzle, index]);
  const beats = useProof(plan.steps, onSolutionShown, ProofMotion.lead);
  const seq = plan.sequence;
  const PATTERN_TILE = usePatternTile(seq.length + 1);
  const xs = slotXs(seq.length + 1, PATTERN_TILE);
  const all = [...seq, plan.chosen];
  const labels = [...seq.slice(1), plan.next].map((v, i) => stepLabel(all[i], v, plan.rule));
  const hop = Math.min(labels.length - 1, Math.max(0, beats.landed));
  const tileStyle = { width: PATTERN_TILE, minWidth: PATTERN_TILE, height: PATTERN_TILE, minHeight: PATTERN_TILE };
  // A hop band lives in a lane above the row; an equal lane below keeps the row centred. A miss shows no band: one amber tile, and the equation says the rest.
  return <ProofFrame finalOnly beats={beats} steps={plan.steps} final={plan.final} label={seq.join(', ')}>
    <View style={[styles.patternBox, { width: xs.at(-1)! + PATTERN_TILE / 2 }]}>
      <View style={{ height: HOP_LANE }}>
        {!beats.settled && <HopBand key={`${hop}-${beats.runId}`} runKey={`${hop}-${beats.runId}`} x0={xs[hop]} x1={xs[hop + 1]} label={labels[hop]} />}
      </View>
      <View style={[styles.inline, { gap: PATTERN_GAP }]}>
        {all.map((v, i) => <Num key={i} value={v} flat={i < all.length - 1} tone={i === all.length - 1 ? (beats.settled ? plan.ok ? 'given' : 'plain' : 'active') : 'given'} fit={PATTERN_TILE} style={tileStyle} />)}
      </View>
      <View style={{ height: HOP_LANE }} />
    </View>
  </ProofFrame>;
}

function RepairProof({ puzzle, answer, isCorrect, mode, onSolutionShown }: Required<Pick<Props, 'mode'>> & Props & { puzzle: Extract<OperationsPuzzle, { type: 'repair_pattern' }> }) {
  const a0 = useMemo(() => proofAnswer(puzzle, answer, mode, !!isCorrect), [puzzle, answer, mode, isCorrect]);
  const values = a0.kind === 'sequence' ? a0.values : puzzle.payload.solution;
  const plan = useMemo(() => repairPlan(puzzle, values, mode), [puzzle, values, mode]);
  const beats = useProof(plan.steps, onSolutionShown, ProofMotion.lead);
  const { landed, settled } = beats;
  const seq = plan.sequence;
  const PATTERN_TILE = usePatternTile(seq.length);
  const xs = slotXs(seq.length, PATTERN_TILE);
  // Beat 1 retains the run; beat 2 draws the rule between the anchors; then one gap per beat.
  const gapBeat = (k: number) => (plan.anchors ? 2 : 1) + k;
  const from = seq.slice(1).map((_, i) => {
    const gap = plan.gaps.indexOf(i + 1);
    return gap >= 0 && gap < plan.checked ? gapBeat(gap) : -1;
  });
  const anchors = plan.anchors;
  const showingRule = anchors && landed < gapBeat(0);
  const interval = from.indexOf(landed);
  const ruleLabel = plan.rule ? `${plan.rule.op}${plan.rule.n}` : null;
  const tileStyle = { width: PATTERN_TILE, minWidth: PATTERN_TILE, height: PATTERN_TILE, minHeight: PATTERN_TILE };
  // The band and its rule label always appear together.
  const hop = !ruleLabel || settled ? null : showingRule ? { from: anchors[0], to: anchors[1], label: ruleLabel } : interval >= 0 ? { from: interval, to: interval + 1, label: ruleLabel } : null;
  return <ProofFrame finalOnly beats={beats} steps={plan.steps} final={plan.final} label={plan.filled.map(v => v ?? '?').join(', ')}>
    <View style={[styles.patternBox, { width: xs.at(-1)! + PATTERN_TILE / 2 }]}>
      <View style={{ height: HOP_LANE }}>
        {hop ? <HopBand key={`${landed}-${beats.runId}`} runKey={`${landed}-${beats.runId}`} x0={xs[hop.from]} x1={xs[hop.to]} label={hop.label} /> : null}
      </View>
      <View style={[styles.inline, { gap: PATTERN_GAP }]}>
        {seq.map((v, i) => {
          const g = plan.gaps.indexOf(i);
          if (g < 0) return <Num key={i} value={String(v)} tone="given" flat fit={PATTERN_TILE} style={tileStyle} />;
          const checked = g < plan.checked && (landed > gapBeat(g) || settled);
          const good = plan.filled[i] === puzzle.payload.solution[g];
          return <View key={i} style={{ width: PATTERN_TILE, height: PATTERN_TILE }}>
            <TravellingTile from={{ x: 0, y: 0 }} to={{ x: 0, y: 0 }} start={g < plan.checked ? gapBeat(g) : Infinity} position={beats.position}>
              <ProofLanding landed={checked}><Num value={String(plan.filled[i])} tone={checked && !good ? 'plain' : 'active'} fit={PATTERN_TILE} style={tileStyle} /></ProofLanding>
            </TravellingTile>
          </View>;
        })}
      </View>
      <View style={{ height: HOP_LANE }} />
    </View>
  </ProofFrame>;
}

/* ------------------------------------------------------------------ */
/* Route grid                                                           */
/* ------------------------------------------------------------------ */

function RouteProof({ puzzle, answer, isCorrect, mode, onSolutionShown }: Required<Pick<Props, 'mode'>> & Props & { puzzle: Extract<OperationsPuzzle, { type: 'route_grid' }> }) {
  useModelStage();
  const { t } = useTranslation();
  const a0 = useMemo(() => proofAnswer(puzzle, answer, mode, !!isCorrect), [puzzle, answer, mode, isCorrect]);
  const plan = useMemo(() => routePlan(puzzle, a0.kind === 'route' ? a0.cells : [0], t), [puzzle, a0, t]);
  const beats = useProof(plan.steps, onSolutionShown);
  const { landed, settled } = beats;
  const p = puzzle.payload;
  const rows = Math.ceil(p.cells.length / p.columns);
  const { width, onLayout } = useWidth();
  const cellH = ROUTE_CELL;
  const cellW = (width - (p.columns - 1) * ROUTE_GAP) / p.columns;
  const walked = settled ? plan.moves : Math.max(0, Math.min(plan.moves, landed - 1));
  const at = plan.cells[walked];
  const centre = (i: number) => ({ x: (i % p.columns) * (cellW + ROUTE_GAP) + cellW / 2, y: Math.floor(i / p.columns) * (cellH + ROUTE_GAP) + cellH / 2 });
  const H = rows * cellH + (rows - 1) * ROUTE_GAP;
  const path = plan.cells.slice(0, walked + 1);
  return <ProofFrame beats={beats} steps={plan.steps} final={plan.final} label={puzzle.question}>
    <View onLayout={onLayout} style={{ alignSelf: 'stretch', height: H }}>
      <RouteGridSurface width={width} columns={p.columns} count={p.cells.length} path={path} miss={mode === 'attempt' && !isCorrect} />
      {width > 0 && p.cells.map((c, i) => {
        const { x, y } = centre(i);
        const here = i === at;
        return <View key={i} style={[styles.routeCell, { left: x - cellW / 2, top: y - cellH / 2, width: cellW, height: cellH, borderRadius: Shape.tile(cellH) }]}>
          {here ? <Land key={`here-${walked}-${beats.runId}`} skip={walked === 0}><FaceText adjustsFontSizeToFit={false} style={styles.routeText}>{minus(plan.values[walked] ?? p.start)}</FaceText></Land>
            : i === 0 ? <FaceText adjustsFontSizeToFit={false} style={styles.routeText}>{p.start}</FaceText> : c ? <FaceText adjustsFontSizeToFit={false} style={styles.routeText}>{`${sign(c.operator)}${c.operand}`}</FaceText> : null}
        </View>;
      })}
    </View>
  </ProofFrame>;
}

/* ------------------------------------------------------------------ */
/* Target build                                                         */
/* ------------------------------------------------------------------ */

function BuildProof({ puzzle, answer, isCorrect, mode, onSolutionShown }: Required<Pick<Props, 'mode'>> & Props & { puzzle: Extract<OperationsPuzzle, { type: 'target_build' }> }) {
  useKeepModelOrigin(useWindowDimensions().fontScale >= 2);
  const a0 = useMemo(() => proofAnswer(puzzle, answer, mode, !!isCorrect), [puzzle, answer, mode, isCorrect]);
  const operators = a0.kind === 'operators' ? a0.operators : puzzle.payload.solution;
  const plan = useMemo(() => buildPlan(puzzle, operators), [puzzle, operators]);
  const beats = useProof(plan.steps, onSolutionShown, 0);
  return <ProofFrame finalOnly beats={beats} steps={plan.steps} final={plan.final} label={puzzle.question}>
    <OperationEquation numbers={puzzle.payload.numbers} operators={operators.slice(0, beats.settled ? operators.length : beats.landed)}
      target={puzzle.payload.target} miss={beats.settled && !plan.ok} missedSlot={operators.findIndex((op, i) => op !== puzzle.payload.solution[i])} />
  </ProofFrame>;
}

/* ------------------------------------------------------------------ */
/* True / false                                                         */
/* ------------------------------------------------------------------ */

function ClaimProof({ puzzle, answer, mode, onSolutionShown }: Required<Pick<Props, 'mode'>> & Props & { puzzle: Extract<OperationsPuzzle, { type: 'true_false' }> }) {
  const { t } = useTranslation();
  const index = proofChoice(answer, puzzle.isTrue ? 0 : 1, mode);
  const plan = useMemo(() => claimPlan(puzzle, index, t), [puzzle, index, t]);
  const steps = plan?.steps;
  // The cat in the signed claim is a Skia drawing on both correct and retry paths.
  const beats = useProof(steps ?? [], onSolutionShown, ProofMotion.lead, true);
  const { width, onLayout } = useWidth();
  const { fontScale } = useWindowDimensions();
  const compactClaim = fontScale >= 2;
  if (!plan) return null;
  const { landed, settled } = beats;
  const claim = <View style={[styles.claimCard, compactClaim && styles.compactClaim]}>
    <View style={styles.signature}><DiagramIcon name="cat" size={moderateScale(26)} /><Text maxFontSizeMultiplier={compactClaim ? 1.35 : 1.7} style={styles.signatureText}>{t('puzzleTypes.minkaSays')}</Text></View>
    <Text numberOfLines={compactClaim ? 1 : undefined} adjustsFontSizeToFit={compactClaim} maxFontSizeMultiplier={compactClaim ? 1.6 : 2}
      style={[styles.claim, compactClaim && styles.compactClaimText]}>{settled && mode !== 'attempt' ? plan.final : plan.statement}</Text>
  </View>;
  const hops = plan.hops;
  const stops = hops ? [hops[0].from, ...hops.map(h => h.to)] : [];
  const pad = moderateScale(28);
  const claimed = plan.relation === '=' ? Number(plan.other.replace('−', '-')) : NaN;
  const limits = Number.isFinite(claimed) ? [...stops, claimed] : stops;
  const lo = Math.min(...limits), hi = Math.max(...limits);
  const pointX = (value: number) => pad + (width - pad * 2) * (hi === lo ? .5 : (value - lo) / (hi - lo));
  const xs = stops.map(pointX);
  const claimX = pointX(claimed);
  const raisedClaim = claimX > Math.min(...xs) - 32 && claimX < Math.max(...xs) + 32;
  const labels = placeLineLabels([...new Set(stops)].map(n => ({ n, center: pointX(n),
    width: 4 + minus(n).length * 14 * Math.min(fontScale, 1.4) })), width);
  const laneHeight = Math.ceil(30 * Math.min(fontScale, 1.4));
  const hopLabels = (hops ?? []).map(h => h.by > 0 ? `+${h.by}` : `−${-h.by}`);
  const hopBoxes = placeLineLabels(hopLabels.map((label, i) => ({ n: i,
    center: (xs[i] + xs[i + 1]) / 2, width: (label.length * 14 + 4) * Math.min(fontScale, 1.4) })), width);
  const arcHeight = 42 + laneHeight * (hopBoxes.some(label => label.row) ? 2 : 1);
  return <ProofFrame finalOnly beats={beats} steps={plan.steps} final={mode === 'attempt' ? plan.final : ''} label={plan.statement}>
    {claim}
    <View onLayout={onLayout} style={styles.claimModel}>
      {width > 0 && hops ? <View style={{ height: arcHeight + 18 + laneHeight * (labels.some(label => label.row) ? 2 : 1) }}>
        <HopArcs width={width} height={arcHeight} laneHeight={laneHeight} xs={xs} beats={beats} labels={hopLabels} labelBoxes={hopBoxes} />
        <View pointerEvents="none" style={[styles.claimRail, { top: arcHeight - 8, left: pad / 2, width: width - pad }]} />
        {stops.map((v, i) => i === 0 || landed > i || settled ? <View key={`t${i}`} style={[styles.claimTick, { left: xs[i] - 5, top: arcHeight - 11 }]} /> : null)}
        <RailDot xs={xs} position={beats.position} firstBeat={1} top={arcHeight - 16} />
        {mode === 'attempt' && Number.isFinite(claimed) && <View style={[styles.claimDot, { left: claimX - 14, top: arcHeight - 16 - (raisedClaim ? 36 : 0) }]}><LipDot fill={amber.fill} lip={amber.edge} /></View>}
        {labels.map(({ n, left, width: boxWidth, row }) => stops.indexOf(n) === 0 || landed > stops.indexOf(n) || settled
          ? <Land key={n} skip={stops.indexOf(n) === 0} style={[styles.stop, { left, width: boxWidth, top: arcHeight + 18 + row * laneHeight }]}>
            <FaceText adjustsFontSizeToFit={false} style={styles.pinText}>{minus(n)}</FaceText></Land> : null)}
      </View> : null}
      {width > 0 && plan.groups && (landed >= 2 || settled) ? <Land key={`g${beats.runId}`} style={{ gap: 3 }}>
        <Tape segments={Array.from({ length: plan.groups.count }, (_, i) => (i % 2 ? LIGHT_SEG : TEAL_SEG)(plan.groups!.size, String(plan.groups!.size)))}
          unit={width / (plan.groups.count * plan.groups.size)} grow={playing(beats, 1) ? { index: plan.groups.count - 1, progress: beats.progress } : null} />
      </Land> : null}

    </View>

  </ProofFrame>;
}

/* ------------------------------------------------------------------ */
/* Entry                                                                */
/* ------------------------------------------------------------------ */

/**
 * The checked proof for an operations puzzle. Mount it with a key per checked
 * attempt so Watch again restores that attempt's starting state.
 */
export function OperationsReveal({ puzzle, answer = null, isCorrect, mode = 'worked', onSolutionShown }: Props) {
  const props = { answer, isCorrect: isCorrect ?? (mode === 'worked'), mode, onSolutionShown };
  switch (puzzle.type) {
    case 'balance': return <BalanceProof puzzle={puzzle} {...props} />;
    case 'equation_board': return <EquationProof puzzle={puzzle} {...props} />;
    case 'estimate': return <EstimateProof puzzle={puzzle} {...props} />;
    case 'find_all_pairs': return <PairsProof puzzle={puzzle} {...props} />;
    case 'fix_mistake': return <FixProof puzzle={puzzle} {...props} />;
    case 'function_machine': return <MachineProof puzzle={puzzle} {...props} />;
    case 'operation_path': return <PathProof puzzle={puzzle} {...props} />;
    case 'order_numbers': return <OrderProof puzzle={puzzle} {...props} />;
    case 'pair_sum': return <PairProof puzzle={puzzle} {...props} />;
    case 'pattern_next': return <PatternProof puzzle={puzzle} {...props} />;
    case 'repair_pattern': return <RepairProof puzzle={puzzle} {...props} />;
    case 'route_grid': return <RouteProof puzzle={puzzle} {...props} />;
    case 'target_build': return <BuildProof puzzle={puzzle} {...props} />;
    case 'true_false': return <ClaimProof puzzle={puzzle} {...props} />;
  }
}

const DIGIT = 56;

const styles = StyleSheet.create({
  exactTen: { alignSelf: 'center', fontSize: 15, color: Ink.text },
  distanceLabel: { position: 'absolute', top: 28, width: 24, textAlign: 'center', color: teal.edge, fontSize: 12 },
  relation: { position: 'absolute', top: 0, width: 20, textAlign: 'center', fontSize: 17, fontWeight: '800', color: teal.edge },
  frame: { alignSelf: 'stretch', gap: moderateScale(8) },
  model: { alignSelf: 'stretch', gap: moderateScale(12), alignItems: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Shape.space.loose },
  num: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: moderateScale(6) },
  numText: { fontSize: moderateScale(21), lineHeight: moderateScale(26), fontWeight: '800', textAlign: 'center', includeFontPadding: false, fontVariant: ['tabular-nums'] },
  numTextSm: { fontSize: moderateScale(17), lineHeight: moderateScale(22) },
  numTextLg: { fontSize: moderateScale(25), lineHeight: moderateScale(31) },
  sym: { fontSize: moderateScale(22), lineHeight: moderateScale(28), fontWeight: '800', color: Ink.text, marginHorizontal: moderateScale(5) },
  face: { position: 'absolute', top: 0, borderBottomWidth: Shape.lip, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  faceText: { fontSize: Math.max(13, moderateScale(14)), fontWeight: '800', fontVariant: ['tabular-nums'] },
  hopBand: { position: 'absolute', top: 2, height: HOP_LANE - 4, borderRadius: (HOP_LANE - 4) / 2, backgroundColor: Quantity.violet.light, alignItems: 'center', justifyContent: 'center' },
  hopText: { fontSize: 24, lineHeight: 30, fontWeight: '800', textAlign: 'center', color: Ink.text, fontVariant: ['tabular-nums'] },
  arcLabel: { position: 'absolute', top: -moderateScale(4), width: 44, alignItems: 'center' },
  arcText: { minHeight: 28, lineHeight: 28, textAlign: 'center', fontSize: 20, fontWeight: '800', color: Ink.text, fontVariant: ['tabular-nums'] },
  // Balance
  load: { alignItems: 'center', gap: moderateScale(4), paddingBottom: 2 },
  // Equation board
  eqPan: { alignItems: 'center', gap: moderateScale(4), paddingBottom: 2 },
  xTile: { minWidth: moderateScale(40), height: moderateScale(36), paddingHorizontal: 4, borderRadius: Shape.tile(36), backgroundColor: teal.fill, borderBottomWidth: Shape.lip, borderBottomColor: teal.edge, alignItems: 'center', justifyContent: 'center' },
  xText: { fontSize: moderateScale(22), fontWeight: '800', color: teal.onFill },
  units: { maxWidth: moderateScale(5 * 32 + 4 * 4 + 10), padding: 3 },
  unitLeaving: { backgroundColor: PuzzleColors.selectedSurface, borderBottomColor: PuzzleColors.primary },
  unit: { width: moderateScale(32), height: moderateScale(32), borderRadius: Shape.tile(32), backgroundColor: amber.fill, borderBottomWidth: Shape.lip, borderBottomColor: amber.edge, alignItems: 'center', justifyContent: 'center' },
  unitText: { fontSize: moderateScale(18), fontWeight: '800', color: amber.onFill },
  shareGroup: { padding: 2, borderRadius: 8, backgroundColor: teal.soft },
  eqLine: { fontSize: moderateScale(22), lineHeight: moderateScale(30), fontWeight: '800', color: Ink.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  // Estimate
  estimate: { alignSelf: 'stretch', gap: moderateScale(18) },
  upperTickLabel: { top: -moderateScale(25) },
  axisLabel: { position: 'absolute', top: 10, width: 42, textAlign: 'center', color: Ink.text, fontWeight: '700' },
  railLine: { position: 'absolute', top: moderateScale(20), height: 10, backgroundColor: teal.light, borderRadius: 5 },
  claimRail: { position: 'absolute', height: 12, borderRadius: 6, backgroundColor: teal.fill },
  claimTick: { position: 'absolute', width: 10, height: 18, borderRadius: 5, backgroundColor: teal.fill },
  claimZone: { position: 'absolute', height: 36, borderRadius: 18, backgroundColor: amber.light },
  claimDot: { position: 'absolute', width: 28, height: 31 },
  railTick: { position: 'absolute', top: moderateScale(16), width: Shape.stroke.active, backgroundColor: Ink.line, alignItems: 'center', overflow: 'visible' },
  // Pairs
  traveller: { position: 'absolute', top: 0, left: 0 },
  // Fix mistake
  claimCard: { alignSelf: 'stretch', alignItems: 'center', gap: moderateScale(6), padding: moderateScale(12), borderRadius: Shape.tray(120), backgroundColor: Ink.tray },
  compactClaim: { gap: 2, padding: 4 },
  compactClaimText: { alignSelf: 'stretch', fontSize: 21, lineHeight: 27 },
  signature: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: moderateScale(6) },
  signatureText: { fontSize: Math.max(15, moderateScale(15)), fontWeight: '700', color: Ink.soft },
  columns: { alignItems: 'flex-end', gap: 3 },
  colRow: { flexDirection: 'row', gap: 4 },
  colCell: { width: DIGIT, minHeight: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  colActive: { backgroundColor: teal.soft },
  opCell: { width: moderateScale(30), alignItems: 'center', justifyContent: 'center' },
  columnOperator: { fontSize: moderateScale(28), lineHeight: moderateScale(36), fontWeight: '800', color: Ink.text },
  digitFace: { width: DIGIT, height: DIGIT, borderRadius: Shape.tile(DIGIT), alignItems: 'center', justifyContent: 'center', },
  digit: { fontSize: moderateScale(24), lineHeight: moderateScale(30), fontWeight: '800', color: Ink.text, fontVariant: ['tabular-nums'] },
  carry: { minWidth: moderateScale(22), height: moderateScale(20), borderRadius: 6, backgroundColor: teal.fill, borderBottomWidth: Shape.lip, borderBottomColor: teal.edge, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  carryText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  colRule: { alignSelf: 'stretch', height: 6, backgroundColor: '#E3F4F7', borderRadius: 3 },
  factRows: { alignItems: 'center', gap: moderateScale(6) },
  pinText: { fontSize: 20, fontWeight: '800', color: Ink.text, fontVariant: ['tabular-nums'] },
  // Pattern
  patternBox: { alignSelf: 'center' },
  // Route
  routeCell: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  routeText: { alignSelf: 'stretch', fontSize: moderateScale(28), lineHeight: moderateScale(34), fontWeight: '800', color: Ink.text, textAlign: 'center', includeFontPadding: false, fontVariant: ['tabular-nums'] },
  // Build
  productArray: { padding: 6, gap: 3, borderRadius: 7, backgroundColor: teal.soft },
  arrayRow: { flexDirection: 'row', gap: 3 },
  arrayUnit: { borderRadius: 5, borderBottomWidth: Shape.lip, borderBottomColor: teal.edge, backgroundColor: teal.fill },
  // Claim
  claim: { fontSize: moderateScale(28), lineHeight: moderateScale(36), fontWeight: '800', color: Ink.text, fontVariant: ['tabular-nums'], textAlign: 'center' },
  claimModel: { alignSelf: 'stretch', minHeight: moderateScale(80), justifyContent: 'center' },
  stop: { position: 'absolute', top: -moderateScale(4), width: moderateScale(52), alignItems: 'center' },
});
