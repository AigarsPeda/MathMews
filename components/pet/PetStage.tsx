import { DecorationSpriteImage } from "@/components/pet/DecorationSpriteImage";
import { DraggableRoomPet } from "@/components/pet/DraggableRoomPet";
import { PetRoomBackground } from "@/components/pet/PetRoomBackground";
import { PetSpeechBubble } from "@/components/pet/PetSpeechBubble";
import type { RoomItemMenuAction } from "@/components/pet/RoomItemActionMenu";
import { RoomItemActionMenu } from "@/components/pet/RoomItemActionMenu";
import type {
  RoomMenuAnchorRect,
  RoomMenuBounds,
} from "@/components/pet/room-menu-types";
import { ToySpriteImage } from "@/components/pet/ToySpriteImage";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { getBedDisplaySize, getCatBedSource } from "@/constants/cat-beds";
import type { CatDecorationId } from "@/constants/cat-decorations";
import { isPosterDecorationId } from "@/constants/cat-decorations";
import { resolveSpriteDisplaySize } from "@/constants/cat-sprites";
import type { CatToyId } from "@/constants/cat-toys";
import { getToyDisplaySize } from "@/constants/cat-toys";
import {
  canFlipWallDecoration,
  canRotateDecoration,
  canScaleDecorationDown,
  canScaleDecorationUp,
  getPlacedDecorationDragSize,
  getPlacedDecorationHitSize,
  getPlacedDecorationScale,
  getPlacedDecorationSpriteId,
  getPlacedDecorationWallFlipped,
  usesStyleVariantMenu,
} from "@/constants/decoration-variants";
import { GameColors } from "@/constants/game";
import { USE_CAT_SPRITE_PETS } from "@/constants/pet-display";
import { PetDisplay } from "@/pet-display/components/PetDisplay";
import type { PetPlaybackState } from "@/pet-display/types";
import type {
  PetStats,
  PetType,
  PlacedDecoration,
  PlacedToy,
  RoomItemOffset,
  RoomLayerItem,
} from "@/types/game";
import { nestedBorderRadius } from "@/utils/border-radius";
import { clampStat } from "@/utils/pet-care";
import {
  canMoveRoomLayerItem,
  getRoomLayerZIndex,
  isSameRoomLayerItem,
  normalizeRoomLayerOrder,
  roomLayerItemKey,
  ROOM_MENU_BACKDROP_Z_INDEX,
  ROOM_MENU_OPEN_Z_INDEX,
  ROOM_PET_LAYER_Z_INDEX,
} from "@/utils/room-layer-order";
import { moderateScale } from "@/utils/scale";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

const COMPACT_STAGE_RADIUS = moderateScale(16);
const COMPACT_STAGE_INSET = moderateScale(12);
const COMPACT_ROOM_RADIUS = nestedBorderRadius(
  COMPACT_STAGE_RADIUS,
  COMPACT_STAGE_INSET,
);
const COMPACT_PET_MIN = 200;
const COMPACT_PET_MAX = 300;
const COMPACT_SPRITE_PET_SIZE = 96;

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
  roomLayerOrder?: RoomLayerItem[];
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
  onRotatePlacedDecoration?: (decorationId: CatDecorationId) => void;
  onFlipPlacedDecorationWall?: (decorationId: CatDecorationId) => void;
  onScalePlacedDecoration?: (
    decorationId: CatDecorationId,
    direction: "up" | "down",
  ) => void;
  onMoveRoomLayerItem?: (item: RoomLayerItem, direction: "up" | "down") => void;
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

