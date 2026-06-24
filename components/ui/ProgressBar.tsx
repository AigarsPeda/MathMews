import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

export const PROGRESS_BAR_HEIGHT = moderateScale(8);

type ProgressBarProps = {
  /** Progress value from 0 to 1. */
  progress: number;
  fillColor?: string;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function ProgressBar({
  progress,
  fillColor = GameColors.primary,
  trackColor = GameColors.background,
  style,
  accessibilityLabel,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = PROGRESS_BAR_HEIGHT / 2;

  return (
    <View
      style={[
        styles.track,
        { backgroundColor: trackColor, borderRadius: radius },
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(clamped * 100),
      }}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${clamped * 100}%`,
            backgroundColor: fillColor,
            borderRadius: radius,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    height: PROGRESS_BAR_HEIGHT,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
});
