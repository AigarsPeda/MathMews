import { GameColors } from "@/constants/game";
import { getFractionGridSize } from "@/utils/fraction-match";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, View } from "react-native";

type FractionGridChartProps = {
  denominator: number;
  shaded: number;
  size?: number;
};

const SHADED_COLOR = GameColors.secondary;
const EMPTY_COLOR = "#ECECEC";

export function FractionGridChart({
  denominator,
  shaded,
  size = moderateScale(72),
}: FractionGridChartProps) {
  const { cols, rows } = getFractionGridSize(denominator);
  const gap = moderateScale(3);
  const cellSize = (size - gap * (cols - 1)) / cols;
  const gridHeight = rows * cellSize + gap * (rows - 1);

  return (
    <View style={[styles.wrap, { width: size, height: gridHeight, gap }]}>
      {Array.from({ length: denominator }, (_, index) => {
        const isShaded = index < shaded;
        return (
          <View
            key={`cell-${index}`}
            style={[
              styles.cell,
              {
                width: cellSize,
                height: cellSize,
                backgroundColor: isShaded ? SHADED_COLOR : EMPTY_COLOR,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignSelf: "center",
  },
  cell: {
    borderRadius: moderateScale(4),
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
});
