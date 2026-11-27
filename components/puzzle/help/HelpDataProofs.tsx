import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Quantity, Shape } from '@/constants/puzzle-theme';
import { estimatePlan } from '@/utils/operations-reveal';
import type { EstimatePuzzle } from '@/types/puzzle';
import { barAnswer, groupLetter, type BarModel } from '@/utils/puzzle-bars';
import { planMoneyTape } from '@/utils/money-tape';
import { formatPriceTicket, type MoneyModel } from '@/utils/puzzle-money';
import { RevealSurface } from '../kit/RevealSurface';
import { beatProgress, Digit, Piece, ProofLine, useHelpBeats, useHelpCaption, type Hue } from './helpKit';

type Stage = { height: number; onSolutionShown: () => void };
const { teal, violet, amber } = Quantity;
const GAP = Shape.space.seam;
const PALE = { fill: Shape.empty, edge: Shape.emptyLip };

/** A piece that stays in place and lights up (pale to its colour) when its beat lands. Its label is drawn by the caller. */
function Lit({ hue, at, position, width, height, children }: {
  hue: Hue; at: number; position: SharedValue<number>; width: number; height: number; children?: ReactNode;
}) {
  const light = useAnimatedStyle(() => ({ opacity: beatProgress(position.value, at) }));
  return <View style={{ width, height }}>
    <Piece hue={PALE} width={width} height={height} />
    <Animated.View style={[StyleSheet.absoluteFill, light]}><Piece hue={hue} width={width} height={height} /></Animated.View>
    <View style={[StyleSheet.absoluteFill, styles.center, { paddingBottom: Shape.lip }]}>{children}</View>
  </View>;
}

/** Widths of parts that share `avail` in proportion to `values`, the last taking the rounding. */
function share(values: number[], avail: number) {
  const total = values.reduce((sum, v) => sum + v, 0);
  const widths = values.map(v => Math.floor(avail * v / total));
  widths[widths.length - 1] += avail - widths.reduce((sum, w) => sum + w, 0);
  return widths;
}

const MISSING_BAND = 60, MISSING_ROW = 108;

/** One row of parts under the whole: the known parts light up one by one, then the missing part fills in place. */
export function HelpMissingBars({ model, height, onSolutionShown }: Stage & { model: BarModel }) {
  const [width, setWidth] = useState(0);
  const total = model.total!, missing = model.index, count = model.values.length;
  const beats = useHelpBeats(count, onSolutionShown, 800, 450, 700);
  const known = model.values.map((v, i) => i === missing ? null : v);
  const order = (i: number) => i === missing ? count : known.slice(0, i).filter(v => v !== null).length + 1;
  const done = known.filter((v): v is number => v !== null).slice(0, Math.min(beats.landed, count - 1));
  const caption = beats.settled || !done.length ? null : [total, ...done].join(' − ');
  const sheetCaption = useHelpCaption(caption);
  const widths = share(model.values, Math.max(0, width - GAP * (count - 1)));
  return <RevealSurface beats={beats}>
    <View onLayout={e => setWidth(Math.floor(e.nativeEvent.layout.width))}
      style={[styles.stage, { height, gap: GAP * 2 }]}>
      {width > 0 && <>
        <View style={[styles.band, { width, height: MISSING_BAND, backgroundColor: teal.light }]}><Digit size={32}>{total}</Digit></View>
        <View style={{ flexDirection: 'row', gap: GAP }}>
          {model.values.map((value, i) => <Lit key={i} width={widths[i]} height={MISSING_ROW} at={order(i)} position={beats.position}
            hue={i === missing ? amber : i % 2 ? violet : teal}>
            <Digit size={24}>{groupLetter(i)}</Digit>
            <Digit size={30}>{i === missing && beats.landed < count ? '?' : value}</Digit>
          </Lit>)}
        </View>
      </>}
    </View>
    <ProofLine caption={sheetCaption ? undefined : caption ?? undefined}
      equation={beats.settled ? [total, ...known.filter((v): v is number => v !== null)].join(' − ') + ' = ' + barAnswer(model).answer : undefined} />
  </RevealSurface>;
}

const MEAN_BAND = 30;

function MeanBlock({ column, level, unit, stride, width, source, target, mean, moves, position }: {
  column: number; level: number; unit: number; stride: number; width: number; source: number; target: number;
  mean: number; moves: number; position: SharedValue<number>;
}) {
  const travelling = column === source && level >= mean;
  const beat = moves - (level - mean);
  const destinationLevel = mean - moves + beat - 1;
  const hue = travelling ? violet : teal;
  const motion = useAnimatedStyle(() => {
    const p = travelling ? beatProgress(position.value, beat) : 0;
    return { transform: [{ translateX: (target - source) * stride * p },
      { translateY: (level - destinationLevel) * unit * p - Math.sin(Math.PI * p) * unit * 1.4 }] };
  });
  return <Animated.View style={[styles.block, { left: column * stride, bottom: level * unit, width, height: unit - GAP,
    backgroundColor: hue.fill, borderBottomColor: hue.edge }, motion]} />;
}

