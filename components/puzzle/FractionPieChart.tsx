import { GameColors } from "@/constants/game";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { moderateScale } from "@/utils/scale";
import { getFractionSliceAtPoint } from "@/utils/fraction-pie";
import { useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { cancelAnimation, Easing, useDerivedValue, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

type FractionPieChartProps = {
  denominator: number;
  shaded: number;
  selectedSlices?: readonly number[];
  onToggleSlice?: (index: number) => void;
  size?: number;
  /** Highlight correct shading after answer. */
  showResult?: boolean;
  isCorrect?: boolean;
};

const FILLED_COLOR = GameColors.secondary;
const EMPTY_COLOR = "#ECECEC";
const STROKE_COLOR = "#FFFFFF";

function createWedgePath(
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

export function FractionPieChart({
  denominator,
  shaded,
  selectedSlices,
  onToggleSlice,
  size = moderateScale(160),
  showResult = false,
  isCorrect = false,
}: FractionPieChartProps) {
  const radius = size / 2 - moderateScale(4);
  const center = size / 2;
  const targets = useMemo(() => Array.from({ length: denominator }, (_, index) => (
    selectedSlices ? Number(selectedSlices.includes(index)) : Number(index < shaded)
  )), [denominator, selectedSlices, shaded]);
  const filledPieces = useSharedValue(targets);
  const previousDenominator = useRef(denominator);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || previousDenominator.current !== denominator) {
      filledPieces.set(targets);
    } else if (targets.some((target, index) => target !== filledPieces.get()[index])) {
      const adding = targets.some((target, index) => target > filledPieces.get()[index]);
      filledPieces.set(withTiming(targets, {
        duration: adding ? 240 : 180,
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
  const fillColor = showResult ? isCorrect ? GameColors.success : "#FF9F43" : FILLED_COLOR;

  const slices = useMemo(() => {
    return Array.from({ length: denominator }, (_, index) => {
      return {
        path: createWedgePath(center, center, radius, -90 + index * 360 / denominator, 360 / denominator),
        key: `slice-${index}`,
      };
    });
  }, [center, denominator, radius]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Canvas style={{ width: size, height: size }} pointerEvents="none">
        {slices.map((slice) => (
          <Path
            key={slice.key}
            path={slice.path}
            color={EMPTY_COLOR}
            style="fill"
          />
        ))}
        <Path path={filledPath} color={fillColor} style="fill" />
        {slices.map((slice) => (
          <Path
            key={`${slice.key}-stroke`}
            path={slice.path}
            color={STROKE_COLOR}
            style="stroke"
            strokeWidth={2}
          />
        ))}
      </Canvas>
      {onToggleSlice ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          accessible={false}
          disabled={showResult}
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
