import { GameColors } from "@/constants/game";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { moderateScale } from "@/utils/scale";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

type FractionPieChartProps = {
  denominator: number;
  shaded: number;
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
  index: number,
  total: number,
) {
  const sweepRadians = (2 * Math.PI) / total;
  const startRadians = -Math.PI / 2 + index * sweepRadians;
  const endRadians = startRadians + sweepRadians;
  const steps = Math.max(12, Math.ceil(total * 2));

  const path = Skia.Path.Make();
  path.moveTo(cx, cy);

  for (let step = 0; step <= steps; step++) {
    const angle = startRadians + (sweepRadians * step) / steps;
    path.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }

  path.close();
  return path;
}

export function FractionPieChart({
  denominator,
  shaded,
  size = moderateScale(160),
  showResult = false,
  isCorrect = false,
}: FractionPieChartProps) {
  const radius = size / 2 - moderateScale(4);
  const center = size / 2;

  const slices = useMemo(() => {
    return Array.from({ length: denominator }, (_, index) => {
      const isShaded = index < shaded;
      let fill = isShaded ? FILLED_COLOR : EMPTY_COLOR;
      if (showResult && !isCorrect && isShaded) {
        fill = "#FF9F43";
      }
      if (showResult && isCorrect && isShaded) {
        fill = GameColors.success;
      }
      return {
        path: createWedgePath(center, center, radius, index, denominator),
        color: fill,
        key: `slice-${index}`,
      };
    });
  }, [center, denominator, isCorrect, radius, shaded, showResult]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Canvas style={{ width: size, height: size }}>
        {slices.map((slice) => (
          <Path
            key={slice.key}
            path={slice.path}
            color={slice.color}
            style="fill"
          />
        ))}
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "center",
  },
});
