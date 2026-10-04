import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { buildRoomActivity, type RoomActivityKind } from "@/utils/room-activities";
import { createRoomActivitySegment } from "@/pet-display/registry/cat-sprite-registry";
import { useRoomActivity } from "@/hooks/use-room-activity";
import { getPetMediaRegistry } from "@/pet-display/registry/dog-video-registry";
import { isAirConditionerDecorationId } from "@/constants/decoration-motion";
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
import { MathStatsChip } from "@/components/puzzle/MathStatsChip";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { getBedDisplaySize, getCatBedSource, canFlipBed, canScaleBedDown, canScaleBedUp, getEquippedBedScale } from "@/constants/cat-beds";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import {
  Image,
  PanResponder,
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
const COMPACT_SPRITE_PET_SIZE = 120;
const SPEECH_TAIL_X = moderateScale(23);
const SPEECH_ANCHOR_X = moderateScale(30) + SPEECH_TAIL_X;

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
  bedFlipped?: boolean;
  bedScale?: number;
  placedToys?: PlacedToy[];
  placedDecorations?: PlacedDecoration[];
  roomLayerOrder?: RoomLayerItem[];
  ownedToyIds?: string[];
  lastInteractionAt?: number;
  roomActivityBlocked?: boolean;
  onRoomInteraction?: () => void;
  onRoomActivityChange?: (active: boolean, returnHome: () => void) => void;
  speechMessage?: string | null;
  playback: PetPlaybackState;
  compact?: boolean;
  onPetPress?: () => void;
  onRoomPetOffsetChange?: (offset: { x: number; y: number }) => void;
  onRoomBedOffsetChange?: (offset: { x: number; y: number }) => void;
  onPlacedToyOffsetChange?: (instanceId: string, offset: RoomItemOffset) => void;
  onPlacedDecorationOffsetChange?: (
    instanceId: string,
    offset: RoomItemOffset,
  ) => void;
  onPlacedDecorationRemove?: (instanceId: string) => void;
  onRotatePlacedDecoration?: (instanceId: string) => void;
  onFlipPlacedDecorationWall?: (instanceId: string) => void;
  onTogglePlacedAirConditioner?: (instanceId: string) => void;
  onScalePlacedDecoration?: (
    instanceId: string,
    direction: "up" | "down",
  ) => void;
  onMoveRoomLayerItem?: (item: RoomLayerItem, direction: "up" | "down") => void;
  onBedRemove?: () => void;
  onFlipBed?: () => void;
  onScaleBed?: (direction: "up" | "down") => void;
  onPlacedToyRemove?: (instanceId: string) => void;
  onOpenMathStats?: () => void;
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
  bedFlipped,
  bedScale,
  placedToys,
  placedDecorations,
  roomLayerOrder,
  ownedToyIds,
  lastInteractionAt,
  roomActivityBlocked = false,
  onRoomInteraction,
  onRoomActivityChange,
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
  onTogglePlacedAirConditioner,
  onScalePlacedDecoration,
  onMoveRoomLayerItem,
  onBedRemove,
  onFlipBed,
  onScaleBed,
  onPlacedToyRemove,
  onOpenMathStats,
  onAnimationComplete,
  onStepComplete,
}: PetStageProps) {
  const { t } = useTranslation();
  const usesSprite = USE_CAT_SPRITE_PETS && petType === "cat";
  const [zoom, setZoom] = useState(1);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const reduceMotion = useReducedMotion();
  const bedScaleMultiplier = getEquippedBedScale(bedScale);
  const bedSize = moderateScale(getBedDisplaySize(bedId) * bedScaleMultiplier);
  const bedSource = usesSprite ? getCatBedSource(bedId) : undefined;
  const roomPlacedToys = usesSprite ? (placedToys ?? []) : [];
  const roomPlacedDecorations = useMemo(
    () => usesSprite ? (placedDecorations ?? []) : [],
    [placedDecorations, usesSprite],
  );
  const airConditionerOn = roomPlacedDecorations.some(
    placed => isAirConditionerDecorationId(placed.decorationId) && placed.poweredOn,
  );
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
      return;
    }
    measureRoomMenuBounds();
  }, [measureRoomMenuBounds, openRoomItemMenu]);
  const removeMenuLabel = t("home.removeFromRoom");
  const moveUpLabel = t("home.moveLayerUp");
  const moveDownLabel = t("home.moveLayerDown");
  const rotateLabel = t("home.rotateItem");
  const flipWallLabel = t("home.flipWall");
  const flipBedLabel = t("home.flipBed");
  const changeLookLabel = t("home.changeLook");
  const biggerLabel = t("home.makeBigger");
  const smallerLabel = t("home.makeSmaller");
  const [avatarWidth, setAvatarWidth] = useState(
    compactPetWidth(petType, compact),
  );
  const [decorating, setDecorating] = useState(false);
  const [catCommandsOpen, setCatCommandsOpen] = useState(false);
  const displayWidth = usesSprite
    ? resolveSpriteDisplaySize(avatarWidth)
    : avatarWidth;
  const sceneX = useSharedValue(0);
  const sceneY = useSharedValue(0);
  const sceneScale = useSharedValue(1);
  const petSceneX = useSharedValue(0);
  const petSceneY = useSharedValue(0);
  const speechHeight = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const hungry = stats.hunger < 30;
  const asleep = playback.kind === "segment" && playback.mood === "sleeping";
  const activityOptions = useMemo(() => ({
    width: viewport.width, height: viewport.height, petSize: displayWidth,
    sizeScale: moderateScale(100) / 100,
    homeOffset: roomPetOffset ?? { x: 0, y: 0.12 },
    decorations: roomPlacedDecorations,
    toys: placedToys ?? [], ownedToyIds: ownedToyIds ?? [],
    hungry, asleep,
  }), [displayWidth, ownedToyIds, placedToys, asleep, hungry, roomPetOffset, roomPlacedDecorations, viewport.height, viewport.width]);
  const { activity: roomActivity, scale: activityScale, facing: activityFacing,
    objectX, objectY, objectRotation, startActivity, returnHome } = useRoomActivity(activityOptions,
    compact && usesSprite && !decorating && zoom === 1 && !roomActivityBlocked,
    lastInteractionAt, petSceneX, petSceneY);
  useEffect(() => {
    onRoomActivityChange?.(Boolean(roomActivity), returnHome);
  }, [onRoomActivityChange, roomActivity, returnHome]);
  const handleRoomTouch = useCallback(() => {
    if (roomActivity?.plan.kind === "returnHome") return;
    returnHome();
    onRoomInteraction?.();
  }, [onRoomInteraction, returnHome, roomActivity]);
  const handleCatTap = useCallback(() => {
    if (roomActivity) returnHome();
    else onPetPress?.();
  }, [onPetPress, returnHome, roomActivity]);
  const activityPlayback = useMemo<PetPlaybackState | null>(() => {
    const step = roomActivity?.plan.steps[roomActivity.stepIndex];
    if (!step) return null;
    const registry = getPetMediaRegistry("cat", { catSkinId });
    return { kind: "segment", mood: step.mood, segment: step.animation ? createRoomActivitySegment(catSkinId, step.animation, step.reverse) : registry.getSegment(step.mood) };
  }, [catSkinId, roomActivity]);
  const catActivityStyle = useAnimatedStyle(() => ({
    transform: [{ scale: activityScale.get() }, { scaleX: activityFacing.get() }],
  }));
  const transientMouseStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: objectX.get() }, { translateY: objectY.get() }],
  }));
  const objectRotationStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${objectRotation.get()}deg` }] }));
  const visibleSpeech = roomActivity || decorating ? null : speechMessage;
  const maxPanX = Math.max(0, (zoom - 1) * viewport.width / 2);
  const maxPanY = Math.max(0, (zoom - 1) * viewport.height / 2);
  useEffect(() => {
    const focusX = (roomPetOffset?.x ?? 0) * Math.max(0, (viewport.width-displayWidth)/2);
    const focusY = (roomPetOffset?.y ?? .12) * Math.max(0, (viewport.height-displayWidth)/2);
    const duration = reduceMotion ? 0 : 220;
    sceneX.set(withTiming(Math.max(-maxPanX, Math.min(maxPanX, -focusX * zoom)), { duration }));
    sceneY.set(withTiming(Math.max(-maxPanY, Math.min(maxPanY, -focusY * zoom)), { duration }));
    sceneScale.set(withTiming(zoom, { duration }));
  }, [displayWidth, maxPanX, maxPanY, reduceMotion, roomPetOffset?.x, roomPetOffset?.y, sceneScale, sceneX, sceneY, viewport.height, viewport.width, zoom]);
  // Capture moves above the item's JS responders. Using another native gesture
  // recognizer here lets those responders cancel the pan before it can start.
  const panRoom = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) =>
      compact && usesSprite && zoom > 1 && Math.hypot(gesture.dx, gesture.dy) > 6,
    onPanResponderGrant: () => {
      panStartX.set(sceneX.get());
      panStartY.set(sceneY.get());
    },
    onPanResponderMove: (_, gesture) => {
      sceneX.set(Math.max(-maxPanX, Math.min(maxPanX, panStartX.get() + gesture.dx)));
      sceneY.set(Math.max(-maxPanY, Math.min(maxPanY, panStartY.get() + gesture.dy)));
    },
    onPanResponderTerminationRequest: () => false,
  }), [compact, maxPanX, maxPanY, panStartX, panStartY, sceneX, sceneY, usesSprite, zoom]);
  const sceneZoomStyle = useAnimatedStyle(() => {
    return { transform: [
      { translateX: sceneX.get() },
      { translateY: sceneY.get() },
      { scale: sceneScale.get() },
    ] };
  });
  const handlePetPositionChange = useCallback((position: { x: number; y: number }) => {
    if (roomActivity) return;
    petSceneX.set(position.x);
    petSceneY.set(position.y);
  }, [petSceneX, petSceneY, roomActivity]);
  const handleSpeechLayout = useCallback((event: LayoutChangeEvent) => {
    speechHeight.set(event.nativeEvent.layout.height);
  }, [speechHeight]);
  const speechPositionStyle = useAnimatedStyle(() => ({
    // Project the tail into the viewport; keep the text at native screen size.
    opacity: speechHeight.get() > 0 ? 1 : 0,
    transform: [
      { translateX: viewport.width / 2 + sceneX.get() +
        (petSceneX.get() - displayWidth / 2 + SPEECH_ANCHOR_X) * sceneScale.get() - SPEECH_TAIL_X },
      { translateY: viewport.height / 2 + sceneY.get() +
        (petSceneY.get() - displayWidth * .2) * sceneScale.get() - speechHeight.get() },
    ],
  }));
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
      if (zoom !== 1) return false;
      if (!decorating) return item.kind === "decoration" && isAirConditionerDecorationId(item.decorationId) && Boolean(onTogglePlacedAirConditioner);
      if (item.kind === "bed") {
        return Boolean(
          onBedRemove || onMoveRoomLayerItem || onFlipBed || onScaleBed,
        );
      }
      if (item.kind === "decoration") {
        return Boolean(
          onPlacedDecorationRemove ||
          onMoveRoomLayerItem ||
          onRotatePlacedDecoration ||
          onFlipPlacedDecorationWall ||
          onScalePlacedDecoration ||
          (onTogglePlacedAirConditioner && isAirConditionerDecorationId(item.decorationId)),
        );
      }
      return Boolean(onPlacedToyRemove || onMoveRoomLayerItem);
    },
    [
      zoom,
      decorating,
      onBedRemove,
      onFlipBed,
      onScaleBed,
      onMoveRoomLayerItem,
      onPlacedDecorationRemove,
      onPlacedToyRemove,
      onRotatePlacedDecoration,
      onFlipPlacedDecorationWall,
      onScalePlacedDecoration,
      onTogglePlacedAirConditioner,
    ],
  );

  const buildRoomItemMenuActions = useCallback(
    (item: RoomLayerItem) => {
      const actions: RoomItemMenuAction[] = [];
      if (!decorating) {
        if (item.kind !== "decoration" || !isAirConditionerDecorationId(item.decorationId) || !onTogglePlacedAirConditioner) return actions;
        const placed = roomPlacedDecorations.find(entry => entry.instanceId === item.instanceId);
        if (placed) actions.push({
          label: t(placed.poweredOn ? "home.turnOffAirConditioner" : "home.turnOnAirConditioner"),
          icon: "power-settings-new",
          onPress: () => onTogglePlacedAirConditioner(item.instanceId),
        });
        return actions;
      }

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
          (entry) => entry.instanceId === item.instanceId,
        );
        if (!placed) return actions;

        if (onTogglePlacedAirConditioner && isAirConditionerDecorationId(decorationId)) {
          actions.unshift({
            label: t(placed.poweredOn ? "home.turnOffAirConditioner" : "home.turnOnAirConditioner"),
            icon: "power-settings-new",
            onPress: () => onTogglePlacedAirConditioner(item.instanceId),
          });
        }

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
              onFlipPlacedDecorationWall(item.instanceId);
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
              onRotatePlacedDecoration(item.instanceId);
            },
          });
        }

        if (onScalePlacedDecoration) {
          const scale = getPlacedDecorationScale(placed);
          actions.push({
            label: biggerLabel,
            icon: "zoom-in",
            onPress: () => {
              onScalePlacedDecoration(item.instanceId, "up");
            },
            disabled: !canScaleDecorationUp(scale),
          });
          actions.push({
            label: smallerLabel,
            icon: "zoom-out",
            onPress: () => {
              onScalePlacedDecoration(item.instanceId, "down");
            },
            disabled: !canScaleDecorationDown(scale),
          });
        }
      }

      if (item.kind === "bed" && onFlipBed && canFlipBed(bedId)) {
        actions.push({
          label: flipBedLabel,
          icon: "rotate-right",
          onPress: () => {
            onFlipBed();
          },
        });
      }

      if (item.kind === "bed" && onScaleBed && bedId) {
        const scale = getEquippedBedScale(bedScale);
        actions.push({
          label: biggerLabel,
          icon: "zoom-in",
          onPress: () => {
            onScaleBed("up");
          },
          disabled: !canScaleBedUp(scale),
        });
        actions.push({
          label: smallerLabel,
          icon: "zoom-out",
          onPress: () => {
            onScaleBed("down");
          },
          disabled: !canScaleBedDown(scale),
        });
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
            onPlacedDecorationRemove(item.instanceId);
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
            onPlacedToyRemove(item.instanceId);
          },
          destructive: true,
        });
      }

      return actions;
    },
    [
      bedId,
      bedScale,
      decorating,
      changeLookLabel,
      flipBedLabel,
      flipWallLabel,
      biggerLabel,
      closeMenu,
      layerOrder,
      moveDownLabel,
      moveUpLabel,
      onBedRemove,
      onFlipBed,
      onScaleBed,
      onMoveRoomLayerItem,
      onPlacedDecorationRemove,
      onPlacedToyRemove,
      onFlipPlacedDecorationWall,
      onRotatePlacedDecoration,
      onScalePlacedDecoration,
      onTogglePlacedAirConditioner,
      removeMenuLabel,
      roomPlacedDecorations,
      rotateLabel,
      smallerLabel,
      t,
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

      setCatCommandsOpen(false);
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
        allowDrag: decorating && zoom === 1,
        interactive: decorating || manageable,
        onPetTap: manageable ? () => handleRoomItemTap(item) : undefined,
        onMenuAnchorLayout: manageable
          ? (rect: RoomMenuAnchorRect) => handleItemAnchorLayout(item, rect)
          : undefined,
      };
    },
    [canManageRoomItem, decorating, handleItemAnchorLayout, handleRoomItemTap, zoom],
  );

  const petCluster = (
    <View
      style={[
        compact ? styles.petCenterSlot : styles.avatarCluster,
        !compact && { width: petDisplayWidth },
      ]}
    >
      {visibleSpeech && !(compact && usesSprite) ? (
        <View pointerEvents="none" style={compact ? styles.speechAbovePet : styles.speechAnchor}>
          <PetSpeechBubble message={visibleSpeech} />
        </View>
      ) : null}
      <Animated.View style={catActivityStyle}>
        <PetDisplay
          petType={petType}
          catSkinId={catSkinId}
          playback={activityPlayback ?? playback}
          loop={Boolean(roomActivity && roomActivity.plan.steps[roomActivity.stepIndex].animation !== "curlUp")}
          width={displayWidth}
          resolutionScale={3}
          transparentBackground={usesSprite}
          onPress={compact && usesSprite ? undefined : onPetPress}
          onAnimationComplete={roomActivity ? undefined : onAnimationComplete}
          onStepComplete={roomActivity ? undefined : onStepComplete}
        />
      </Animated.View>
    </View>
  );

  const roomPetLayer =
    compact && usesSprite ? (
      <DraggableRoomPet
        allowDrag={decorating && zoom === 1}
        animatedPosition={{ x: petSceneX, y: petSceneY }}
        petSize={displayWidth}
        hitSize={displayWidth * 0.65}
        initialOffset={roomPetOffset}
        onOffsetChange={zoom === 1 ? onRoomPetOffsetChange : undefined}
        onPositionChange={handlePetPositionChange}
        onPetTap={decorating ? undefined : handleCatTap}
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
            style={{
              width: bedSize,
              height: bedSize,
              transform: bedFlipped ? [{ scaleX: -1 }] : undefined,
            }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </DraggableRoomPet>
      );
    }

    if (item.kind === "decoration") {
      const placed = roomPlacedDecorations.find(
        (entry) => entry.instanceId === item.instanceId,
      );
      if (!placed) return null;

      const spriteId = getPlacedDecorationSpriteId(placed);
      const decorationSize = moderateScale(getPlacedDecorationDragSize(placed));
      const hitSize = moderateScale(getPlacedDecorationHitSize(placed));

      const playingDecoration = roomActivity?.plan.objectKind === "decoration" && roomActivity.plan.targetInstanceId === item.instanceId;
      return (
        <DraggableRoomPet
          animatedPosition={playingDecoration ? { x: objectX, y: objectY } : undefined}
          key={`decoration:${item.instanceId}`}
          petSize={decorationSize}
          hitSize={hitSize}
          initialOffset={placed.offset}
          onOffsetChange={(offset) =>
            onPlacedDecorationOffsetChange?.(item.instanceId, offset)
          }
          {...roomItemDragProps(item, layerZIndex)}
        >
          <Animated.View style={playingDecoration ? objectRotationStyle : undefined}>
          <DecorationSpriteImage
            decorationId={spriteId}
            size={decorationSize}
            flipHorizontal={getPlacedDecorationWallFlipped(placed)}
            roomMotion
            poweredOn={placed.poweredOn}
            breezy={airConditionerOn}
          />
          </Animated.View>
        </DraggableRoomPet>
      );
    }

    const placed = roomPlacedToys.find(
      (entry) => entry.instanceId === item.instanceId,
    );
    if (!placed) return null;

    const playingToy = roomActivity?.plan.objectKind === "toy" && roomActivity.plan.targetInstanceId === item.instanceId;
    const toyId = item.toyId as CatToyId;
    const toySize = moderateScale(getToyDisplaySize(toyId));

    return (
      <DraggableRoomPet
        key={`toy:${item.instanceId}`}
        animatedPosition={playingToy ? { x: objectX, y: objectY } : undefined}
        petSize={toySize}
        initialOffset={placed.offset}
        onOffsetChange={(offset) =>
          onPlacedToyOffsetChange?.(item.instanceId, offset)
        }
        {...roomItemDragProps(item, layerZIndex)}
      >
        <Animated.View style={playingToy ? objectRotationStyle : undefined}>
          <ToySpriteImage toyId={toyId} size={toySize} />
        </Animated.View>
      </DraggableRoomPet>
    );
  });

  const catCommandActions: RoomItemMenuAction[] = [];
  for (const kind of ["sofaSit", "sofaSleep", "toyPlay", "mouseChase"] as RoomActivityKind[]) {
    if (!buildRoomActivity(activityOptions, 0, kind)) continue;
    catCommandActions.push({
      label: t(`home.catCommands.${kind}`),
      icon: kind.startsWith("sofa") ? "weekend" : "sports-baseball",
      onPress: () => { setCatCommandsOpen(false); onRoomInteraction?.(); startActivity(kind); },
    });
  }
  if (roomActivity) catCommandActions.push({
    label: t("home.catCommands.returnHome"), icon: "home",
    onPress: () => { setCatCommandsOpen(false); handleRoomTouch(); },
  });
  else if (onPetPress) catCommandActions.unshift({
    label: t("home.pet"), icon: "pets",
    onPress: () => { setCatCommandsOpen(false); onPetPress(); },
  });
  const catMenuAnchor = roomMenuBounds ? {
    pageX: roomMenuBounds.pageX + roomMenuBounds.width - moderateScale(54),
    pageY: roomMenuBounds.pageY + moderateScale(10),
    width: moderateScale(44), height: moderateScale(40),
  } : null;

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
            onTouchStart={handleRoomTouch}
            onLayout={event => {
              const { width, height } = event.nativeEvent.layout;
              setViewport({ width, height });
              measureRoomMenuBounds();
            }}
            style={[
              styles.avatarWrap,
              compact && styles.avatarWrapCompact,
              openRoomItemMenu && styles.avatarWrapMenuOpen,
            ]}
          >
            <Animated.View {...panRoom.panHandlers} style={[compact ? StyleSheet.absoluteFill : { width: "100%", minHeight: displayWidth, alignItems: "center" }, compact && usesSprite ? sceneZoomStyle : undefined]}>
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
            {roomActivity?.plan.objectKind === "toy" && roomActivity.plan.objectStart && !roomActivity.plan.targetInstanceId ? (
              <Animated.View pointerEvents="none" style={[styles.transientMouse, {
                left: viewport.width / 2 - moderateScale(getToyDisplaySize("mouse")) / 2,
                top: viewport.height / 2 - moderateScale(getToyDisplaySize("mouse")) / 2,
              }, transientMouseStyle]}>
                <ToySpriteImage toyId="mouse" size={moderateScale(getToyDisplaySize("mouse"))} />
              </Animated.View>
            ) : null}
            {compact ? roomPetLayer : petCluster}
            </Animated.View>
            {compact && usesSprite && visibleSpeech ? (
              <Animated.View pointerEvents="none" onLayout={handleSpeechLayout} style={[styles.speechOverlay, speechPositionStyle]}>
                <PetSpeechBubble message={visibleSpeech} />
              </Animated.View>
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
            {catCommandsOpen && catMenuAnchor && roomMenuBounds ? (
              <View style={styles.floatingMenuLayer} pointerEvents="box-none" onTouchStart={event => event.stopPropagation()}>
                <Pressable style={StyleSheet.absoluteFill} onPress={() => setCatCommandsOpen(false)}
                  accessibilityRole="button" accessibilityLabel={t("home.dismissRoomItemMenu")} />
                <RoomItemActionMenu actions={catCommandActions} anchorRect={catMenuAnchor} roomBounds={roomMenuBounds} />
              </View>
            ) : null}
            {compact && usesSprite && !decorating ? (
              <Pressable style={styles.catCommandButton} disabled={roomActivityBlocked || zoom !== 1}
                onTouchStart={event => event.stopPropagation()}
                onPress={() => { closeMenu(); measureRoomMenuBounds(); setCatCommandsOpen(current => !current); }}
                accessibilityRole="button" accessibilityLabel={t("home.catActions")}
                accessibilityState={{ expanded: catCommandsOpen, disabled: roomActivityBlocked || zoom !== 1 }}>
                <MaterialIcons name="pets" size={moderateScale(18)} color={GameColors.text} />
                <Text style={styles.decorateLabel}>{t("home.catActions")}</Text>
              </Pressable>
            ) : null}
            {compact && usesSprite ? (
              <Pressable style={[styles.decorateButton, decorating && styles.decorateButtonActive]}
                onPress={() => { closeMenu(); setCatCommandsOpen(false); setZoom(1); setDecorating(current => !current); }}
                accessibilityRole="button" accessibilityLabel={t(decorating ? "home.finishDecorating" : "home.decorateRoom")}
                accessibilityState={{ selected: decorating }}>
                <MaterialIcons name={decorating ? "check" : "weekend"} size={moderateScale(18)} color={GameColors.text} />
                <Text style={styles.decorateLabel}>{t(decorating ? "home.finishDecorating" : "home.decorateRoom")}</Text>
              </Pressable>
            ) : null}
            {compact && usesSprite ? (
              <Pressable style={styles.zoomButton}
                onPress={() => { closeMenu(); setZoom(current => current === 3 ? 1 : current+1); }}
                accessibilityRole="button"
                accessibilityLabel={t(zoom === 3 ? "home.resetZoom" : "home.zoomCat")}
                accessibilityValue={{ text: t("home.zoomLevel", { zoom }) }}>
                <Text style={styles.zoomLabel}>{zoom === 3 ? "−" : "+"} {zoom}×</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.stats, compact && styles.statsCompact]}>
            {compact && onOpenMathStats ? (
              <MathStatsChip compact onPress={onOpenMathStats} />
            ) : null}
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
  catCommandButton: {
    position: "absolute", top: moderateScale(10), right: moderateScale(10),
    zIndex: ROOM_MENU_OPEN_Z_INDEX + 4,
    flexDirection: "row", alignItems: "center", gap: moderateScale(6),
    paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(10),
    borderRadius: moderateScale(20), backgroundColor: GameColors.card,
    borderWidth: 1, borderColor: GameColors.cardBorder,
  },
  decorateButton: {
    position: "absolute", top: moderateScale(10), left: moderateScale(10),
    zIndex: ROOM_MENU_OPEN_Z_INDEX + 4,
    flexDirection: "row", alignItems: "center", gap: moderateScale(6),
    paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(10),
    borderRadius: moderateScale(20), backgroundColor: GameColors.card,
    borderWidth: 1, borderColor: GameColors.cardBorder,
  },
  decorateButtonActive: { backgroundColor: GameColors.cardBorder },
  decorateLabel: { fontSize: moderateScale(13), fontWeight: "700", color: GameColors.text },
  transientMouse: { position: "absolute", zIndex: ROOM_PET_LAYER_Z_INDEX - 1 },
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
  zoomButton: {
    position: "absolute", right: 12, bottom: 12, zIndex: ROOM_MENU_OPEN_Z_INDEX+2,
    minWidth: 60, minHeight: 44, borderRadius: 22, backgroundColor: GameColors.card,
    borderColor: GameColors.cardBorder, borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  zoomLabel: { color: GameColors.text, fontSize: 16, fontWeight: "700" },
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
    zIndex: ROOM_MENU_OPEN_Z_INDEX + 3,
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
  speechOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: ROOM_PET_LAYER_Z_INDEX + 1,
    width: moderateScale(200),
    alignItems: "flex-start",
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
