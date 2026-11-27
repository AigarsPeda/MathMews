import { Motion, Quantity, PuzzleColors as GameColors, Shape } from "@/constants/puzzle-theme";
import { Canvas, Group, Path, Skia } from "@shopify/react-native-skia";
import { moderateScale } from "@/utils/scale";
import { getFractionSliceAtPoint } from "@/utils/fraction-pie";
import { useEffect, useMemo, useRef, type ComponentProps, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { cancelAnimation, Easing, useDerivedValue, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

type FractionPieChartProps = {
  denominator: number;
  shaded: number;
  selectedSlices?: readonly number[];
  onToggleSlice?: (index: number) => void;
  size?: number;
  alternateWhole?: boolean;
  /** Locks the pie after submitting. Callers can opt into a result tint. */
  showResult?: boolean;
  isCorrect?: boolean;
};

const violet = Quantity.violet;

export function createWedgePath(
  cx: number,
  cy: number,
  radius: number,
  start: number,
  sweep: number,
) {
  "worklet";
  const path = Skia.Path.Make();
  if (sweep >= 360) {
    path.addCircle(cx, cy, radius);
  } else if (sweep > 0) {
    path.moveTo(cx, cy);
    path.arcToOval({ x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 }, start, sweep, false);
    path.close();
  }
  return path;
}

export function pieFaceRadius(size: number) {
  return size / 2 - Shape.lip;
}

export function createPieGeometry(size: number, denominator: number) {
  const center = size / 2;
  const radius = pieFaceRadius(size);
  const face = createWedgePath(center, center, radius, 0, 360);
  const silhouette = createWedgePath(center, center, radius, 0, 360);
  silhouette.addCircle(center, center + Shape.lip, radius);
  const gaps = Skia.Path.Make();
  const halfGap = Shape.space.seam / 2;
  for (let index = 0; denominator > 1 && index < denominator; index++) {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / denominator;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const x = center + dx * (radius + Shape.lip), y = center + dy * (radius + Shape.lip);
    const nx = -dy * halfGap, ny = dx * halfGap;
    gaps.moveTo(center + nx, center + ny);
    gaps.lineTo(x + nx, y + ny);
    gaps.lineTo(x - nx, y - ny);
    gaps.lineTo(center - nx, center - ny);
    gaps.close();
  }
  return { face, silhouette, gaps };
}

/** White cuts interrupt both the face and its lip. */
export function PiePieces({ geometry, filled, color = violet.fill, children }: {
  geometry: ReturnType<typeof createPieGeometry>;
  filled: ComponentProps<typeof Path>['path'];
  color?: string;
  children?: ReactNode;
}) {
  const { face, silhouette, gaps } = geometry;
  return <>
    <Group transform={[{ translateY: Shape.lip }]}>
      <Path path={face} color={Shape.emptyLip} />
      <Path path={filled} color={violet.edge} />
    </Group>
    <Path path={face} color={Shape.empty} />
    <Path path={filled} color={color} />
    {children}
    <Group clip={silhouette}><Path path={gaps} color={Shape.seamColor} /></Group>
  </>;
}

export function FractionPieChart({
  denominator,
  shaded,
  selectedSlices,
  onToggleSlice,
  size = moderateScale(160),
  showResult = false,
  alternateWhole = false,
  isCorrect,
}: FractionPieChartProps) {
  const radius = pieFaceRadius(size);
  const center = size / 2;
  const targets = useMemo(() => Array.from({ length: denominator }, (_, index) => (
    selectedSlices ? Number(selectedSlices.includes(index)) : Number(index < shaded)
  )), [denominator, selectedSlices, shaded]);
  const filledPieces = useSharedValue(targets);
  const pressedPiece = useSharedValue<number[]>([]);
  const previousDenominator = useRef(denominator);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || previousDenominator.current !== denominator) {
      filledPieces.set(targets);
    } else if (targets.some((target, index) => target !== filledPieces.get()[index])) {
      filledPieces.set(withTiming(targets, {
        duration: Motion.tap + Motion.tap / 2,
        easing: Easing.out(Easing.cubic),
      }));
    }
    previousDenominator.current = denominator;
    return () => cancelAnimation(filledPieces);
  }, [denominator, targets, reducedMotion, filledPieces]);

  const filledPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    filledPieces.get().forEach((progress, index) => {
      path.addPath(createWedgePath(
        center, center, radius, -90 + index * 360 / denominator,
        Math.max(0, Math.min(1, progress)) * 360 / denominator,
      ));
    });
    return path;
  });
  const pressedPath = useDerivedValue(() => {
    const [index] = pressedPiece.get();
    return createWedgePath(center, center, radius, -90 + (index ?? 0) * 360 / denominator,
      index === undefined ? 0 : 360 / denominator);
  });
  const contrastPath = useMemo(() => {
    const path = Skia.Path.Make();
    if (alternateWhole && shaded === denominator && denominator > 1) {
      for (let piece = 1; piece < denominator; piece += 2) {
        path.addPath(createWedgePath(center, center, radius, -90 + piece * 360 / denominator, 360 / denominator));
      }
    }
    return path;
  }, [alternateWhole, center, denominator, radius, shaded]);
  const geometry = useMemo(() => createPieGeometry(size, denominator), [size, denominator]);
  const color = showResult && isCorrect !== undefined ? (isCorrect ? GameColors.success : GameColors.incorrect) : violet.fill;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Canvas style={{ width: size, height: size }} pointerEvents="none">
        <PiePieces geometry={geometry} filled={filledPath} color={color}>
          {alternateWhole ? <Path path={contrastPath} color={violet.grid} /> : null}
          {onToggleSlice ? <Path path={pressedPath} color={GameColors.primary} opacity={.18} /> : null}
        </PiePieces>
      </Canvas>
      {onToggleSlice ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          accessible={false}
          disabled={showResult}
          onPressIn={({ nativeEvent: { locationX, locationY } }) => {
            const index = getFractionSliceAtPoint(locationX, locationY, center, radius, denominator);
            if (index !== null) pressedPiece.set([index]);
          }}
          onPressOut={() => pressedPiece.set([])}
          onPress={({ nativeEvent: { locationX, locationY } }) => {
            if (showResult) return;
            const index = getFractionSliceAtPoint(locationX, locationY, center, radius, denominator);
            if (index !== null) onToggleSlice(index);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "center",
  },
});