type RoomItemMenu = RoomLayerItem;

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
  roomLayerOrder,
  speechMessage,
  playback,
  compact = false,
  onPetPress,
  onRoomPetOffsetChange,
  onRoomBedOffsetChange,
  onPlacedToyOffsetChange,
  onPlacedDecorationOffsetChange,
  onPlacedDecorationRemove,
  onRotatePlacedDecoration,
  onFlipPlacedDecorationWall,
  onScalePlacedDecoration,
  onMoveRoomLayerItem,
  onBedRemove,
  onPlacedToyRemove,
  onAnimationComplete,
  onStepComplete,
}: PetStageProps) {
  const { t } = useTranslation();
  const usesSprite = USE_CAT_SPRITE_PETS && petType === "cat";
  const bedSize = moderateScale(getBedDisplaySize(bedId));
  const bedSource = usesSprite ? getCatBedSource(bedId) : undefined;
  const roomPlacedToys = usesSprite ? (placedToys ?? []) : [];
  const roomPlacedDecorations = usesSprite ? (placedDecorations ?? []) : [];
  const layerOrder = normalizeRoomLayerOrder({
    bedId,
    placedDecorations: roomPlacedDecorations,
    placedToys: roomPlacedToys,
    roomLayerOrder,
  });
  const [openRoomItemMenu, setOpenRoomItemMenu] = useState<RoomItemMenu | null>(
    null,
  );
  const avatarWrapRef = useRef<View>(null);
  const [roomMenuBounds, setRoomMenuBounds] = useState<RoomMenuBounds | null>(
    null,
  );
  const [menuAnchorRect, setMenuAnchorRect] = useState<RoomMenuAnchorRect | null>(
    null,
  );
  const itemAnchorRectsRef = useRef<Map<string, RoomMenuAnchorRect>>(new Map());
  const closeMenu = useCallback(() => {
    setOpenRoomItemMenu(null);
    setMenuAnchorRect(null);
  }, []);
  const measureRoomMenuBounds = useCallback(() => {
    avatarWrapRef.current?.measureInWindow((pageX, pageY, width, height) => {
      setRoomMenuBounds({ pageX, pageY, width, height });
    });
  }, []);
  useEffect(() => {
    if (!openRoomItemMenu) {
      setMenuAnchorRect(null);
      return;
    }
    measureRoomMenuBounds();
  }, [measureRoomMenuBounds, openRoomItemMenu]);
  const removeMenuLabel = t("home.removeFromRoom");
  const moveUpLabel = t("home.moveLayerUp");
  const moveDownLabel = t("home.moveLayerDown");
  const rotateLabel = t("home.rotateItem");
  const flipWallLabel = t("home.flipWall");
  const changeLookLabel = t("home.changeLook");
  const biggerLabel = t("home.makeBigger");
  const smallerLabel = t("home.makeSmaller");
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

  const canManageRoomItem = useCallback(
    (item: RoomLayerItem) => {
      if (item.kind === "bed") {
        return Boolean(onBedRemove || onMoveRoomLayerItem);
      }
      if (item.kind === "decoration") {
        return Boolean(
          onPlacedDecorationRemove ||
          onMoveRoomLayerItem ||
          onRotatePlacedDecoration ||
          onFlipPlacedDecorationWall ||
          onScalePlacedDecoration,
        );
      }
      return Boolean(onPlacedToyRemove || onMoveRoomLayerItem);
    },
    [
      onBedRemove,
      onMoveRoomLayerItem,
      onPlacedDecorationRemove,
      onPlacedToyRemove,
      onRotatePlacedDecoration,
      onFlipPlacedDecorationWall,
      onScalePlacedDecoration,
    ],
  );

  const buildRoomItemMenuActions = useCallback(
    (item: RoomLayerItem) => {
      const actions: RoomItemMenuAction[] = [];

      if (onMoveRoomLayerItem) {
        actions.push({
          label: moveUpLabel,
          icon: "north",
          onPress: () => {
            onMoveRoomLayerItem(item, "up");
          },
          disabled: !canMoveRoomLayerItem(layerOrder, item, "up"),
        });
        actions.push({
          label: moveDownLabel,
          icon: "south",
          onPress: () => {
            onMoveRoomLayerItem(item, "down");
          },
          disabled: !canMoveRoomLayerItem(layerOrder, item, "down"),
        });
      }

      if (item.kind === "decoration") {
        const decorationId = item.decorationId as CatDecorationId;
        const placed = roomPlacedDecorations.find(
          (entry) => entry.decorationId === decorationId,
        );

        const isPoster = isPosterDecorationId(decorationId);

        if (
          onFlipPlacedDecorationWall &&
          canFlipWallDecoration(decorationId) &&
          !isPoster
        ) {
          actions.push({
            label: flipWallLabel,
            icon: "rotate-right",
            onPress: () => {
              onFlipPlacedDecorationWall(decorationId);
            },
          });
        }

        if (onRotatePlacedDecoration && canRotateDecoration(decorationId)) {
          const styleVariant = usesStyleVariantMenu(decorationId);
          actions.push({
            label: isPoster
              ? flipWallLabel
              : styleVariant
                ? changeLookLabel
                : rotateLabel,
            icon: styleVariant && !isPoster ? "style" : "rotate-right",
            onPress: () => {
              onRotatePlacedDecoration(decorationId);
            },
          });
        }

        if (onScalePlacedDecoration && placed) {
          const scale = getPlacedDecorationScale(placed);
          actions.push({
            label: biggerLabel,
            icon: "zoom-in",
            onPress: () => {
              onScalePlacedDecoration(decorationId, "up");
            },
            disabled: !canScaleDecorationUp(scale),
          });
          actions.push({
            label: smallerLabel,
            icon: "zoom-out",
            onPress: () => {
              onScalePlacedDecoration(decorationId, "down");
            },
            disabled: !canScaleDecorationDown(scale),
          });
        }
      }

      if (item.kind === "bed" && onBedRemove) {
        actions.push({
          label: removeMenuLabel,
          icon: "delete-outline",
          onPress: () => {
            closeMenu();
            onBedRemove();
          },
          destructive: true,
        });
      }

      if (item.kind === "decoration" && onPlacedDecorationRemove) {
        actions.push({
          label: removeMenuLabel,
          icon: "delete-outline",
          onPress: () => {
            closeMenu();
            onPlacedDecorationRemove(item.decorationId as CatDecorationId);
          },
          destructive: true,
        });
      }

      if (item.kind === "toy" && onPlacedToyRemove) {
        actions.push({
          label: removeMenuLabel,
          icon: "delete-outline",
          onPress: () => {
            closeMenu();
            onPlacedToyRemove(item.toyId as CatToyId);
          },
          destructive: true,
        });
      }

      return actions;
    },
    [
      changeLookLabel,
      flipWallLabel,
      biggerLabel,
      closeMenu,
      layerOrder,
      moveDownLabel,
      moveUpLabel,
      onBedRemove,
      onMoveRoomLayerItem,
      onPlacedDecorationRemove,
      onPlacedToyRemove,
      onFlipPlacedDecorationWall,
      onRotatePlacedDecoration,
      onScalePlacedDecoration,
      removeMenuLabel,
      roomPlacedDecorations,
      rotateLabel,
      smallerLabel,
    ],
  );

  const handleRoomItemTap = useCallback(
    (item: RoomLayerItem) => {
      if (!canManageRoomItem(item)) return;

      if (
        openRoomItemMenu &&
        isSameRoomLayerItem(openRoomItemMenu, item)
      ) {
        closeMenu();
        return;
      }

      setMenuAnchorRect(
        itemAnchorRectsRef.current.get(roomLayerItemKey(item)) ?? null,
      );
      measureRoomMenuBounds();
      setOpenRoomItemMenu(item);
    },
    [canManageRoomItem, closeMenu, measureRoomMenuBounds, openRoomItemMenu],
  );

  const handleItemAnchorLayout = useCallback(
    (item: RoomLayerItem, rect: RoomMenuAnchorRect) => {
      itemAnchorRectsRef.current.set(roomLayerItemKey(item), rect);

      if (
        openRoomItemMenu &&
        isSameRoomLayerItem(openRoomItemMenu, item)
      ) {
        setMenuAnchorRect(rect);
      }
    },
    [openRoomItemMenu],
  );

  const roomItemDragProps = useCallback(
    (item: RoomLayerItem, layerZIndex: number) => {
      const manageable = canManageRoomItem(item);
      return {
        layerZIndex,
        onPetTap: manageable ? () => handleRoomItemTap(item) : undefined,
        onMenuAnchorLayout: manageable
          ? (rect: RoomMenuAnchorRect) => handleItemAnchorLayout(item, rect)
          : undefined,
      };
    },
    [canManageRoomItem, handleItemAnchorLayout, handleRoomItemTap],
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
        layerZIndex={ROOM_PET_LAYER_Z_INDEX}
      >
        {petCluster}
      </DraggableRoomPet>
    ) : (
      <View style={styles.petStack}>{petCluster}</View>
    );

  const roomItemLayers = layerOrder.map((item, layerIndex) => {
    const isMenuOpen = Boolean(
      openRoomItemMenu && isSameRoomLayerItem(openRoomItemMenu, item),
    );
    const layerZIndex = getRoomLayerZIndex(layerIndex, isMenuOpen);

    if (item.kind === "bed") {
      if (!compact || !usesSprite || !bedSource) return null;

      return (
        <DraggableRoomPet
          key="bed"
          petSize={bedSize}
          initialOffset={roomBedOffset ?? { x: -0.15, y: 0.3 }}
          onOffsetChange={onRoomBedOffsetChange}
          {...roomItemDragProps(item, layerZIndex)}
        >
          <Image
            source={bedSource}
            style={{ width: bedSize, height: bedSize }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </DraggableRoomPet>
      );
    }

    if (item.kind === "decoration") {
      const decorationId = item.decorationId as CatDecorationId;
      const placed = roomPlacedDecorations.find(
        (entry) => entry.decorationId === decorationId,
      );
      if (!placed) return null;

      const spriteId = getPlacedDecorationSpriteId(placed);
      const decorationSize = moderateScale(getPlacedDecorationDragSize(placed));
      const hitSize = moderateScale(getPlacedDecorationHitSize(placed));

      return (
        <DraggableRoomPet
          key={`decoration:${decorationId}`}
          petSize={decorationSize}
          hitSize={hitSize}
          initialOffset={placed.offset}
          onOffsetChange={(offset) =>
            onPlacedDecorationOffsetChange?.(decorationId, offset)
          }
          {...roomItemDragProps(item, layerZIndex)}
        >
          <DecorationSpriteImage
            decorationId={spriteId}
            size={decorationSize}
            flipHorizontal={getPlacedDecorationWallFlipped(placed)}
          />
        </DraggableRoomPet>
      );
    }

    const toyId = item.toyId as CatToyId;
    const placed = roomPlacedToys.find((entry) => entry.toyId === toyId);
    if (!placed) return null;

    const toySize = moderateScale(getToyDisplaySize(toyId));

    return (
      <DraggableRoomPet
        key={`toy:${toyId}`}
        petSize={toySize}
        initialOffset={placed.offset}
        onOffsetChange={(offset) => onPlacedToyOffsetChange?.(toyId, offset)}
        {...roomItemDragProps(item, layerZIndex)}
      >
        <ToySpriteImage toyId={toyId} size={toySize} />
      </DraggableRoomPet>
    );
  });

  const activeMenuActions = openRoomItemMenu
    ? buildRoomItemMenuActions(openRoomItemMenu)
    : [];
  const isMenuReady = Boolean(
    openRoomItemMenu &&
      menuAnchorRect &&
      roomMenuBounds &&
      activeMenuActions.length > 0,
  );
  const readyMenuAnchor = isMenuReady ? menuAnchorRect : null;
  const readyRoomBounds = isMenuReady ? roomMenuBounds : null;

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
            ref={avatarWrapRef}
            onLayout={measureRoomMenuBounds}
            style={[
              styles.avatarWrap,
              compact && styles.avatarWrapCompact,
              openRoomItemMenu && styles.avatarWrapMenuOpen,
            ]}
          >
            {usesSprite ? (
              <PetRoomBackground
                roomId={roomId}
                cornerRadius={compact ? COMPACT_ROOM_RADIUS : 0}
              />
            ) : null}
            {roomItemLayers}
            {isMenuReady ? (
              <Pressable
                style={styles.menuBackdrop}
                onPress={closeMenu}
                accessibilityRole="button"
                accessibilityLabel={t("home.dismissRoomItemMenu")}
              />
            ) : null}
            {readyMenuAnchor && readyRoomBounds ? (
              <View style={styles.floatingMenuLayer} pointerEvents="box-none">
                <RoomItemActionMenu
                  actions={activeMenuActions}
                  anchorRect={readyMenuAnchor}
                  roomBounds={readyRoomBounds}
                />
              </View>
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
    borderRadius: COMPACT_STAGE_RADIUS,
    paddingTop: COMPACT_STAGE_INSET,
    paddingBottom: moderateScale(10),
    paddingHorizontal: COMPACT_STAGE_INSET,
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
    borderRadius: COMPACT_ROOM_RADIUS,
    overflow: "hidden",
  },
  avatarWrapMenuOpen: {
    overflow: "visible",
    zIndex: 1,
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: ROOM_MENU_BACKDROP_Z_INDEX,
  },
  floatingMenuLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: ROOM_MENU_OPEN_Z_INDEX + 1,
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
