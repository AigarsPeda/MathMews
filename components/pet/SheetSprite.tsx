import { Image, StyleSheet, View } from "react-native";

export type SheetSpriteFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type SheetSpriteProps = {
  source: number;
  sheetSize: number;
  frame: SheetSpriteFrame;
  /** Max rendered width/height — aspect ratio preserved. */
  size: number;
};

/** Crops an arbitrary rectangle from a square sprite sheet. */
export function SheetSprite({
  source,
  sheetSize,
  frame,
  size,
}: SheetSpriteProps) {
  const scale = size / Math.max(frame.w, frame.h);
  const displayW = frame.w * scale;
  const displayH = frame.h * scale;
  const sheetDisplay = sheetSize * scale;

  return (
    <View style={[styles.cell, { width: displayW, height: displayH }]}>
      <Image
        source={source}
        style={{
          width: sheetDisplay,
          height: sheetDisplay,
          position: "absolute",
          left: -frame.x * scale,
          top: -frame.y * scale,
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
