import { PetAvatar } from "@/components/pet/PetAvatar";
import { GameColors } from "@/constants/game";
import type { PetPlaybackState } from "@/hooks/use-pet-playback";
import type { PetStats } from "@/types/game";
import { getHungerDisplayPercent } from "@/utils/pet-care";
import { moderateScale } from "@/utils/scale";
import { useCallback, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

const COMPACT_PET_MIN = 160;
const COMPACT_PET_MAX = 280;

type PetStageProps = {
  name: string;
  stats: PetStats;
  moodLabel: string;
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
        <View style={styles.statTrack}>
          <View
            style={[
              styles.statFill,
              { width: `${clamped}%`, backgroundColor: color },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

export function PetStage({
  name,
  stats,
  moodLabel,
  playback,
  compact = false,
  onPetPress,
  onAnimationComplete,
  onStepComplete,
}: PetStageProps) {
  const { t } = useTranslation();
  const [avatarWidth, setAvatarWidth] = useState(
    moderateScale(compact ? 220 : 200),
  );

  const handleAvatarLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!compact) return;

      const { width, height } = event.nativeEvent.layout;
      const fromWidth = width * 0.85;
      const fromHeight = height * 0.9;
      const size = Math.min(fromWidth, fromHeight);
      const clamped = Math.max(
        moderateScale(COMPACT_PET_MIN),
        Math.min(moderateScale(COMPACT_PET_MAX), size),
      );

      setAvatarWidth(Math.round(clamped));
    },
    [compact],
  );

  return (
    <View style={[styles.stage, compact && styles.stageCompact]}>
      <View style={[styles.nameBadge, compact && styles.nameBadgeCompact]}>
        <Text style={[styles.nameText, compact && styles.nameTextCompact]}>
          {name}
        </Text>
        <Text style={styles.levelText}>
          {t('pet.level', { level: stats.level })}
        </Text>
      </View>

      <Text style={[styles.moodLabel, compact && styles.moodLabelCompact]}>
        {moodLabel}
      </Text>

      <View
        style={[styles.avatarWrap, compact && styles.avatarWrapCompact]}
        onLayout={handleAvatarLayout}
      >
        <PetAvatar
          playback={playback}
          width={avatarWidth}
          onPress={onPetPress}
          onAnimationComplete={onAnimationComplete}
          onStepComplete={onStepComplete}
        />
      </View>

      <View style={[styles.stats, compact && styles.statsCompact]}>
        <StatBar
          emoji="🍖"
          label={t('pet.hunger')}
          value={getHungerDisplayPercent(stats)}
          color={GameColors.hunger}
        />
        <StatBar
          emoji="💛"
          label={t('pet.happiness')}
          value={stats.happiness}
          color={GameColors.happiness}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    backgroundColor: GameColors.stageBg,
    borderRadius: moderateScale(24),
    borderWidth: 3,
    borderColor: GameColors.stageBorder,
    paddingVertical: moderateScale(20),
    paddingHorizontal: moderateScale(20),
    alignItems: "center",
    gap: moderateScale(8),
    width: "100%",
  },
  stageCompact: {
    flex: 1,
    borderRadius: moderateScale(20),
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    gap: moderateScale(4),
  },
  nameBadge: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(16),
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(20),
    alignItems: "center",
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
  },
  nameBadgeCompact: {
    paddingVertical: moderateScale(4),
    paddingHorizontal: moderateScale(14),
    borderRadius: moderateScale(12),
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
  moodLabel: {
    fontSize: moderateScale(16),
    fontWeight: "600",
    color: GameColors.secondary,
  },
  moodLabelCompact: {
    fontSize: moderateScale(14),
  },
  avatarWrap: {
    minHeight: moderateScale(200),
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(8),
    width: "100%",
    backgroundColor: GameColors.petVideoBg,
    borderRadius: moderateScale(12),
  },
  avatarWrapCompact: {
    flex: 1,
    minHeight: moderateScale(80),
    paddingVertical: moderateScale(4),
    width: "100%",
    backgroundColor: GameColors.petVideoBg,
    borderRadius: moderateScale(12),
  },
  stats: {
    width: "100%",
    gap: moderateScale(12),
    marginTop: moderateScale(4),
  },
  statsCompact: {
    gap: moderateScale(8),
    marginTop: 0,
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
  statTrack: {
    height: moderateScale(12),
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(6),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: GameColors.cardBorder,
  },
  statFill: {
    height: "100%",
    borderRadius: moderateScale(6),
  },
});
