import { PetDisplay } from "@/pet-display/components/PetDisplay";
import { PetSpeechBubble } from "@/components/pet/PetSpeechBubble";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { GameColors } from "@/constants/game";
import type { PetPlaybackState } from "@/pet-display/types";
import type { PetStats, PetType } from "@/types/game";
import { clampStat } from "@/utils/pet-care";
import { moderateScale } from "@/utils/scale";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";

const COMPACT_PET_MIN = 200;
const COMPACT_PET_MAX = 300;

type PetStageProps = {
  name: string;
  petType: PetType;
  stats: PetStats;
  speechMessage: string;
  playback: PetPlaybackState;
  compact?: boolean;
  onPetPress?: () => void;
  onAnimationComplete?: () => void;
  onStepComplete?: (stepIndex: number) => void;
};

function StatBar({
  emoji,
  label,
  value,
  color,
}: {
  emoji: string;
  label: string;
  value: number;
  color: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <View style={styles.statRow}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <View style={styles.statContent}>
        <View style={styles.statHeader}>
          <Text style={styles.statLabel}>{label}</Text>
          <Text style={styles.statValue}>{clamped}%</Text>
        </View>
        <ProgressBar
          progress={clamped / 100}
          fillColor={color}
          trackColor={GameColors.background}
        />
      </View>
    </View>
  );
}

export function PetStage({
  name,
  petType,
  stats,
  speechMessage,
  playback,
  compact = false,
  onPetPress,
  onAnimationComplete,
  onStepComplete,
}: PetStageProps) {
  const { t } = useTranslation();
  const [avatarWidth, setAvatarWidth] = useState(
    moderateScale(compact ? 260 : 200),
  );

  const handleAvatarLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!compact) return;

      const { width } = event.nativeEvent.layout;
      const clamped = Math.max(
        moderateScale(COMPACT_PET_MIN),
        Math.min(moderateScale(COMPACT_PET_MAX), Math.round(width)),
      );

      setAvatarWidth(clamped);
    },
    [compact],
  );

  return (
    <View style={[styles.stage, compact && styles.stageCompact]}>
      <View style={[styles.nameHeader, compact && styles.nameHeaderCompact]}>
        <Text style={[styles.nameText, compact && styles.nameTextCompact]}>
          {name}
        </Text>
        <Text style={styles.levelText}>
          {t("pet.level", { level: stats.level })}
        </Text>
      </View>

      <View style={styles.petColumnMeasure} onLayout={handleAvatarLayout}>
        <View
          style={[
            styles.petColumn,
            compact && styles.petColumnCompact,
            compact && { width: avatarWidth },
          ]}
        >
          <View
            style={[styles.avatarWrap, compact && styles.avatarWrapCompact]}
          >
            <View style={[styles.avatarCluster, { width: avatarWidth }]}>
              <View style={styles.speechAnchor}>
                <PetSpeechBubble message={speechMessage} />
              </View>
              <PetDisplay
                petType={petType}
                playback={playback}
                width={avatarWidth}
                onPress={onPetPress}
                onAnimationComplete={onAnimationComplete}
                onStepComplete={onStepComplete}
              />
            </View>
          </View>

          <View style={[styles.stats, compact && styles.statsCompact]}>
            <StatBar
              emoji="🍖"
              label={t("pet.fed")}
              value={clampStat(stats.hunger)}
              color={GameColors.hunger}
            />
            <StatBar
              emoji="💛"
              label={t("pet.happiness")}
              value={stats.happiness}
              color={GameColors.happiness}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(20),
    paddingVertical: moderateScale(20),
    paddingHorizontal: moderateScale(20),
    alignItems: "center",
    gap: moderateScale(8),
    width: "100%",
  },
  stageCompact: {
    flex: 1,
    justifyContent: "flex-start",
    borderRadius: moderateScale(16),
    paddingTop: moderateScale(8),
    paddingBottom: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    gap: moderateScale(4),
  },
  nameHeader: {
    alignItems: "center",
    gap: moderateScale(2),
  },
  nameHeaderCompact: {
    gap: 0,
  },
  nameText: {
    fontSize: moderateScale(22),
    fontWeight: "700",
    color: GameColors.text,
  },
  nameTextCompact: {
    fontSize: moderateScale(18),
  },
  levelText: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: GameColors.textMuted,
    marginTop: 2,
  },
  petColumnMeasure: {
    width: "100%",
  },
  petColumn: {
    width: "100%",
    alignItems: "center",
    gap: moderateScale(8),
  },
  petColumnCompact: {
    alignSelf: "center",
    gap: moderateScale(6),
  },
  avatarWrap: {
    minHeight: moderateScale(120),
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    position: "relative",
  },
  avatarWrapCompact: {
    flexGrow: 0,
    minHeight: 0,
    justifyContent: "flex-start",
  },
  avatarCluster: {
    position: "relative",
    alignItems: "center",
  },
  speechAnchor: {
    position: "absolute",
    bottom: "76%",
    right: moderateScale(40),
    zIndex: 2,
  },
  stats: {
    width: "100%",
    gap: moderateScale(12),
  },
  statsCompact: {
    gap: moderateScale(6),
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(10),
  },
  statEmoji: {
    fontSize: moderateScale(22),
    width: moderateScale(28),
    textAlign: "center",
  },
  statContent: {
    flex: 1,
    gap: moderateScale(4),
  },
  statHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: GameColors.text,
  },
  statValue: {
    fontSize: moderateScale(14),
    fontWeight: "700",
    color: GameColors.textMuted,
  },
});
