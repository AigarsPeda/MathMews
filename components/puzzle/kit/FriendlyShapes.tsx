import { PuzzleColors, Quantity, Shape, type QuantityHue } from '@/constants/puzzle-theme';
import { getFractionSliceAtPoint } from '@/utils/fraction-pie';
import { Canvas, Circle, Group, Oval, Path, Skia } from '@shopify/react-native-skia';
import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { PressFace } from './PressFace';

type Box = { width: number; height: number };
type Face = Box & { fill: string; edge: string };
type Point = { x: number; y: number };

/** The measured face and its children stay fixed. The optional lip sits below it. */
export function RoundedTile({ width, height, fill, edge, interactive = false, pressed = false, children }: Face & {
  interactive?: boolean; pressed?: boolean; children?: ReactNode;
}) {
  const radius = Shape.tile(Math.min(width, height));
  const lipColor = fill === Shape.empty ? Shape.emptyLip : edge;
  return <View style={{ width, height: interactive ? height + Shape.lip : height }}>
    <PressFace fill={fill} edge={lipColor} radius={radius} raised pressed={interactive && pressed} borderWidth={0} />
    <View style={{ width, height: interactive ? height : Math.max(0, height - Shape.lip), alignItems: 'center', justifyContent: 'center' }}>{children}</View>
  </View>;
}

export function FriendlyPolygon({ width, height, points, fill, edge }: Face & { points: readonly Point[] }) {
  const face = useMemo(() => {
    const face = Skia.Path.Make();
    if (points.length < 3) return face;
    points.forEach((p, i) => {
      const before = points[(i + points.length - 1) % points.length], after = points[(i + 1) % points.length];
      const a = Math.hypot(before.x - p.x, before.y - p.y), b = Math.hypot(after.x - p.x, after.y - p.y);
      const inset = Shape.vertex(Math.min(a, b));
      const x = p.x + (before.x - p.x) * inset / (a || 1), y = p.y + (before.y - p.y) * inset / (a || 1);
      if (i === 0) face.moveTo(x, y);
      else face.lineTo(x, y);
      face.quadTo(p.x, p.y, p.x + (after.x - p.x) * inset / (b || 1), p.y + (after.y - p.y) * inset / (b || 1));
    });
    face.close();
    return face;
  }, [points]);
  return <Canvas accessible={false} pointerEvents="none" style={{ width, height }}>
    <Group clip={face}>
      <Path path={face} color={edge} />
      <Path path={face} color={fill} transform={[{ translateY: -Shape.lip }]} />
    </Group>
  </Canvas>;
}

export function PieWithCrust({ size, denominator, selectedIndices, hue = 'violet', onToggleSlice }: {
  size: number; denominator: number; selectedIndices: readonly number[]; hue?: QuantityHue; onToggleSlice?: (index: number) => void;
}) {
  const center = size / 2, rimWidth = Math.min(8, size * .07);
  const radius = Math.max(0, center - rimWidth - Shape.stroke.silhouette / 2);
  const palette = Quantity[hue];
  const { crust, sectors, seams } = useMemo(() => {
    const crust = Skia.Path.Make(), seams = Skia.Path.Make();
    const point = (r: number, angle: number) => ({ x: center + r * Math.sin(angle), y: center - r * Math.cos(angle) });
    const turns = Math.max(8, Math.round(size / 7));
    const crest = radius + rimWidth;
    const scallop = Math.min(2, rimWidth / 3);
    for (let i = 0; i < turns; i++) {
      const pitch = 2 * Math.PI / turns;
      const start = point(crest - scallop, i * pitch);
      const handle = point(crest + scallop, (i + .5) * pitch);
      const end = point(crest - scallop, (i + 1) * pitch);
      if (!i) crust.moveTo(start.x, start.y);
      crust.quadTo(handle.x, handle.y, end.x, end.y);
    }
    crust.close();
    const bounds = { x: center - radius, y: center - radius, width: radius * 2, height: radius * 2 };
    const sectors = Array.from({ length: denominator }, (_, i) => {
      const sector = Skia.Path.Make();
      if (denominator === 1) sector.addCircle(center, center, radius);
      else {
        const p = point(radius, i * Math.PI * 2 / denominator);
        seams.moveTo(center, center); seams.lineTo(p.x, p.y);
        sector.moveTo(center, center);
        sector.arcToOval(bounds, -90 + i * 360 / denominator, 360 / denominator, false);
        sector.close();
      }
      return sector;
    });
    return { crust, seams, sectors };
  }, [size, center, radius, rimWidth, denominator]);
  return <View style={{ width: size, height: size }}>
    <Canvas accessible={false} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Path path={crust} color={Quantity.amber.light} />
      <Circle cx={center} cy={center} r={radius} color={Shape.empty} />
      {sectors.map((sector, i) => {
        const shaded = selectedIndices.includes(i);
        return <Group key={i} clip={sector}>
          <Path path={sector} color={shaded ? palette.edge : Shape.emptyLip} />
          <Path path={sector} color={shaded ? palette.fill : Shape.empty} transform={[{ translateY: -Shape.lip }]} />
        </Group>;
      })}
      <Path path={seams} color={Shape.seamColor} style="stroke" strokeWidth={Shape.space.seam} />
    </Canvas>
    {onToggleSlice && <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={({ nativeEvent }) => {
      const slice = getFractionSliceAtPoint(nativeEvent.locationX, nativeEvent.locationY, center, radius, denominator);
      if (slice !== null && denominator > 0) onToggleSlice(slice);
    }} />}
  </View>;
}

/** The owner's cookie slots occupy the inner oval; the rim never moves their centres. */
export function PlateGlyph({ width, height, active = false }: Box & { active?: boolean }) {
  const lip = Math.min(Shape.lip, height / 2);
  const outer = { x: 0, width, height: height - lip };
  const insetX = Math.min(12, width * .10), insetY = Math.min(9, height * .12);
  const well = { x: insetX, y: insetY, width: width - 2 * insetX, height: height - 2 * insetY };
  return <Canvas accessible={false} pointerEvents="none" style={{ width, height }}>
    <Oval {...outer} y={lip} color={active ? PuzzleColors.primary : Shape.emptyLip} />
    <Oval {...outer} y={0} color={active ? PuzzleColors.selectedSurface : Shape.empty} />
    <Oval {...well} color={PuzzleColors.card} />
  </Canvas>;
}

export { UnitRun, UnitRunGlyph, type UnitRunProps } from './UnitRun';
