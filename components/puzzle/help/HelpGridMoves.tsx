import { PuzzleText as Text } from '../PuzzleText';
import { Piece, Slot } from './helpKit';
import { Ink, Quantity, Shape } from '@/constants/puzzle-theme';
import { gridPose, gridSteps, type GridModel } from '@/utils/puzzle-grid';
import { RoundedRect } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

/** Picture help for "move square by square": the marker steps cell to cell and every cell it reaches takes a violet tint. */
const clamp = (n: number) => { 'worklet'; return Math.max(0, Math.min(1, n)); };

/** The cell face a step lands on; the start cell is tinted from the first frame. */
function VisitedFace({ step, index, x, y, size, radius }: { step: SharedValue<number>; index: number; x: number; y: number; size: number; radius: number }) {
  const opacity = useDerivedValue(() => clamp(step.value - index + 1));
  // Per-shape alpha, not a Group opacity: a group layer needs an offscreen texture of its own.
  return <>
    <RoundedRect x={x} y={y} width={size} height={size} r={radius} color={Quantity.violet.fill} opacity={opacity} />
    <RoundedRect x={x} y={y} width={size} height={Math.max(0, size - Shape.lip)} r={radius} color={Quantity.violet.light} opacity={opacity} />
  </>;
}

/** Skia children for the board canvas: one tinted face per square on the route, drawn under the numbers. */
export function VisitedFaces({ model, step, pitch }: { model: GridModel; step: SharedValue<number>; pitch: number }) {
  const steps = gridSteps(model);
  const inset = Shape.space.seam / 2;
  const cells = useMemo(() => Array.from({ length: steps + 1 }, (_, s) => {
    const pose = gridPose(model, s);
    return { x: Math.floor(pose.x), y: Math.floor(pose.y) };
  }), [model, steps]);
  const face = pitch - 2 * inset;
  return <>{cells.map((cell, s) => <VisitedFace key={s} step={step} index={s} x={cell.x * pitch + inset} y={cell.y * pitch + inset}
    size={face} radius={Shape.tile(pitch)} />)}</>;
}

/** The moves as chips, "→ 1, → 2, ↑ 1": the lane is reserved from the first frame and each chip fills as its square is reached. */
export function moveChips(model: GridModel) {
  const across = Math.abs(model.dx), up = Math.abs(model.dy);
  return [
    ...Array.from({ length: across }, (_, i) => `${model.dx > 0 ? '→' : '←'} ${i + 1}`),
    ...Array.from({ length: up }, (_, i) => `${model.dy < 0 ? '↑' : '↓'} ${i + 1}`),
  ];
}

export const MOVE_LANE = 52;

export function MoveChips({ chips, landed }: { chips: string[]; landed: number }) {
  return <View style={styles.lane} accessible accessibilityLabel={chips.slice(0, landed).join(', ')}>
    {chips.map((chip, i) => i < landed
      ? <Piece key={i} hue={Quantity.violet} width={80} height={44}><Text maxFontSizeMultiplier={1.2} style={styles.chip}>{chip}</Text></Piece>
      : <View key={i} style={styles.waiting}>
        <Slot width={80} height={44} />
        <View style={styles.pendingText}><Text maxFontSizeMultiplier={1.2} style={[styles.chip, styles.pending]}>{chip}</Text></View>
      </View>)}
  </View>;
}

const styles = StyleSheet.create({
  lane: { height: MOVE_LANE, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  chip: { color: Ink.text, fontSize: 26, lineHeight: 32, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] },
  waiting: { width: 80, height: 44 },
  pendingText: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingBottom: 3 },
  pending: { color: Ink.soft, opacity: .55 },
});
