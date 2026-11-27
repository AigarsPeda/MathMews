/**
 * A worked check of an addition or subtraction claim on an open number line,
 * derived from the statement itself ("64 − 23 = 42"): start at 64, hop the
 * tens (−20 → 44), then the ones (−3 → 41), one beat per hop. The running
 * landing value is written as each hop lands; once settled, the result is
 * compared with the claimed answer ("41 ≠ 42").
 */
import { Caption, Focus } from '@/components/puzzle/kit/Focus';
import { ResultMark } from '@/components/puzzle/kit/PuzzleKit';
import { RevealSurface } from '@/components/puzzle/kit/RevealSurface';
import { useRevealBeats, type RevealBeats } from '@/components/puzzle/kit/useRevealBeats';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';
import { Land } from '@/components/puzzle/tiles/TileMotion';
import { Ink, Motion, PuzzleColors, Quantity } from '@/constants/puzzle-theme';
import { moderateScale } from '@/utils/scale';
import { Canvas, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, useDerivedValue } from 'react-native-reanimated';

export type OpenLinePlan = { start: number; hops: number[]; result: number; claimed: number; text: string };

/** "64 − 23 = 42" → start 64, hops [−20, −3]; null for anything that is not whole-number + or −. */
export function openLinePlan(statement: string): OpenLinePlan | null {
  const m = /^\s*(\d+)\s*([+−-])\s*(\d+)\s*=\s*(-?\d+)\s*$/.exec(statement);
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[3]), claimed = Number(m[4]), sign = m[2] === '+' ? 1 : -1;
  if (b === 0 || a > 999 || b > 999) return null;
  const tens = b - (b % 10), ones = b % 10;
  const hops = [tens, ones].filter(Boolean).map(n => sign * n);
  return { start: a, hops, result: a + sign * b, claimed, text: `${a} ${sign > 0 ? '+' : '−'} ${b}` };
}

const ARC = moderateScale(40);
const LINE_Y = ARC + moderateScale(6);
const H = LINE_Y + moderateScale(34);
const MIN_SEG = moderateScale(64);
const fmt = (n: number) => n > 0 ? `+${n}` : `−${Math.abs(n)}`;

function Hop({ path, index, beats }: { path: SkPath; index: number; beats: RevealBeats }) {
  const end = useDerivedValue(() => Math.min(1, Math.max(0, beats.position.value - index)), [index]);
  return <Path path={path} style="stroke" strokeCap="round" strokeWidth={8} color={Quantity.violet.fill} start={0} end={end} />;
}

/** Renders nothing for a claim that is not whole-number addition or subtraction. */
export function OpenLineCheck({ statement }: { statement: string }) {
  const plan = useMemo(() => openLinePlan(statement), [statement]);
  return plan ? <OpenLineWork plan={plan} /> : null;
}