/** Blocks move from the tallest bar to the shortest until every bar is level; one amber band then marks that level. */
export function HelpMeanBars({ model, height, onSolutionShown }: Stage & { model: BarModel }) {
  const [width, setWidth] = useState(0);
  const { values } = model;
  const { caption, answer } = barAnswer(model);
  const mean = Number(answer), source = values.indexOf(Math.max(...values)), target = values.indexOf(Math.min(...values));
  const moves = values[source] - mean;
  const beats = useHelpBeats(moves, onSolutionShown, 970, 450, 520);
  const unit = Math.min(34, Math.max(MEAN_BAND + GAP, (height - 62) / (values[source] + 1.4)));
  const stride = (width + GAP) / values.length;
  const area = Math.max((values[source] + 1.4) * unit, mean * unit + GAP + MEAN_BAND);
  return <RevealSurface beats={beats}>
    <View style={[styles.stage, { height }]} onLayout={e => setWidth(Math.floor(e.nativeEvent.layout.width))}>
      <View style={{ height: area }}>
        {width > 0 && values.flatMap((value, col) => Array.from({ length: value }, (_, level) =>
          <MeanBlock key={col + '-' + level} column={col} level={level} width={stride - GAP} stride={stride}
            unit={unit} source={source} target={target} mean={mean} moves={moves} position={beats.position} />))}
        {beats.settled && <Animated.View entering={FadeIn.duration(260)}
          style={[styles.band, styles.meanBand, { bottom: mean * unit, width, height: MEAN_BAND, backgroundColor: amber.fill }]}>
          <Digit size={26}>{mean}</Digit>
        </Animated.View>}
      </View>
      <View style={[styles.row, { gap: GAP }]}>{values.map((value, col) => <View key={col} style={{ flex: 1 }}>
        <Digit size={30}>{value + (col === target ? beats.landed : col === source ? -beats.landed : 0)}</Digit></View>)}</View>
    </View>
    <ProofLine equation={beats.settled ? caption : undefined} />
  </RevealSurface>;
}

const TAPE_BAND = 48, TAPE_HEIGHT = 88;

/** The budget over the tape, the cost over exactly the packs, and the change as the one amber part. */
export function HelpBudgetTape({ model, height, onSolutionShown }: Stage & { model: MoneyModel }) {
  const { i18n } = useTranslation();
  const [width, setWidth] = useState(0);
  const packCount = model.quantities[0];
  const tape = planMoneyTape(model, undefined, i18n.language);
  const [cost, change] = tape.segments;
  const price = model.prices[0], format = (n: number) => formatPriceTicket(n, model.unit, i18n.language);
  const beats = useHelpBeats(packCount + 1, onSolutionShown, 520, 280, 280);
  const widths = share([...Array<number>(packCount).fill(price), change.value], Math.max(0, width - GAP * packCount));
  const costWidth = widths.slice(0, packCount).reduce((sum, w) => sum + w, 0) + GAP * (packCount - 1);
  return <RevealSurface beats={beats}>
    <View onLayout={e => setWidth(Math.floor(e.nativeEvent.layout.width))} style={[styles.stage, { height, gap: GAP * 2 }]}>
      {width > 0 && <>
        <View style={[styles.band, { width, height: TAPE_BAND, backgroundColor: violet.light }]}><Digit size={30}>{format(tape.extent)}</Digit></View>
        <View style={{ height: TAPE_BAND }}>
          {beats.landed >= packCount && <Animated.View entering={FadeIn.duration(260)}
            style={[styles.band, { width: costWidth, height: TAPE_BAND, backgroundColor: teal.light }]}><Digit size={30}>{cost.label}</Digit></Animated.View>}
        </View>
        <View style={{ flexDirection: 'row', gap: GAP }}>
          {widths.map((w, i) => <Lit key={i} width={w} height={TAPE_HEIGHT} at={i + 1} position={beats.position} hue={i < packCount ? teal : amber}>
            <Digit size={30}>{i < packCount ? format(price) : beats.landed > packCount ? change.label : '?'}</Digit>
          </Lit>)}
        </View>
      </>}
    </View>
    <ProofLine equation={beats.settled ? format(tape.extent) + ' − ' + cost.label + ' = ' + change.label : undefined} />
  </RevealSurface>;
}

const EST = { inset: 28, expr: 48, pinTop: 54, pin: 44, rail: 52, railTop: 116, notchW: 16, notchH: 76, labelTop: 196, labelH: 40, pinW: 60 };

