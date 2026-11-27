import { BalanceScale, type PanAction } from '@/components/puzzle/BalanceScale';
import { useRevealBeats } from '@/components/puzzle/kit/useRevealBeats';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { Ink, Motion, Quantity, Shape, Radius } from '@/constants/puzzle-theme';
import { equationText, type EquationState } from '@/utils/bridge-models';
import { moderateScale } from '@/utils/scale';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

/** Up to this many unit tiles are drawn; larger amounts are printed. */
const MAX_TILES = 20;
/** One row per tray: unit tiles shrink to fit the tray's width (at least MIN_UNIT, at most MAX_UNIT). */
const MAX_UNIT = moderateScale(34);
const MIN_UNIT = 28;
const X_SIZE = moderateScale(40);
const SIGN_W = moderateScale(16);
const GAP = 4;
const unitSize = (count: number, room: number) => room <= 0 || count <= 0 ? moderateScale(28) : Math.max(MIN_UNIT, Math.min(MAX_UNIT, Math.floor((room - (count - 1) * GAP) / count)));

type Change = { kept: number; gone: number; added: number };
const change = (from: number, to: number): Change => ({ kept: Math.min(from, to), gone: Math.max(0, from - to), added: Math.max(0, to - from) });

/**
 * One tile, in one of three states: present, leaving (fades to a ghost on the
 * first beat) or arriving (fades in on the second beat).
 */
function Tile({ kind, phase, progress, landed, solved, size, value = 1, width = size }: { kind: 'x' | 'unit'; phase: 'stay' | 'gone' | 'added'; progress: SharedValue<number>; landed: number; solved?: boolean; size: number; value?: number; width?: number }) {
  const { fontScale } = useWindowDimensions();
  const motion = useAnimatedStyle(() => {
    if (phase === 'gone') return { opacity: landed >= 1 ? .3 : 1 - .7 * progress.value };
    if (phase === 'added') return { opacity: landed >= 2 ? 1 : landed === 1 ? progress.value : 0, transform: [{ scale: landed >= 2 ? 1 : .6 + .4 * (landed === 1 ? progress.value : 0) }] };
    return { opacity: 1 };
  });
  return <Animated.View style={[kind === 'x' ? styles.xTile : [styles.unit, { width, height: size }], kind === 'x' && solved && styles.xSolved, phase === 'gone' && styles.ghost, motion]}>
    {(kind === 'x' || value === 5 || fontScale <= 1.35) && <Text style={kind === 'x' ? styles.x : [styles.unitLabel, size < moderateScale(33) && styles.unitLabelSmall]}>{kind === 'x' ? 'x' : value}</Text>}
  </Animated.View>;
}

function Tiles({ kind, c, progress, landed, solved, size, room }: { kind: 'x' | 'unit'; c: Change; progress: SharedValue<number>; landed: number; solved?: boolean; size: number; room?: number }) {
  const tiles: { phase: 'stay' | 'gone' | 'added'; value: number }[] = [];
  const count = c.kept + c.gone + c.added;
  const group = room !== undefined && count * size + (count - 1) * GAP > room;
  for (const [phase, amount] of [['stay', c.kept], ['gone', c.gone], ['added', c.added]] as const) {
    let remaining = amount;
    while (remaining > 0) {
      const value = group && remaining >= 5 ? 5 : 1;
      tiles.push({ phase, value });
      remaining -= value;
    }
  }
  const row = <View style={kind === 'x' ? styles.xRow : styles.units}>
    {tiles.map(({ phase, value }, i) => <Tile key={`${phase}-${i}`} kind={kind} phase={phase} value={value}
      progress={progress} landed={landed} solved={solved} size={size} width={value * size} />)}
  </View>;
  if (room && room > 0 && count * size + (tiles.length - 1) * GAP > room) {
    // Never hide tiles behind a scroll: scale the whole row down to fit the tray.
    const need = count * size + (tiles.length - 1) * GAP;
    return <View style={{ width: room, alignItems: 'center' }}><View style={{ width: need, transform: [{ scale: room / need }] }}>{row}</View></View>;
  }
  return row;
}

/** Units drawn in rows of five, or printed when there are too many to count. */
function Units({ from, to, progress, landed, sign, numeral, size, room }: { from: number; to: number; progress: SharedValue<number>; landed: number; sign?: string; numeral?: boolean; size: number; room: number }) {
  const { fontScale } = useWindowDimensions();
  // A proof at large type prints the amount: the short viewport has no room for a pack of tiles under it.
  if (numeral || Math.max(from, to) > MAX_TILES) return <Text style={styles.number}>{sign}{landed >= 2 ? to : from}</Text>;
  if (from === 0 && to === 0) return null;
  return <View style={[styles.signed, fontScale > 1.35 && styles.stackedUnits]}>
    {fontScale > 1.35 ? <Text style={styles.sign}>{sign}{landed >= 2 ? to : from}</Text> : sign ? <Text style={styles.sign}>{sign}</Text> : null}
    <Tiles kind="unit" room={room} c={change(from, to)} progress={progress} landed={landed} size={size} />
  </View>;
}

