import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, Text, View } from "react-native";

type NotificationBannerProps = {
  emoji: string;
  message: string;
};

export function NotificationBanner({ emoji, message }: NotificationBannerProps) {
  return (
    <View
      style={styles.banner}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: moderateScale(8),
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(14),
    borderWidth: 2,
    borderColor: GameColors.primary,
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(14),
  },
  emoji: {
    fontSize: moderateScale(18),
  },
  text: {
    fontSize: moderateScale(15),
    fontWeight: "700",
    color: GameColors.text,
  },
});
