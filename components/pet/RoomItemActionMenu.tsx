import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { Pressable, StyleSheet, Text, View } from "react-native";

type RoomItemActionMenuProps = {
  label: string;
  onPress: () => void;
};

export function RoomItemActionMenu({ label, onPress }: RoomItemActionMenuProps) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.menu}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.actionPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <Text style={styles.actionText}>{label}</Text>
        </Pressable>
      </View>
      <View style={styles.arrow} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: "100%",
    alignItems: "center",
    marginBottom: moderateScale(4),
    zIndex: 2,
  },
  menu: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(10),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: moderateScale(6),
    shadowOffset: { width: 0, height: moderateScale(2) },
    elevation: 4,
    overflow: "hidden",
  },
  action: {
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    minWidth: moderateScale(88),
    alignItems: "center",
  },
  actionPressed: {
    backgroundColor: GameColors.background,
  },
  actionText: {
    fontSize: moderateScale(13),
    fontWeight: "700",
    color: GameColors.primary,
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: moderateScale(6),
    borderRightWidth: moderateScale(6),
    borderTopWidth: moderateScale(6),
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: GameColors.cardBorder,
  },
});