/**
 * Algebra tiles on the shared balance. Every action is done to both trays at
 * once: removed tiles fade to ghosts together, then the new equation lands
 * and both trays settle. Once x is on its own (and the tiles have finished
 * moving) the x tile takes the solved style and `readyText` is shown.
 */
export type DrivenMove = { from: EquationState; to: EquationState; landed: number; progress: SharedValue<number> };

export function EquationBoardModel({ equation, readyText, pan, imbalance, lean = true, driven }: { equation: EquationState; readyText?: string; pan?: PanAction;
  /** A missed attempt on this same scale: once `lean` is set the beam leans toward the extra tiles that keep x from being alone, inside one amber zone. */
  imbalance?: boolean; lean?: boolean;
  /** A proof plays the child's moves with its own clock (from, to, landed, progress) instead of the board's own. */
  driven?: DrivenMove }) {
  const { fontScale } = useWindowDimensions();
  const [modelWidth, setModelWidth] = useState(0);
  const [from, setFrom] = useState(equation);
  const [to, setTo] = useState(equation);
  const own = useRevealBeats(driven ? null : from === to ? 0 : 2, { minTotal: 0, onDone: () => setFrom(current => current === to ? current : to) });
  const { replay } = own;
  const beats = driven ? { ...own, progress: driven.progress, landed: driven.landed, done: false } : own;
  const latest = useRef(equation);
  useEffect(() => {
    if (driven) return;
    const previous = latest.current;
    if (previous.a === equation.a && previous.b === equation.b && previous.c === equation.c) return;
    latest.current = equation;
    setFrom(to);
    setTo(equation);
    replay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equation]);
  const tight = !!driven && fontScale > 1.35;
  const [fromEq, toEq] = driven ? [driven.from, driven.to] : [from, to];
  const moving = fromEq !== toEq && !beats.done;
  const landed = moving ? beats.landed : 2;
  const shown = landed >= 2 ? toEq : fromEq;
  // x is solved only after the removed tiles have finished leaving.
  const isolated = !moving && toEq.a === 1 && toEq.b === 0;
  const xs = moving ? change(fromEq.a, toEq.a) : change(toEq.a, toEq.a);
  const leftSign = (moving ? (toEq.b || fromEq.b) : toEq.b) < 0 ? '−' : '+';
  const leftUnits = moving ? [Math.abs(fromEq.b), Math.abs(toEq.b)] : [Math.abs(toEq.b), Math.abs(toEq.b)];
  const rightUnits = moving ? [fromEq.c, toEq.c] : [toEq.c, toEq.c];
  const showLeftUnits = leftUnits[0] > 0 || leftUnits[1] > 0;
  // The extras are the unit tiles beside x (or, with several x tiles, the x tiles themselves).
  const leaning = !!imbalance && lean && !moving && !isolated;
  const tilt = useSharedValue(0);
  const target = leaning ? -4 : 0;
  useEffect(() => { tilt.set(withTiming(target, { duration: Motion.settle, easing: Easing.out(Easing.cubic) })); }, [target, tilt]);
  const zone = (on: boolean) => on ? styles.extraZone : imbalance ? styles.extraZoneIdle : null;
  // Tile size: the busiest state of this move on either tray, fitted to one row of the measured tray.
  const xCount = Math.max(1, fromEq.a, toEq.a);
  const unitCount = (a: number, b: number) => Math.max(a, b);
  const leftCount = unitCount(Math.abs(fromEq.b), Math.abs(toEq.b));
  const rightCount = unitCount(Math.max(0, fromEq.c), Math.max(0, toEq.c));
  const xBlock = xCount * X_SIZE + (xCount - 1) * 4;
  const available = Math.max(0, modelWidth - 16 - GAP);
  const rowWidth = (count: number) => count * MIN_UNIT + Math.max(0, count - 1) * GAP;
  const rightGroups = Math.floor(rightCount / 5);
  const groupedWidth = rowWidth(rightCount) - rightGroups * 4 * GAP;
  const leftMinimum = Math.max(xBlock, rowWidth(leftCount));
  const rightWidth = Math.min(Math.max(available / 2, groupedWidth), Math.max(available / 2, available - leftMinimum));
  const leftWidth = available - rightWidth;
  const signRoom = leftCount ? SIGN_W + 2 * GAP : 0;
  const stackLeft = !tight && leftCount > 0 && xBlock + signRoom + rowWidth(leftCount) > leftWidth;
  // Stacked: the tray itself means "added", so no floating "+"; a "−" stays in front of the units row.
  const stackedMinus = stackLeft && leftSign === '−';
  const leftRoom = stackLeft ? leftWidth - (stackedMinus ? signRoom : 0) : leftWidth - xBlock - signRoom;
  const size = Math.min(unitSize(leftCount, leftRoom), unitSize(rightCount, rightWidth));
  const unitsExtra = leaning && toEq.b > 0, xExtra = leaning && toEq.b <= 0 && toEq.a > 1;
  const left = <View style={[styles.side, stackLeft && styles.stackedUnits]}>
    <View style={styles.xRow}><View style={zone(xExtra)}><Tiles kind="x" c={xs} progress={beats.progress} landed={landed} solved={isolated} size={X_SIZE} /></View></View>
    {showLeftUnits ? <View style={zone(unitsExtra)}><Units from={leftUnits[0]} to={leftUnits[1]} progress={beats.progress} landed={landed} room={leftRoom} sign={stackLeft && !stackedMinus ? undefined : leftSign} numeral={tight} size={size} /></View> : null}
  </View>;
  const right = <View style={styles.side}>
    {rightUnits[0] < 0 || rightUnits[1] < 0 ? <Text style={styles.number}>{landed >= 2 ? toEq.c : fromEq.c}</Text>
      : <Units from={rightUnits[0]} to={rightUnits[1]} room={rightWidth} progress={beats.progress} landed={landed} numeral={tight} size={size} />}
  </View>;
  return <View style={styles.model} onLayout={event => setModelWidth(event.nativeEvent.layout.width)}>
    {/* Large type: a proof leaves the equation to its own caption and chip so the scale keeps its room. */}
    {driven && fontScale > 1.35 ? null : <View testID="bridge-equation" accessible accessibilityLabel={equationText(shown)} accessibilityLiveRegion="polite">
      <Text style={styles.equation}>{equationText(shown)}</Text>
    </View>}
    <BalanceScale wide rightWidth={rightWidth || undefined} gap={GAP} tilt={imbalance ? tilt : undefined} proofFocus={driven ? .5 : undefined} leftAction={pan} rightAction={pan} left={left} right={right} leftBump={moving ? null : shown} rightBump={moving ? null : shown} />
    {readyText && isolated ? <Animated.View entering={FadeIn.duration(Motion.settle).reduceMotion(ReduceMotion.System)}>
      <Text testID="bridge-equation-ready" accessibilityLiveRegion="polite" style={styles.ready}>{readyText}</Text>
    </Animated.View> : null}
  </View>;
}

