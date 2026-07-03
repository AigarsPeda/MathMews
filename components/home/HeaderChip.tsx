import { GameColors, HEADER_CHIP_SIZE } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type HeaderChipProps = {
  children: ReactNode;
  onPress?: () => void;
  borderColor?: string;
  shape?: "square" | "pill";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const chipHeight = moderateScale(HEADER_CHIP_SIZE);

export function HeaderChip({
  children,
  onPress,
  borderColor = GameColors.cardBorder,
  shape = "square",
  style,
  accessibilityLabel,
}: HeaderChipProps) {
  const chipStyle = [
    styles.chip,
    shape === "square" ? styles.square : styles.pill,
    { borderColor },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [chipStyle, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={chipStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  chip: {
    height: chipHeight,
    minHeight: chipHeight,
    maxHeight: chipHeight,
    borderWidth: 2,
    backgroundColor: GameColors.card,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  square: {
    width: chipHeight,
    borderRadius: moderateScale(12),
  },
  pill: {
    borderRadius: chipHeight / 2,
    paddingHorizontal: moderateScale(10),
    gap: moderateScale(4),
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
