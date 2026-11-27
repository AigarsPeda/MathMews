import { Quantity, Shape, Stroke } from '@/constants/puzzle-theme';
import { Group, Path, Rect, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { ProofCanvas, type TrackProofCanvas } from './ProofCanvas';

const amber = Quantity.amber;
const start = Stroke.outline / 2;

function gridArea(amount: number, field: number, scale: 10 | 100) {
  'worklet';
  const path = Skia.Path.Make();
  const cell = field / 10;
  const columns = Math.floor(amount / 10);
  if (scale === 10) {
    path.addRect(Skia.XYWHRect(start, start, amount * cell / 10, field));
  } else {
    path.addRect(Skia.XYWHRect(start, start, columns * cell, field));
    if (amount % 10 > 0) path.addRect(Skia.XYWHRect(start + columns * cell, start, cell, amount % 10 * cell));
  }
  return path;
}

type GridProps = {
  hue?: 'teal' | 'amber'; groupedColumns?: number; difference?: readonly number[]; trace?: number;
  size: number; amount: number; preview?: SharedValue<number>; scale?: 10 | 100;
  trackCanvas?: TrackProofCanvas; canvasIndex?: number;
  selected?: readonly number[]; moving?: readonly number[];
  transfer?: { position: SharedValue<number>; beat: number };
};

/** Submitted masks use native faces, which paint in the same commit as the count. */
export function BaseTenGrid({ selected, moving, transfer, scale = 100, hue = 'amber', groupedColumns = 0, difference = [], trace, ...props }: GridProps) {
  if (!selected) return <AnimatedGrid {...props} scale={scale} />;
  const { size } = props;
  const field = size - Stroke.outline;
  const unit = field / 10;
  const seam = Shape.space.seam;
  const marked = new Set(difference);
  const lit = new Set(selected);
  const donors = new Set(moving?.filter((_, index) => index % 2 === 0));
  return <View style={{ width: size, height: size }} accessible={false} pointerEvents="none">
    <View style={[styles.gaps, { left: start + seam / 2, top: start + seam / 2, width: field - seam, height: field - seam }]} />
    {Array.from({ length: scale }, (_, index) => {
      const column = scale === 10 ? index : Math.floor(index / 10);
      const row = scale === 10 ? 0 : index % 10;
      const filled = lit.has(index) && !(transfer && donors.has(index));
      const band = scale === 100 && column < groupedColumns && !difference.some(i => Math.floor(i / 10) === column);
      if (band && row > 0) return null;
      return <Face key={index} hue={marked.has(index) ? 'amber' : hue} missing={!filled && marked.has(index)} traced={index === trace} left={start + column * unit + seam / 2} top={start + row * unit + seam / 2}
        width={unit - seam} height={(scale === 10 || band ? field : unit) - seam} filled={filled} />;
    })}
    {transfer && moving?.map((from, index) => index % 2 === 0 ? <MovingCell hue={hue} key={from}
      from={from} to={moving[index + 1]} pitch={unit} position={transfer.position} beat={transfer.beat} /> : null)}
  </View>;
}

function MovingCell({ from, to, pitch, position, beat, hue }: { hue: 'teal' | 'amber'; from: number; to: number; pitch: number; position: SharedValue<number>; beat: number }) {
  const side = pitch - Shape.space.seam;
  const outgoing = useAnimatedStyle(() => ({ opacity: 1 - Math.max(0, Math.min(1, position.get() - beat)) }));
  const incoming = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, position.get() - beat)) }));
  const offset = start + Shape.space.seam / 2;
  return <>{[from, to].map((cell, index) =>
    <Animated.View key={cell} style={[StyleSheet.absoluteFill, index ? incoming : outgoing]}>
      <Face hue={hue} left={offset + Math.floor(cell / 10) * pitch} top={offset + cell % 10 * pitch}
        width={side} height={side} filled />
    </Animated.View>)}</>;
}

function Face({ left, top, width, height, filled, hue, missing = false, traced = false }: {
  hue: 'teal' | 'amber'; missing?: boolean; traced?: boolean;
  left: number; top: number; width: number; height: number; filled: boolean;
}) {
  const radius = Math.min(width / 2, Shape.tile(width));
  const color = Quantity[hue];
  return <View style={[styles.cell, { left, top: top - (traced ? 4 : 0), width, height, borderRadius: radius,
    backgroundColor: filled || missing ? color.edge : Shape.emptyLip }]}>
    <View style={{ height: height - Shape.lip, borderRadius: radius, backgroundColor: filled || missing ? color.fill : Shape.empty }} />
  </View>;
}

function AnimatedGrid({ size, amount, preview, scale, trackCanvas, canvasIndex }: Pick<GridProps, 'size' | 'amount' | 'preview' | 'trackCanvas' | 'canvasIndex'> & { scale: 10 | 100 }) {
  const field = size - Stroke.outline;
  const unit = field / 10;
  const inset = start + Shape.space.seam / 2;
  const fill = useMemo(() => gridArea(amount, field, scale), [amount, field, scale]);
  const previewArea = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const current = preview?.get() ?? amount;
    if (current > amount && current < 100.001) path.addPath(gridArea(current, field, scale));
    return path;
  });
  const faces = useMemo(() => {
    const body = Skia.Path.Make(), lip = Skia.Path.Make();
    const seam = Shape.space.seam;
    const shortSide = unit - seam;
    const longSide = (scale === 10 ? field : unit) - seam;
    const radius = Math.min(shortSide / 2, Shape.tile(shortSide));
    for (let i = 0; i < scale; i++) {
      const column = scale === 10 ? i : Math.floor(i / 10);
      const row = scale === 10 ? 0 : i % 10;
      const x = inset + column * unit, y = inset + row * unit;
      body.addRRect(Skia.RRectXY(Skia.XYWHRect(x, y, shortSide, longSide - Shape.lip), radius, radius));
      lip.addRRect(Skia.RRectXY(Skia.XYWHRect(x, y, shortSide, longSide), radius, radius));
    }
    return { body, lip };
  }, [field, inset, scale, unit]);
  return <ProofCanvas trackCanvas={trackCanvas} canvasIndex={canvasIndex} style={{ width: size, height: size }} accessible={false} pointerEvents="none">
    <Rect x={inset} y={inset} width={field - Shape.space.seam} height={field - Shape.space.seam} color={Shape.seamColor} />
    <Path path={faces.lip} color={Shape.emptyLip} />
    <Path path={faces.body} color={Shape.empty} />
    <Group clip={previewArea}>
      <Path path={faces.lip} color={amber.light} />
      <Path path={faces.body} color={amber.soft} />
    </Group>
    <Group clip={fill}>
      <Path path={faces.lip} color={amber.edge} />
      <Path path={faces.body} color={amber.fill} />
    </Group>
  </ProofCanvas>;
}

const styles = StyleSheet.create({
  cell: { position: 'absolute' },
  gaps: { position: 'absolute', backgroundColor: Shape.seamColor },
});
