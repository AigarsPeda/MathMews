import { Canvas, Fill, LinearGradient, vec } from "@shopify/react-native-skia";
import { useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { PuzzleColors } from "@/constants/puzzle-theme";
import { moderateScale } from "@/utils/scale";

/** A static paint layer; it never intercepts touches or enters the accessibility tree. */
export function PuzzleGradient({ colors, style }: { colors: string[]; style?: StyleProp<ViewStyle> }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[StyleSheet.absoluteFill, style]} onLayout={({ nativeEvent: { layout } }) => {
      setSize(current => current.width === layout.width && current.height === layout.height
        ? current : { width: layout.width, height: layout.height });
    }}>
    {size.width > 0 && size.height > 0 ? <Canvas style={StyleSheet.absoluteFill}>
      <Fill><LinearGradient start={vec(0, 0)} end={vec(0, size.height)} colors={colors} /></Fill>
    </Canvas> : null}
  </View>;
}

export function PuzzleHeaderGlow({ color = PuzzleColors.headerGlow }: { color?: string }) {
  return <PuzzleGradient colors={[color, "#FFFFFF"]} style={{ bottom: undefined, height: moderateScale(285) }} />;
}