/** One thick rail between the two nearest tens: 48 sits on it, the two jumps are its two parts, the shorter jump wins. */
export function HelpEstimate({ puzzle, height, onSolutionShown }: Stage & { puzzle: EstimatePuzzle }) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const plan = estimatePlan(puzzle, puzzle.correctIndex);
  const beats = useHelpBeats(3, onSolutionShown, 850, 450, 520);
  const caption = !plan || beats.settled || !beats.landed ? null : beats.landed === 1 ? `${plan.a} + ${plan.b} = ${plan.total}`
    : beats.landed === 2 ? t('visualHelp.examples.estimate.jumps', { near: Math.min(plan.total - plan.lower, plan.upper - plan.total), far: Math.max(plan.total - plan.lower, plan.upper - plan.total) })
      : t('visualHelp.examples.estimate.wins');
  const sheetCaption = useHelpCaption(caption);
  const pinFade = useAnimatedStyle(() => {
    const p = beatProgress(beats.position.value, 1);
    return { opacity: Math.min(1, p * 3), transform: [{ translateY: (1 - p) * -14 }] };
  });
  const pick = useAnimatedStyle(() => ({ opacity: beatProgress(beats.position.value, 3) }));
  const jumps = useAnimatedStyle(() => ({ opacity: beatProgress(beats.position.value, 2) }));
  if (!plan) return null;
  const { total, lower, upper, nearest } = plan;
  const railW = Math.max(0, width - EST.inset * 2), span = upper - lower;
  const x = (v: number) => EST.inset + railW * (v - lower) / span;
  const toLower = total - lower, toUpper = upper - total, lowerWins = toLower <= toUpper;
  const parts = [{ from: lower, to: total, color: lowerWins ? teal.fill : violet.light, label: toLower }, { from: total, to: upper, color: lowerWins ? violet.light : teal.fill, label: toUpper }];
  const stageHeight = EST.labelTop + EST.labelH;
  const notch = (v: number, win: boolean) => <View key={v} style={[styles.notch, { left: x(v) - EST.notchW / 2, backgroundColor: violet.fill, borderBottomColor: violet.edge }]}>
    {win && <Animated.View style={[StyleSheet.absoluteFill, styles.notch, { left: 0, top: 0, backgroundColor: amber.fill, borderBottomColor: amber.edge }, pick]} />}
  </View>;
  return <RevealSurface beats={beats}>
    <View onLayout={e => setWidth(Math.floor(e.nativeEvent.layout.width))} style={[styles.stage, { height }]}>
      {width > 0 && <View style={{ height: stageHeight }}>
        <View style={[styles.center, { height: EST.expr }]}><Digit size={32}>{puzzle.payload.expression}</Digit></View>
        <View style={[styles.rail, { left: EST.inset, width: railW }]} />
        {parts.map((part, i) => <Animated.View key={i} style={[styles.railPart, jumps, {
          left: x(part.from) + (i ? GAP / 2 : 0), width: x(part.to) - x(part.from) - GAP / 2, backgroundColor: part.color }]}>
          <Digit size={28}>{part.label}</Digit></Animated.View>)}
        {notch(lower, lower === nearest)}{notch(upper, upper === nearest)}
        <Animated.View style={[styles.pin, { left: Math.min(width - EST.pinW, Math.max(0, x(total) - EST.pinW / 2)) }, pinFade]}>
          <Piece hue={teal} width={EST.pinW} height={EST.pin}><Digit size={28}>{total}</Digit></Piece>
          <View style={styles.nub} />
        </Animated.View>
        {[lower, upper].map(v => <View key={v} style={[styles.center, styles.tick, { left: x(v) - 30 }]}><Digit size={28}>{v}</Digit></View>)}
      </View>}
    </View>
    <ProofLine caption={sheetCaption ? undefined : caption ?? undefined} equation={beats.settled ? `${total} ≈ ${nearest}` : undefined} />
  </RevealSurface>;
}

const styles = StyleSheet.create({
  stage: { alignSelf: 'stretch', justifyContent: 'center' },
  row: { flexDirection: 'row', alignSelf: 'stretch' },
  center: { alignItems: 'center', justifyContent: 'center' },
  band: { alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  meanBand: { position: 'absolute', left: 0 },
  block: { position: 'absolute', borderRadius: 6, borderBottomWidth: Shape.lip },
  rail: { position: 'absolute', top: EST.railTop, height: EST.rail, borderRadius: 12, backgroundColor: Shape.empty },
  railPart: { position: 'absolute', top: EST.railTop, height: EST.rail, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notch: { position: 'absolute', top: EST.railTop - (EST.notchH - EST.rail) / 2, width: EST.notchW, height: EST.notchH, borderRadius: 7, borderBottomWidth: Shape.lip },
  pin: { position: 'absolute', top: EST.pinTop, alignItems: 'center' },
  nub: { width: 14, height: 14, marginTop: -9, borderRadius: 3, backgroundColor: Quantity.teal.fill, transform: [{ rotate: '45deg' }] },
  tick: { position: 'absolute', top: EST.labelTop, width: 60, height: EST.labelH },
});
