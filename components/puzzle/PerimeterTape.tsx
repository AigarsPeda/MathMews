import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { Quantity } from '@/constants/puzzle-theme';
import { PuzzleText as Text } from '@/components/puzzle/PuzzleText';

/** One labelled segment of an unrolled perimeter tape. A piece with a `side` lifts off that side of the shape. */
export type TapePiece = { units: number; label: string; hue: 'teal' | 'violet' | 'amber'; side?: number };
export type TapeSpec = {
  key: string;
  /** Top-left of the shape inside the stage, and its painted size in points. */
  rect?: { x: number; y: number };
  box: { width: number; height: number };
  sides: [number, number, number, number];
  pieces: TapePiece[];
  /** Distance walked along the perimeter, in units: side i has lifted off once it passes the end of side i. */
  distance: SharedValue<number>;
  /** Missing-side proof only: 0 to 1 folds the repeated half onto the first half. */
  fold?: SharedValue<number>;
};

// 32 pt bars so the side lengths inside them read at 20 pt.
export const TAPE_BAR = 32;
export const TAPE_GAP = 4;
const AMBER_MIN = 44;
// Every segment keeps room for its 20 pt digit, so a 1-unit side is never a sliver.
const SEG_MIN = 32;
const PAD = 8;

/** Picture help draws the tape with bigger chips: 44 pt bars with 28 pt digits. */
export const HELP_TAPE_BAR = 44;

export function tapeLaneHeight(rows: number, bar = TAPE_BAR) {
  return PAD + rows * bar + (rows - 1) * TAPE_GAP + 4;
}

const minWidth = (p: TapePiece) => p.hue === 'amber' ? AMBER_MIN : SEG_MIN;

/** One scale for every tape so the longer one is visibly longer. A short segment keeps its minimum width, so the rest gives way. */
function tapeScale(tapes: TapeSpec[], unit: number, available: number) {
  let scale = unit;
  for (const t of tapes) {
    const room = available - 2 * PAD - (t.pieces.length - 1) * TAPE_GAP;
    let s = Math.min(unit, room / Math.max(1, t.pieces.reduce((a, p) => a + p.units, 0)));
    for (let pass = 0; pass < t.pieces.length; pass++) {
      const small = t.pieces.filter(p => p.units * s < minWidth(p));
      const rest = t.pieces.reduce((a, p) => a + (small.includes(p) ? 0 : p.units), 0);
      const next = (room - small.reduce((a, p) => a + minWidth(p), 0)) / Math.max(1, rest);
      if (next >= s - .01) break;
      s = next;
    }
    scale = Math.min(scale, s);
  }
  return Math.max(2, scale);
}

type Geometry = {
  start: number; count: number; cx0: number; cy0: number; len0: number; angle0: number;
  cx1: number; cy1: number; len1: number; foldDx?: number;
};

function Bar({ g, distance, fold, label, hue, shown, bar }: { bar: number; g: Geometry; distance: SharedValue<number>; fold?: SharedValue<number>; label: string; hue: TapePiece['hue']; shown: boolean }) {
  const lift = useDerivedValue(() => g.count ? Math.min(1, Math.max(0, (distance.value - g.start) / g.count)) : 1);
  const style = useAnimatedStyle(() => {
    const t = lift.value;
    const q = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const f = fold && g.foldDx !== undefined ? Math.min(1, Math.max(0, fold.value)) : 0;
    const cx = g.cx0 + (g.cx1 + (g.foldDx ?? 0) * f - g.cx0) * q;
    const cy = g.cy0 + (g.cy1 - g.cy0) * q;
    const len = g.len0 + (g.len1 - g.len0) * q;
    return { opacity: t > 0 ? 1 : 0, left: cx - len / 2, top: cy - bar / 2, width: len, transform: [{ rotate: `${g.angle0 * (1 - q)}deg` }] };
  });
  const colors = Quantity[hue];
  const big = bar > TAPE_BAR;
  return <Animated.View style={[styles.bar, { backgroundColor: colors.fill, height: bar, borderRadius: bar / 2 }, style]}>
    {shown && <Text allowFontScaling={false} numberOfLines={1} style={[styles.label, { color: colors.onFill }, big && styles.bigLabel]}>{label}</Text>}
  </Animated.View>;
}

/** Solid bars lift off the sides of each shape and slide into ONE straight, labelled tape in the reserved lane. */
export function TapeBars({ tapes, unit, available, laneY, bar = TAPE_BAR }: { tapes: TapeSpec[]; unit: number; available: number; laneY: number | null; bar?: number }) {
  if (laneY == null || tapes.some(t => !t.rect)) return null;
  const tu = tapeScale(tapes, unit, available);
  const width = (p: TapePiece) => Math.max(minWidth(p), p.units * tu);
  const widest = Math.max(...tapes.map(t => t.pieces.reduce((a, p) => a + width(p), 0) + (t.pieces.length - 1) * TAPE_GAP));
  const x0 = Math.max(0, (available - widest) / 2);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {tapes.map((tape, row) => {
      const { x, y } = tape.rect!, { width: bw, height: bh } = tape.box;
      const cy1 = laneY + PAD + row * (bar + TAPE_GAP) + bar / 2;
      let cursor = x0;
      const placed = tape.pieces.map(p => { const len = width(p), cx = cursor + len / 2; cursor += len + TAPE_GAP; return { len, cx }; });
      return tape.pieces.map((p, i) => {
        const side = p.side;
        const sideUnits = side == null ? 0 : tape.sides[side];
        const start = side == null ? 0 : tape.sides.slice(0, side).reduce((a, b) => a + b, 0);
        // Start flush inside its own side of the shape, then lift and line up.
        const len0 = sideUnits * unit;
        const starts = [
          { cx: x + len0 / 2, cy: y + bar / 2, a: 0 },
          { cx: x + bw - bar / 2, cy: y + len0 / 2, a: 90 },
          { cx: x + len0 / 2, cy: y + bh - bar / 2, a: 0 },
          { cx: x + bar / 2, cy: y + len0 / 2, a: 90 },
        ];
        const s = side == null ? undefined : starts[side];
        const g: Geometry = {
          start, count: sideUnits, cx0: s?.cx ?? placed[i].cx, cy0: s?.cy ?? cy1, len0: side == null ? placed[i].len : len0, angle0: s?.a ?? 0,
          cx1: placed[i].cx, cy1, len1: placed[i].len,
          foldDx: tape.fold && i >= 2 && i < 4 && tape.pieces.length === 4 ? placed[i - 2].cx - placed[i].cx : undefined,
        };
        return <Bar bar={bar} key={`${tape.key}-${i}`} g={g} distance={tape.distance} fold={tape.fold} label={p.label} hue={p.hue} shown={placed[i].len >= (p.label.length > 1 ? 40 : 26)} />;
      });
    })}
  </View>;
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', height: TAPE_BAR, borderRadius: TAPE_BAR / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  label: { fontSize: 20, lineHeight: 24, fontWeight: '800' },
  bigLabel: { fontSize: 28, lineHeight: 34 },
});
