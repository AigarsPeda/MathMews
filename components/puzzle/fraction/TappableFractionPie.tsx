import { Motion, Quantity, Shape } from '@/constants/puzzle-theme';
import { Group, Path, PathOp, Skia } from '@shopify/react-native-skia';
import { getFractionSliceAtPoint } from '@/utils/fraction-pie';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { cancelAnimation, useDerivedValue, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { ProofCanvas, type TrackProofCanvas } from '../ProofCanvas';
import { useModelStage } from '../kit/ModelStage';
import { useProofViewport } from '../PlayProofCaption';

export function usePieSize(columns = 1) {
  // Both drawings use native dimensions so the checked stage never rescales the pie.
  useModelStage();
  const viewport = useProofViewport();
  const { width } = useWindowDimensions();
  const available = viewport?.innerWidth ?? width - 60;
  return Math.min(160, (available - 12 * (columns - 1)) / columns);
}

type Props = {
  denominator: number;
  shaded: number;
  selectedSlices?: readonly number[];
  onToggleSlice?: (index: number) => void;
  size?: number;
  showResult?: boolean;
  enter?: boolean;
  traced?: readonly number[];
  discrepancies?: readonly number[];
  trackCanvas?: TrackProofCanvas;
  canvasIndex?: number;
};

function Wedge({ index, parts, size, filled, lifted, amber, enter }: {
  index: number; parts: number; size: number; filled: boolean; lifted: boolean; amber: boolean; enter: boolean;
}) {
  const center = size / 2;
  const radius = center;
  const angle = 2 * Math.PI / parts;
  const mid = (index + .5) * angle - Math.PI / 2;
  const reduced = useReducedMotion();
  const offset = useSharedValue(0);
  const entrance = useSharedValue(reduced || !enter ? 1 : 0);
  const path = useMemo(() => {
    const face = Skia.Path.Make();
    if (parts === 1) {
      face.addCircle(center, center, radius);
      return face;
    }
    face.moveTo(center, center);
    face.arcToOval({ x: center - radius, y: center - radius, width: 2 * radius, height: 2 * radius },
      index * 360 / parts - 90, 360 / parts, false);
    face.close();
    // Cut a constant-width gap along both radial edges, including the centre.
    for (const edge of [index, index + 1]) {
      const a = edge * angle - Math.PI / 2;
      const dx = Math.cos(a), dy = Math.sin(a);
      const gap = Shape.space.seam / 2;
      const x = center + dx * (radius + 2), y = center + dy * (radius + 2);
      const cut = Skia.Path.Make();
      cut.moveTo(center - dy * gap, center + dx * gap);
      cut.lineTo(x - dy * gap, y + dx * gap);
      cut.lineTo(x + dy * gap, y - dx * gap);
      cut.lineTo(center + dy * gap, center - dx * gap);
      cut.close();
      face.op(cut, PathOp.Difference);
    }
    return face;
  }, [angle, center, index, parts, radius]);
  useEffect(() => {
    offset.set(reduced ? 0 : withTiming(lifted ? 6 : 0, { duration: Motion.tap }));
    return () => cancelAnimation(offset);
  }, [lifted, offset, reduced]);
  useEffect(() => {
    entrance.set(!enter || reduced ? 1 : withTiming(1, { duration: 150 }));
    return () => cancelAnimation(entrance);
  }, [enter, entrance, reduced]);
  const transform = useDerivedValue(() => [
    { translateX: Math.cos(mid) * offset.get() }, { translateY: Math.sin(mid) * offset.get() },
    { scale: .9 + .1 * entrance.get() - offset.get() / radius },
  ]);
  const hue = amber ? Quantity.amber : Quantity.teal;
  return <Group transform={transform} origin={{ x: center, y: center }}>
    <Path path={path} color={amber || filled ? hue.fill : Shape.empty} />
  </Group>;
}

export function TappableFractionPie({ denominator, shaded, selectedSlices, onToggleSlice, size = 160, showResult = false,
  enter = false, traced, discrepancies, trackCanvas, canvasIndex }: Props) {
  const center = size / 2;
  return <View style={{ alignSelf: 'center', width: size, height: size }}>
    <ProofCanvas trackCanvas={trackCanvas} canvasIndex={canvasIndex} style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: denominator }, (_, index) => {
        const filled = selectedSlices ? selectedSlices.includes(index) : index < shaded;
        return <Wedge key={index} index={index} parts={denominator} size={size} filled={filled}
          lifted={traced?.includes(index) ?? false}
          amber={!!discrepancies?.includes(index)} enter={enter} />;
      })}
    </ProofCanvas>
    {onToggleSlice && !showResult ? <Pressable accessible={false} style={StyleSheet.absoluteFill}
      onPress={({ nativeEvent: { locationX, locationY } }) => {
        const slice = getFractionSliceAtPoint(locationX, locationY, center, center, denominator);
        if (slice !== null) onToggleSlice(slice);
      }} /> : null}
  </View>;
}
