import { GameColors, LIFE_REGEN_MINUTES } from "@/constants/game";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatRegenClock, regenProgress } from "@/utils/lives";
import { moderateScale } from "@/utils/scale";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

type LifeRegenClockProps = {
  regenMs: number;
  compact?: boolean;
  showProgress?: boolean;
};

function BlinkingColon({ large = false }: { large?: boolean }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 500 }),
        withTiming(0.25, { duration: 500 }),
      ),
      -1,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.Text
      style={[large ? textStyles.colonLarge : textStyles.colon, animatedStyle]}
    >
      :
    </Animated.Text>
  );
}

function DigitalTime({
  display,
  large = false,
}: {
  display: string;
  large?: boolean;
}) {
  const parts = display.split(":");
  const timeStyle = large ? textStyles.timeLarge : textStyles.time;

  return (
    <View style={viewStyles.digitsRow}>
      {parts.map((part, index) => (
        <View key={`${part}-${index}`} style={viewStyles.digitGroup}>
          {index > 0 ? <BlinkingColon large={large} /> : null}
          <Text style={timeStyle}>{part}</Text>
        </View>
      ))}
    </View>
  );
}

export function LifeRegenClock({
  regenMs,
  compact = true,
  showProgress = !compact,
}: LifeRegenClockProps) {
  const { t } = useTranslation();
  const display = useMemo(() => formatRegenClock(regenMs), [regenMs]);
  const progress = useMemo(() => regenProgress(regenMs), [regenMs]);

  return (
    <View
      style={[viewStyles.wrap, compact && viewStyles.wrapCompact]}
      accessibilityRole="timer"
      accessibilityLabel={t("lives.a11yTimer", { time: display })}
    >
      <View style={viewStyles.timeRow}>
        {compact ? <Text style={textStyles.plus}>+</Text> : null}
        <DigitalTime display={display} large={!compact && showProgress} />
      </View>

      {showProgress ? (
        <ProgressBar
          progress={progress}
          fillColor={GameColors.primary}
          trackColor="rgba(255, 107, 107, 0.12)"
          accessibilityLabel={t("lives.a11yProgress", {
            percent: Math.round(progress * 100),
          })}
        />
      ) : null}

      {!compact && showProgress ? (
        <Text style={textStyles.progressHint}>
          {t("lives.refillsEvery", { minutes: LIFE_REGEN_MINUTES })}
        </Text>
      ) : null}
    </View>
  );
}

const viewStyles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: moderateScale(8),
    width: "100%",
    maxWidth: moderateScale(220),
  },
  wrapCompact: {
    alignItems: "flex-start",
    gap: 0,
    width: "auto",
    marginLeft: moderateScale(2),
    paddingLeft: moderateScale(6),
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255, 107, 107, 0.2)",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  digitsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  digitGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
});

const textStyles = StyleSheet.create({
  plus: {
    fontSize: moderateScale(11),
    fontWeight: "700",
    color: GameColors.textMuted,
    marginRight: moderateScale(1),
  },
  time: {
    fontSize: moderateScale(11),
    fontWeight: "700",
    color: GameColors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  timeLarge: {
    fontSize: moderateScale(36),
    fontWeight: "800",
    color: GameColors.primary,
    fontVariant: ["tabular-nums"],
  },
  colon: {
    fontSize: moderateScale(11),
    fontWeight: "700",
    color: GameColors.textMuted,
  },
  colonLarge: {
    fontSize: moderateScale(36),
    fontWeight: "800",
    color: GameColors.primary,
  },
  progressHint: {
    fontSize: moderateScale(12),
    fontWeight: "500",
    color: GameColors.textMuted,
    textAlign: "center",
  },
});
