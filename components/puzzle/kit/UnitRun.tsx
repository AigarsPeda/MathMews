import { Quantity, Shape, type QuantityHue } from '@/constants/puzzle-theme';
import { Group, Rect, RoundedRect } from '@shopify/react-native-skia';
import { Fragment } from 'react';
import { View } from 'react-native';

export type UnitRunProps = {
  width: number;
  height: number;
  count: number;
  /** Cells per row. Defaults to one horizontal run. Use 1 for a vertical rod. */
  columns?: number;
  gap?: number;
  /** Leading filled faces in row-major order. The remaining faces use the empty role. */
  filled?: number;
  /** A mixed run can preserve each operand's role across a shared seam. */
  hue?: QuantityHue | ((index: number) => QuantityHue);
};

function unitFaces({ width, height, count, columns = count, gap: requestedGap = Shape.space.seam, filled = count, hue = 'teal' }: UnitRunProps) {
  if (count <= 0 || columns <= 0 || width <= 0 || height <= 0) return [];
  const rows = Math.ceil(count / columns);
  const pitchX = width / columns, pitchY = height / rows;
  const gap = Math.max(0, Math.min(requestedGap, columns > 1 ? pitchX - 1 : Infinity, rows > 1 ? pitchY - 1 : Infinity));
  return Array.from({ length: count }, (_, index) => {
    const column = index % columns, row = Math.floor(index / columns);
    const faceWidth = (width - (columns - 1) * gap) / columns;
    const faceHeight = (height - (rows - 1) * gap) / rows;
    const side = Math.min(faceWidth, faceHeight);
    const radius = Math.min(side / 2, Shape.tile(side));
    const lip = Math.min(Shape.lip, faceHeight / 2);
    const role = typeof hue === 'function' ? hue(index) : hue;
    const paint = index < filled ? Quantity[role] : { edge: Shape.emptyLip, fill: Shape.empty };
    return { x: column * (faceWidth + gap), y: row * (faceHeight + gap), width: faceWidth, height: faceHeight, radius, lip, paint };
  });
}

/** Draw the same faces inside an existing Skia canvas. */
export function UnitRunGlyph({ x = 0, y = 0, ...props }: UnitRunProps & { x?: number; y?: number }) {
  const faces = unitFaces(props);
  if (!faces.length) return null;
  return <Group transform={[{ translateX: x }, { translateY: y }]}>
    <Rect x={0} y={0} width={props.width} height={props.height} color={Shape.seamColor} />
    {faces.map((face, index) => <Fragment key={index}>
      <RoundedRect x={face.x} y={face.y} width={face.width} height={face.height} r={face.radius} color={face.paint.edge} />
      <RoundedRect x={face.x} y={face.y} width={face.width} height={face.height - face.lip}
        r={face.radius} color={face.paint.fill} />
    </Fragment>)}
  </Group>;
}

/** Native faces commit alongside a native count or caption at the same landing. */
export function UnitRun(props: UnitRunProps) {
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none"
    style={{ width: props.width, height: props.height, backgroundColor: Shape.seamColor }}>
    {unitFaces(props).map((face, index) => <View key={index} style={{ position: 'absolute', left: face.x, top: face.y,
      width: face.width, height: face.height, borderRadius: face.radius, backgroundColor: face.paint.edge }}>
      <View style={{ width: face.width, height: face.height - face.lip, borderRadius: face.radius, backgroundColor: face.paint.fill }} />
    </View>)}
  </View>;
}