const styles = StyleSheet.create({
  model: { gap: moderateScale(6), alignSelf: 'stretch' },
  equation: { fontSize: moderateScale(26), lineHeight: moderateScale(34), fontWeight: '800', textAlign: 'center', color: Ink.text, fontVariant: ['tabular-nums'] },
  side: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: moderateScale(4) },
  // One soft amber zone on the extra tiles. The idle style holds the same padding so nothing shifts when it appears.
  extraZone: { padding: 4, margin: -4, borderRadius: 14, backgroundColor: Quantity.amber.light },
  extraZoneIdle: { padding: 4, margin: -4, borderRadius: 14 },
  signed: { flexDirection: 'row', alignItems: 'center', gap: moderateScale(4) },
  sign: { width: SIGN_W, textAlign: 'center', fontSize: moderateScale(18), lineHeight: moderateScale(20), fontWeight: '800', color: Ink.text },
  stackedUnits: { flexDirection: 'column' },
  xRow: { flexDirection: 'row', justifyContent: 'center', gap: moderateScale(4) },
  xTile: { minWidth: X_SIZE, minHeight: X_SIZE, paddingHorizontal: 3, borderRadius: Radius.piece, 
    backgroundColor: Quantity.teal.fill, alignItems: 'center', justifyContent: 'center' },
  xSolved: { backgroundColor: Quantity.violet.fill },
  ready: { fontSize: moderateScale(18), lineHeight: moderateScale(25), fontWeight: '700', color: Ink.text, textAlign: 'center', paddingTop: moderateScale(4) },
  x: { fontSize: moderateScale(22), lineHeight: moderateScale(28), fontWeight: '800', fontStyle: 'italic', color: Ink.text },
  // Units: solid squares in ONE row per tray (sized to the tray).
  units: { flexDirection: 'row', justifyContent: 'center', gap: GAP },
  unit: { borderRadius: Shape.tile(24), backgroundColor: Quantity.amber.fill, alignItems: 'center', justifyContent: 'center' },
  unitLabel: { fontSize: moderateScale(18), lineHeight: moderateScale(22), fontWeight: '800', color: Ink.text },
  unitLabelSmall: { fontSize: Math.max(16, moderateScale(16)), lineHeight: moderateScale(20) },
  ghost: { backgroundColor: Shape.empty },
  number: { fontSize: moderateScale(26), lineHeight: moderateScale(34), fontWeight: '800', color: Ink.text, fontVariant: ['tabular-nums'] },
});
