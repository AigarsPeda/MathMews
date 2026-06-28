import { DraggableRoomPet } from "@/components/pet/DraggableRoomPet";
import { PetRoomBackground } from "@/components/pet/PetRoomBackground";
import { PetSpeechBubble } from "@/components/pet/PetSpeechBubble";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { DecorationSpriteImage } from "@/components/pet/DecorationSpriteImage";
import { RoomItemActionMenu } from "@/components/pet/RoomItemActionMenu";
import { ToySpriteImage } from "@/components/pet/ToySpriteImage";
import { getCatBedSource } from "@/constants/cat-beds";
import type { PlacedDecoration, PlacedToy, RoomItemOffset } from "@/types/game";
import type { CatDecorationId } from "@/constants/cat-decorations";
import { getDecorationDragSize } from "@/constants/cat-decorations";
import type { CatToyId } from "@/constants/cat-toys";
import { getToyDisplaySize } from "@/constants/cat-toys";
import { resolveSpriteDisplaySize } from "@/constants/cat-sprites";
import { GameColors } from "@/constants/game";
import { USE_CAT_SPRITE_PETS } from "@/constants/pet-display";
import { PetDisplay } from "@/pet-display/components/PetDisplay";
import type { PetPlaybackState } from "@/pet-display/types";
import type { PetStats, PetType } from "@/types/game";
import { clampStat } from "@/utils/pet-care";
import { moderateScale } from "@/utils/scale";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { type LayoutChangeEvent, Image, Pressable, StyleSheet, Text, View } from "react-native";

const COMPACT_PET_MIN = 200;
const COMPACT_PET_MAX = 300;
const COMPACT_SPRITE_PET_SIZE = 96;
const COMPACT_BED_SIZE = 72;

function compactPetWidth(petType: PetType, compact: boolean) {
  const usesSprite = USE_CAT_SPRITE_PETS && petType === "cat";
  if (compact && usesSprite) {
    return moderateScale(COMPACT_SPRITE_PET_SIZE);
  }
  return moderateScale(compact ? 260 : 200);
}

function avatarDisplayWidth(
  petType: PetType,
  avatarWidth: number,
  displayWidth: number,
) {
  const usesSprite = USE_CAT_SPRITE_PETS && petType === "cat";
  return usesSprite ? displayWidth : avatarWidth;
}