function OpenLineWork({ plan }: { plan: OpenLinePlan }) {
  const beats = useRevealBeats(plan.hops.length);
  const [width, setWidth] = useState(0);
  const stops = useMemo(() => plan.hops.reduce<number[]>((acc, h) => [...acc, acc[acc.length - 1] + h], [plan.start]), [plan]);
  // An open line: hops keep their order and direction; a short hop still gets room for its label.
  const xs = useMemo(() => {
    if (width <= 0) return [];
    const pad = moderateScale(26);
    const lengths = plan.hops.map(h => Math.abs(h));
    const total = lengths.reduce((a, b) => a + b, 0) || 1;
    const usable = width - pad * 2;
    const raw = lengths.map(l => Math.max(MIN_SEG, usable * l / total));
    const k = usable / raw.reduce((a, b) => a + b, 0);
    const segs = raw.map(r => r * k);
    const right = plan.hops[0] > 0;
    const out = [right ? pad : width - pad];
    segs.forEach(s => out.push(out[out.length - 1] + (right ? s : -s)));
    return out;
  }, [width, plan]);
  const arcs = useMemo(() => xs.slice(1).map((x, i) => {
    const a = xs[i], p = Skia.Path.Make();
    p.moveTo(a, LINE_Y - 2); p.quadTo((a + x) / 2, LINE_Y - ARC * 1.6, x, LINE_Y - 2);
    return p;
  }), [xs]);
  const matches = plan.result === plan.claimed;
  return <RevealSurface beats={beats}>
    <View style={styles.wrap}>
      <View style={{ height: H }} onLayout={e => setWidth(e.nativeEvent.layout.width)} accessible accessibilityLabel={`${plan.text} = ${plan.result}`}>
        {xs.length ? <>
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <Path path={(() => { const p = Skia.Path.Make(); p.moveTo(6, LINE_Y); p.lineTo(width - 6, LINE_Y); return p; })()} style="stroke" strokeWidth={12} color={Quantity.teal.light} strokeCap="round" />
            {arcs.map((arc, i) => <Hop key={i} path={arc} index={i} beats={beats} />)}
          </Canvas>
          {stops.map((v, i) => {
            const shown = i === 0 || beats.landed >= i;
            // Position on a plain view; the landing animation only moves what is inside it.
            return shown ? <View key={`${i}-${beats.runId}`} pointerEvents="none" style={[styles.stop, { left: xs[i] - moderateScale(26), top: LINE_Y - moderateScale(5) }]}>
              <Land skip={i === 0} style={styles.stopInner}>
                <View style={[styles.tick, i === stops.length - 1 && beats.settled && styles.tickEnd]} />
                <Focus active={beats.landed === i && i > 0}><Text style={styles.value}>{v}</Text></Focus>
              </Land>
            </View> : null;
          })}
          {plan.hops.map((h, i) => beats.landed > i
            ? <View key={`h${i}-${beats.runId}`} pointerEvents="none" style={[styles.hopLabel, { left: (xs[i] + xs[i + 1]) / 2 - moderateScale(26), top: 0 }]}><Land><Text style={styles.hopText}>{fmt(h)}</Text></Land></View>
            : null)}
        </> : null}
      </View>
      <View style={styles.result}>
        {beats.settled ? <Animated.View entering={FadeIn.duration(Motion.settle).reduceMotion(ReduceMotion.System)} style={styles.resultRow}>
          <Caption strong>{`${plan.text} = ${plan.result}`}</Caption>
          <Caption strong>{`${plan.result} ${matches ? '=' : '≠'} ${plan.claimed}`}</Caption>
          <ResultMark kind={matches ? 'correct' : 'wrong'} size={moderateScale(18)} />
        </Animated.View> : null}
      </View>
    </View>
  </RevealSurface>;
}

const styles = StyleSheet.create({
  wrap: { gap: moderateScale(4) },
  stop: { position: 'absolute', width: moderateScale(52), alignItems: 'center', gap: moderateScale(2) },
  stopInner: { alignItems: 'center', gap: moderateScale(2) },
  tick: { width: 8, height: 18, backgroundColor: Quantity.teal.fill, borderRadius: 4 },
  tickEnd: { backgroundColor: Quantity.teal.fill },
  value: { fontSize: moderateScale(16), lineHeight: moderateScale(20), fontWeight: '800', color: Ink.text, fontVariant: ['tabular-nums'] },
  hopLabel: { position: 'absolute', width: moderateScale(52), alignItems: 'center' },
  hopText: { fontSize: moderateScale(15), lineHeight: moderateScale(20), fontWeight: '800', color: Quantity.teal.edge, backgroundColor: PuzzleColors.background,
    paddingHorizontal: 3, borderRadius: 4, overflow: 'hidden', fontVariant: ['tabular-nums'] },
  result: { minHeight: moderateScale(26), alignItems: 'center', justifyContent: 'center' },
  resultRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: moderateScale(14) },
});
