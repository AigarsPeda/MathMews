import { Image, StyleSheet, View } from "react-native";

const LARGE_TOY_SHEET_COLS = 2;
const LARGE_TOY_SHEET_ROWS = 2;

type ToySheetSpriteProps = {
  source: number;
  col: number;
  row: number;
  size: number;
};

/** Crops one cell from a uniform sprite sheet grid. */
export function ToySheetSprite({
  source,
  col,
  row,
  size,
}: ToySheetSpriteProps) {
  const sheetWidth = size * LARGE_TOY_SHEET_COLS;
  const sheetHeight = size * LARGE_TOY_SHEET_ROWS;

  return (
    <View style={[styles.cell, { width: size, height: size }]}>
      <Image
        source={source}
        style={{
          width: sheetWidth,
          height: sheetHeight,
          position: "absolute",
          left: -col * size,
          top: -row * size,
        }}
        resizeMode="stretch"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    overflow: "hidden",
  },
});