type PetStageProps = {
  name: string;
  petType: PetType;
  catSkinId?: string;
  stats: PetStats;
  wisdom: number;
  roomId?: string;
  roomPetOffset?: { x: number; y: number };
  bedId?: string;
  roomBedOffset?: { x: number; y: number };
  placedToys?: PlacedToy[];
  placedDecorations?: PlacedDecoration[];
  speechMessage?: string | null;
  playback: PetPlaybackState;
  compact?: boolean;
  onPetPress?: () => void;
  onRoomPetOffsetChange?: (offset: { x: number; y: number }) => void;
  onRoomBedOffsetChange?: (offset: { x: number; y: number }) => void;
  onPlacedToyOffsetChange?: (toyId: CatToyId, offset: RoomItemOffset) => void;
  onPlacedDecorationOffsetChange?: (
    decorationId: CatDecorationId,
    offset: RoomItemOffset,
  ) => void;
  onPlacedDecorationRemove?: (decorationId: CatDecorationId) => void;
  onBedRemove?: () => void;
  onPlacedToyRemove?: (toyId: CatToyId) => void;
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
  const clamped = clampStat(value);

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

type RoomItemMenu =
  | { kind: "bed" }
  | { kind: "decoration"; id: CatDecorationId }
  | { kind: "toy"; id: CatToyId };

export function PetStage({
  name,
  petType,
  catSkinId,
  stats,
  wisdom,
  roomId,
  roomPetOffset,
  bedId,
  roomBedOffset,
  placedToys,
  placedDecorations,
  speechMessage,
  playback,
  compact = false,
  onPetPress,
  onRoomPetOffsetChange,
  onRoomBedOffsetChange,
  onPlacedToyOffsetChange,
  onPlacedDecorationOffsetChange,
  onPlacedDecorationRemove,
  onBedRemove,
  onPlacedToyRemove,
  onAnimationComplete,
  onStepComplete,
}: PetStageProps) {
  const { t } = useTranslation();
  const usesSprite = USE_CAT_SPRITE_PETS && petType === "cat";
  const bedSize = moderateScale(COMPACT_BED_SIZE);
  const bedSource = usesSprite ? getCatBedSource(bedId) : undefined;
  const roomPlacedToys = usesSprite ? (placedToys ?? []) : [];
  const roomPlacedDecorations = usesSprite ? (placedDecorations ?? []) : [];
  const [openRoomItemMenu, setOpenRoomItemMenu] =
    useState<RoomItemMenu | null>(null);
  const removeMenuLabel = t("home.removeFromRoom");
  const [avatarWidth, setAvatarWidth] = useState(
    compactPetWidth(petType, compact),
  );
  const displayWidth = usesSprite
    ? resolveSpriteDisplaySize(avatarWidth)
    : avatarWidth;
  const petDisplayWidth = avatarDisplayWidth(
    petType,
    avatarWidth,
    displayWidth,
  );

  const handleAvatarLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!compact || usesSprite) return;

      const { width } = event.nativeEvent.layout;
      const clamped = Math.max(
        moderateScale(COMPACT_PET_MIN),
        Math.min(moderateScale(COMPACT_PET_MAX), Math.round(width)),
      );

      setAvatarWidth(clamped);
    },
    [compact, usesSprite],
  );

  const handleDecorationTap = useCallback((decorationId: CatDecorationId) => {
    if (!onPlacedDecorationRemove) return;
    setOpenRoomItemMenu((current) =>
      current?.kind === "decoration" && current.id === decorationId
        ? null
        : { kind: "decoration", id: decorationId },
    );
  }, [onPlacedDecorationRemove]);

  const handleDecorationRemove = useCallback(
    (decorationId: CatDecorationId) => {
      setOpenRoomItemMenu(null);
      onPlacedDecorationRemove?.(decorationId);
    },
    [onPlacedDecorationRemove],
  );

  const handleBedTap = useCallback(() => {
    if (!onBedRemove) return;
    setOpenRoomItemMenu((current) =>
      current?.kind === "bed" ? null : { kind: "bed" },
    );
  }, [onBedRemove]);

  const handleBedRemove = useCallback(() => {
    setOpenRoomItemMenu(null);
    onBedRemove?.();
  }, [onBedRemove]);

  const handleToyTap = useCallback(
    (toyId: CatToyId) => {
      if (!onPlacedToyRemove) return;
      setOpenRoomItemMenu((current) =>
        current?.kind === "toy" && current.id === toyId
          ? null
          : { kind: "toy", id: toyId },
      );
    },
    [onPlacedToyRemove],
  );

  const handleToyRemove = useCallback(
    (toyId: CatToyId) => {
      setOpenRoomItemMenu(null);
      onPlacedToyRemove?.(toyId);
    },
    [onPlacedToyRemove],
  );

  const petCluster = (
    <View
      style={[
        compact ? styles.petCenterSlot : styles.avatarCluster,
        !compact && { width: petDisplayWidth },
      ]}
    >
      {speechMessage ? (
        <View style={compact ? styles.speechAbovePet : styles.speechAnchor}>
          <PetSpeechBubble message={speechMessage} />
        </View>
      ) : null}
      <PetDisplay
        petType={petType}
        catSkinId={catSkinId}
        playback={playback}
        width={displayWidth}
        transparentBackground={usesSprite}
        onPress={compact && usesSprite ? undefined : onPetPress}
        onAnimationComplete={onAnimationComplete}
        onStepComplete={onStepComplete}
      />
    </View>
  );

  const roomPetLayer =
    compact && usesSprite ? (
      <DraggableRoomPet
        petSize={displayWidth}
        initialOffset={roomPetOffset}
        onOffsetChange={onRoomPetOffsetChange}
        onPetTap={onPetPress}
        layerZIndex={4}
      >
        {petCluster}
      </DraggableRoomPet>
    ) : (
      <View style={styles.petStack}>{petCluster}</View>
    );

  const roomBedLayer =
    compact && usesSprite && bedSource ? (
      <DraggableRoomPet
        petSize={bedSize}
        initialOffset={roomBedOffset ?? { x: -0.15, y: 0.3 }}
        onOffsetChange={onRoomBedOffsetChange}
        onPetTap={onBedRemove ? handleBedTap : undefined}
        layerZIndex={openRoomItemMenu?.kind === "bed" ? 10 : 1}
      >
        {openRoomItemMenu?.kind === "bed" && onBedRemove ? (
          <RoomItemActionMenu
            label={removeMenuLabel}
            onPress={handleBedRemove}
          />
        ) : null}
        <Image
          source={bedSource}
          style={{ width: bedSize, height: bedSize }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </DraggableRoomPet>
    ) : null;

  const roomDecorationLayers = roomPlacedDecorations.map((placed) => {
    const decorationId = placed.decorationId as CatDecorationId;
    const decorationSize = moderateScale(getDecorationDragSize(decorationId));
    const isMenuOpen =
      openRoomItemMenu?.kind === "decoration" &&
      openRoomItemMenu.id === decorationId;

    return (
      <DraggableRoomPet
        key={decorationId}
        petSize={decorationSize}
        initialOffset={placed.offset}
        onOffsetChange={(offset) =>
          onPlacedDecorationOffsetChange?.(decorationId, offset)
        }
        onPetTap={
          onPlacedDecorationRemove
            ? () => handleDecorationTap(decorationId)
            : undefined
        }
        layerZIndex={isMenuOpen ? 10 : 2}
      >
        {isMenuOpen && onPlacedDecorationRemove ? (
          <RoomItemActionMenu
            label={removeMenuLabel}
            onPress={() => handleDecorationRemove(decorationId)}
          />
        ) : null}
        <DecorationSpriteImage
          decorationId={decorationId}
          size={decorationSize}
        />
      </DraggableRoomPet>
    );
  });

  const roomToyLayers = roomPlacedToys.map((placed) => {
    const toyId = placed.toyId as CatToyId;
    const toySize = moderateScale(getToyDisplaySize(toyId));
    const isMenuOpen =
      openRoomItemMenu?.kind === "toy" && openRoomItemMenu.id === toyId;

    return (
      <DraggableRoomPet
        key={toyId}
        petSize={toySize}
        initialOffset={placed.offset}
        onOffsetChange={(offset) => onPlacedToyOffsetChange?.(toyId, offset)}
        onPetTap={
          onPlacedToyRemove ? () => handleToyTap(toyId) : undefined
        }
        layerZIndex={isMenuOpen ? 10 : 3}
      >
        {isMenuOpen && onPlacedToyRemove ? (
          <RoomItemActionMenu
            label={removeMenuLabel}
            onPress={() => handleToyRemove(toyId)}
          />
        ) : null}
        <ToySpriteImage toyId={toyId} size={toySize} />
      </DraggableRoomPet>
    );
  });

  return (
    <View style={[styles.stage, compact && styles.stageCompact]}>
      {!compact ? (
        <View style={styles.nameHeader}>
          <Text style={styles.nameText}>{name}</Text>
          <Text style={styles.levelText}>
            {t("pet.level", { level: stats.level })}
          </Text>
        </View>
      ) : null}

      <View style={styles.petColumnMeasure} onLayout={handleAvatarLayout}>
        <View style={[styles.petColumn, compact && styles.petColumnCompact]}>
          <View
            style={[
              styles.avatarWrap,
              compact && styles.avatarWrapCompact,
              openRoomItemMenu && styles.avatarWrapMenuOpen,
            ]}
          >
            {usesSprite ? <PetRoomBackground roomId={roomId} /> : null}
            {roomBedLayer}
            {roomDecorationLayers}
            {roomToyLayers}
            {openRoomItemMenu ? (
              <Pressable
                style={styles.menuBackdrop}
                onPress={() => setOpenRoomItemMenu(null)}
                accessibilityRole="button"
                accessibilityLabel={t("home.dismissRoomItemMenu")}
              />
            ) : null}
            {compact ? roomPetLayer : petCluster}
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
            <StatBar
              emoji="🧠"
              label={t("pet.wisdom")}
              value={wisdom}
              color={GameColors.wisdom}
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
    borderRadius: moderateScale(16),
    paddingTop: moderateScale(12),
    paddingBottom: moderateScale(10),
    paddingHorizontal: moderateScale(12),
  },
  nameHeader: {
    alignItems: "center",
    gap: moderateScale(2),
  },
  nameText: {
    fontSize: moderateScale(22),
    fontWeight: "700",
    color: GameColors.text,
  },
  levelText: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: GameColors.textMuted,
    marginTop: 2,
  },
  petColumnMeasure: {
    width: "100%",
    flex: 1,
  },
  petColumn: {
    width: "100%",
    alignItems: "center",
    gap: moderateScale(8),
  },
  petColumnCompact: {
    flex: 1,
    paddingBottom: moderateScale(2),
  },
  avatarWrap: {
    minHeight: moderateScale(120),
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  avatarWrapCompact: {
    flex: 1,
    minHeight: moderateScale(260),
    borderRadius: moderateScale(12),
    overflow: "visible",
  },
  avatarWrapMenuOpen: {
    overflow: "visible",
    zIndex: 1,
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
  },
  petStack: {
    width: "100%",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  petCenterSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
  speechAbovePet: {
    position: "absolute",
    bottom: "85%",
    left: moderateScale(30),
    alignItems: "flex-start",
    zIndex: 2,
  },
  avatarCluster: {
    position: "relative",
    alignItems: "center",
  },
  speechAnchor: {
    position: "absolute",
    bottom: "62%",
    left: moderateScale(20),
    alignItems: "flex-start",
    zIndex: 2,
  },
  stats: {
    width: "100%",
    gap: moderateScale(12),
  },
  statsCompact: {
    flexShrink: 0,
    gap: moderateScale(5),
    paddingTop: moderateScale(6),
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
