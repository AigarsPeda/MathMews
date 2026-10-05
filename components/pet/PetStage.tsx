import { RoomEditorSheet, type RoomEditorControls } from "@/components/pet/RoomEditorSheet";
import { RoomItemMoveControls } from "@/components/pet/RoomItemMoveControls";
import { AppIcon } from "@/components/ui/AppIcon";
import { buildRoomActivity, roomOffsetToPoint, type RoomActivityKind } from "@/utils/room-activities";
import { createRoomActivitySegment } from "@/pet-display/registry/cat-sprite-registry";
import { useRoomActivity } from "@/hooks/use-room-activity";
import { getPetMediaRegistry } from "@/pet-display/registry/dog-video-registry";
import { isAirConditionerDecorationId } from "@/constants/decoration-motion";
import { DecorationSpriteImage } from "@/components/pet/DecorationSpriteImage";
import { DraggableRoomPet } from "@/components/pet/DraggableRoomPet";
import { PetRoomBackground } from "@/components/pet/PetRoomBackground";
import { PetSpeechBubble } from "@/components/pet/PetSpeechBubble";
import type { RoomItemMenuAction } from "@/components/pet/RoomActionMenu";
import { ToySpriteImage } from "@/components/pet/ToySpriteImage";
import { PetStatsPanel } from "@/components/pet/PetStatsPanel";
import { getBedDisplaySize, getCatBedSource, canFlipBed, canScaleBedDown, canScaleBedUp, getEquippedBedScale } from "@/constants/cat-beds";
import type { CatDecorationId } from "@/constants/cat-decorations";
import { isPosterDecorationId } from "@/constants/cat-decorations";
import { resolveSpriteDisplaySize } from "@/constants/cat-sprites";
import type { CatToyId } from "@/constants/cat-toys";
import { getPlacedToyDisplaySize, getPlacedToyScale, getToyDisplaySize } from "@/constants/cat-toys";
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
import {
  canMoveRoomLayerItem,
  isSameRoomLayerItem,
  normalizeRoomLayerOrder,
  ROOM_MENU_OPEN_Z_INDEX,
  ROOM_PET_LAYER_Z_INDEX,
} from "@/utils/room-layer-order";
import { moderateScale } from "@/utils/scale";
import { getRoomDepthZIndex, getRoomObjectDepthAnchor, isRoomBackgroundDecoration } from "@/utils/room-depth";
import { RoomPlayPropLayer } from "@/components/pet/RoomPlayPropLayer";
import { EMPTY_PLAY_PROP } from "@/pet-display/media/sprite/room-play-prop";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Animated, { useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
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
  roomEditor?: RoomEditorControls;
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
  onRoomActionsChange?: (actions: RoomItemMenuAction[]) => void;
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
  onScalePlacedToy?: (instanceId: string, direction: "up" | "down") => void;
  onOpenMathStats?: () => void;
  onAnimationComplete?: () => void;
  onStepComplete?: (stepIndex: number) => void;
};

export function PetStage({
  roomEditor,
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
  onRoomActionsChange,
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
  onScalePlacedToy,
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
  const roomPlacedToys = useMemo(
    () => usesSprite ? (placedToys ?? []) : [],
    [placedToys, usesSprite],
  );
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
  const [waitingToDecorate, setWaitingToDecorate] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [snap, setSnap] = useState(false);
  const [selectedMoveItem, setSelectedMoveItem] = useState<RoomLayerItem | null>(null);
  const movingItem = decorating && selectedMoveItem
    ? layerOrder.find(item => isSameRoomLayerItem(item, selectedMoveItem))
    : undefined;
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
  const roomPlayProp = useSharedValue(EMPTY_PLAY_PROP);
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
    compact && usesSprite && !decorating && !roomActivityBlocked,
    lastInteractionAt, petSceneX, petSceneY);
  const sofaApproach = roomActivity?.plan.steps[roomActivity.stepIndex]?.sofaApproach;
  const sofaGroundY = sofaApproach ? roomPlacedDecorations
    .filter(item => /^sofa[AB]$/.test(getPlacedDecorationSpriteId(item)))
    .map(item => {
      const size = moderateScale(getPlacedDecorationDragSize(item));
      const center = roomOffsetToPoint(item.offset, viewport.width, viewport.height, size);
      return { ground: center.y + size * getRoomObjectDepthAnchor(getPlacedDecorationSpriteId(item)),
        distance: Math.hypot(center.x - sofaApproach.x, center.y + size * .4 - displayWidth * .31 - sofaApproach.y) };
    }).sort((a,b) => a.distance-b.distance)[0]?.ground : undefined;
  const catDepthY = useDerivedValue(() => Math.max(petSceneY.get() + displayWidth * .30 * activityScale.get(),
    sofaGroundY === undefined ? -Infinity : sofaGroundY + .5));
  useEffect(() => {
    onRoomActivityChange?.(Boolean(roomActivity), returnHome);
  }, [onRoomActivityChange, roomActivity, returnHome]);
  if (waitingToDecorate && !roomActivity) {
    setWaitingToDecorate(false);
    setDecorating(true);
  }
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
    return { kind: "segment", mood: step.mood, segment: step.animation ? createRoomActivitySegment(catSkinId, step.animation, step.reverse, step.animationFps) : registry.getSegment(step.mood) };
  }, [catSkinId, roomActivity]);
  const catActivityStyle = useAnimatedStyle(() => ({
    transform: [{ scale: activityScale.get() }, { scaleX: activityFacing.get() }],
  }));
  const mouseGroundOffset = moderateScale(getToyDisplaySize("mouse")) * getRoomObjectDepthAnchor("toy-mouse");
  const transientMouseStyle = useAnimatedStyle(() => ({
    zIndex: getRoomDepthZIndex(objectY.get() + mouseGroundOffset),
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
    [compact, usesSprite, setAvatarWidth],
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
      return Boolean(onPlacedToyRemove || onMoveRoomLayerItem || onScalePlacedToy);
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
      onScalePlacedToy,
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
          icon: "power",
          onPress: () => onTogglePlacedAirConditioner(item.instanceId),
        });
        return actions;
      }

      if (onMoveRoomLayerItem && item.kind === "decoration" && isRoomBackgroundDecoration(item.decorationId)) {
        actions.push({
          label: moveUpLabel,
          icon: "arrow-up",
          onPress: () => {
            onMoveRoomLayerItem(item, "up");
          },
          disabled: !canMoveRoomLayerItem(layerOrder, item, "up"),
        });
        actions.push({
          label: moveDownLabel,
          icon: "arrow-down",
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
            icon: "power",
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
            icon: "rotate",
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
            icon: styleVariant && !isPoster ? "palette" : "rotate",
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

      if (item.kind === "toy" && onScalePlacedToy) {
        const placed = roomPlacedToys.find(entry => entry.instanceId === item.instanceId);
        if (placed) {
          const scale = getPlacedToyScale(placed);
          actions.push({ label: biggerLabel, icon: "zoom-in",
            onPress: () => onScalePlacedToy(item.instanceId, "up"),
            disabled: !canScaleDecorationUp(scale) });
          actions.push({ label: smallerLabel, icon: "zoom-out",
            onPress: () => onScalePlacedToy(item.instanceId, "down"),
            disabled: !canScaleDecorationDown(scale) });
        }
      }

      if (item.kind === "bed" && onFlipBed && canFlipBed(bedId)) {
        actions.push({
          label: flipBedLabel,
          icon: "rotate",
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
          icon: "trash",
          onPress: () => {
            onBedRemove();
          },
          destructive: true,
        });
      }

      if (item.kind === "decoration" && onPlacedDecorationRemove) {
        actions.push({
          label: removeMenuLabel,
          icon: "trash",
          onPress: () => {
            onPlacedDecorationRemove(item.instanceId);
          },
          destructive: true,
        });
      }

      if (item.kind === "toy" && onPlacedToyRemove) {
        actions.push({
          label: removeMenuLabel,
          icon: "trash",
          onPress: () => {
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
      layerOrder,
      moveDownLabel,
      moveUpLabel,
      onBedRemove,
      onFlipBed,
      onScaleBed,
      onMoveRoomLayerItem,
      onPlacedDecorationRemove,
      onPlacedToyRemove,
      onScalePlacedToy,
      onFlipPlacedDecorationWall,
      onRotatePlacedDecoration,
      onScalePlacedDecoration,
      onTogglePlacedAirConditioner,
      removeMenuLabel,
      roomPlacedDecorations,
      roomPlacedToys,
      rotateLabel,
      smallerLabel,
      t,
    ],
  );

  const itemLabel = useCallback((item: RoomLayerItem) => t(item.kind === "bed" ? `store.bedName.${bedId}` : item.kind === "toy" ? `store.toyName.${item.toyId}` : `store.decorationName.${item.decorationId}`).replace(/\n/g, " "), [bedId, t]);
  const itemPicture = (item: RoomLayerItem) => {
    const size = moderateScale(64);
    if (item.kind === "bed") return <Image source={getCatBedSource(bedId)} style={{ width: size, height: size }} resizeMode="contain" />;
    if (item.kind === "toy") return <ToySpriteImage toyId={item.toyId as CatToyId} size={size} />;
    const placed = roomPlacedDecorations.find(entry => entry.instanceId === item.instanceId);
    if (!placed) return null;
    return <DecorationSpriteImage decorationId={getPlacedDecorationSpriteId(placed)} size={size}
      flipHorizontal={getPlacedDecorationWallFlipped(placed)} />;
  };
  const nudgeItem = (item: RoomLayerItem, direction: "left" | "right" | "up" | "down") => {
    const offset = item.kind === "bed" ? roomBedOffset ?? { x: -0.15, y: 0.3 }
      : item.kind === "toy" ? roomPlacedToys.find(entry => entry.instanceId === item.instanceId)?.offset
      : roomPlacedDecorations.find(entry => entry.instanceId === item.instanceId)?.offset;
    if (!offset) return;
    const next = { x: Math.max(-1, Math.min(1, offset.x + (direction === "left" ? -0.1 : direction === "right" ? 0.1 : 0))),
      y: Math.max(-1, Math.min(1, offset.y + (direction === "up" ? -0.1 : direction === "down" ? 0.1 : 0))) };
    if (item.kind === "bed") onRoomBedOffsetChange?.(next);
    else if (item.kind === "toy") onPlacedToyOffsetChange?.(item.instanceId, next);
    else onPlacedDecorationOffsetChange?.(item.instanceId, next);
  };

  const roomItemDragProps = useCallback(
    (item: RoomLayerItem, layerZIndex: number) => {
      const manageable = canManageRoomItem(item);
      return {
        accessibilityLabel: itemLabel(item),
        selected: Boolean(movingItem && isSameRoomLayerItem(movingItem, item)),
        snapToGrid: snap,
        layerZIndex,
        allowDrag: decorating && zoom === 1,
        interactive: decorating || manageable,
        menuActions: manageable ? buildRoomItemMenuActions(item) : undefined,
      };
    },
    [canManageRoomItem, buildRoomItemMenuActions, decorating, zoom, snap, itemLabel, movingItem],
  );

  const petCluster = (
    <View
      style={[
        compact ? styles.petCenterSlot : styles.avatarCluster,
        !compact && { width: petDisplayWidth },
      ]}
    >
      {visibleSpeech && !(compact && usesSprite) ? (
        <View collapsable={false} pointerEvents="none" style={compact ? styles.speechAbovePet : styles.speechAnchor}>
          <PetSpeechBubble message={visibleSpeech} />
        </View>
      ) : null}
      <Animated.View style={catActivityStyle}>
        <PetDisplay
          petType={petType}
          catSkinId={catSkinId}
          playback={activityPlayback ?? playback}
          loop={Boolean(roomActivity && !["curlUp", "jumpOn", "jumpOff"].includes(roomActivity.plan.steps[roomActivity.stepIndex].animation ?? ""))}
          width={displayWidth}
          resolutionScale={3}
          transparentBackground={usesSprite}
          onPress={compact && usesSprite ? undefined : onPetPress}
          onAnimationComplete={roomActivity ? undefined : onAnimationComplete}
          onStepComplete={roomActivity ? undefined : onStepComplete}
          roomPlayProp={compact && usesSprite ? roomPlayProp : undefined}
        />
      </Animated.View>
    </View>
  );

  const roomPetLayer =
    compact && usesSprite ? (
      <DraggableRoomPet
        accessibilityLabel={t("home.a11yPet")}
        snapToGrid={snap}
        allowDrag={decorating && zoom === 1}
        animatedPosition={{ x: petSceneX, y: petSceneY }}
        petSize={displayWidth}
        hitSize={displayWidth * 0.65}
        initialOffset={roomPetOffset}
        onOffsetChange={zoom === 1 ? onRoomPetOffsetChange : undefined}
        onPositionChange={handlePetPositionChange}
        onPetTap={decorating ? undefined : handleCatTap}
        layerZIndex={ROOM_PET_LAYER_Z_INDEX}
        depthAnchor={.30}
        depthScale={activityScale}
        depthY={decorating ? undefined : catDepthY}
      >
        {petCluster}
      </DraggableRoomPet>
    ) : (
      <View style={styles.petStack}>{petCluster}</View>
    );

  const roomItemLayers = layerOrder.map((item, layerIndex) => {
    const layerZIndex = layerIndex + 1;

    if (item.kind === "bed") {
      if (!compact || !usesSprite || !bedSource) return null;

      return (
        <DraggableRoomPet
          key="bed"
          depthAnchor={getRoomObjectDepthAnchor(`bed-${bedId}`)}
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
          depthAnchor={isRoomBackgroundDecoration(spriteId) ? undefined : getRoomObjectDepthAnchor(spriteId)}
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
    const toySize = moderateScale(getPlacedToyDisplaySize(placed));

    return (
      <DraggableRoomPet
        key={`toy:${item.instanceId}`}
        depthAnchor={getRoomObjectDepthAnchor(`toy-${toyId}`)}
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

  const catCommandActions = useMemo<RoomItemMenuAction[]>(() => {
    if (!compact || !usesSprite || decorating) return [];
    const actions: RoomItemMenuAction[] = [];
    for (const kind of ["sofaSit", "sofaSleep", "toyPlay", "mouseChase"] as RoomActivityKind[]) {
      if (!buildRoomActivity(activityOptions, 0, kind)) continue;
      actions.push({
        label: t(`home.catCommands.${kind}`),
        icon: kind === "sofaSit" ? "sofa" : kind === "sofaSleep" ? "sleep" : kind === "mouseChase" ? "mouse" : "play",
        onPress: () => { onRoomInteraction?.(); startActivity(kind); },
      });
    }
    if (roomActivity) actions.push({
      label: t("home.catCommands.returnHome"), icon: "home",
      onPress: handleRoomTouch,
    });
    return actions;
  }, [activityOptions, compact, decorating, handleRoomTouch, onRoomInteraction, roomActivity, startActivity, t, usesSprite]);
  useEffect(() => {
    onRoomActionsChange?.(catCommandActions);
  }, [catCommandActions, onRoomActionsChange]);
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
            onLayout={event => {
              const { width, height } = event.nativeEvent.layout;
              setViewport({ width, height });
            }}
            style={[
              styles.avatarWrap,
              compact && styles.avatarWrapCompact,
            ]}
          >
            <Animated.View onTouchStart={handleRoomTouch} {...panRoom.panHandlers} style={[compact ? StyleSheet.absoluteFill : { width: "100%", minHeight: displayWidth, alignItems: "center" }, compact && usesSprite ? sceneZoomStyle : undefined]}>
            {usesSprite ? (
              <PetRoomBackground
                roomId={roomId}
                cornerRadius={compact ? COMPACT_ROOM_RADIUS : 0}
              />
            ) : null}
            {roomItemLayers}
            {roomActivity?.plan.objectKind === "toy" && roomActivity.plan.objectStart && !roomActivity.plan.targetInstanceId ? (
              <Animated.View pointerEvents="none" style={[styles.transientMouse, {
                left: viewport.width / 2 - moderateScale(getToyDisplaySize("mouse")) / 2,
                top: viewport.height / 2 - moderateScale(getToyDisplaySize("mouse")) / 2,
              }, transientMouseStyle]}>
                <ToySpriteImage toyId="mouse" size={moderateScale(getToyDisplaySize("mouse"))} />
              </Animated.View>
            ) : null}
            {compact ? roomPetLayer : petCluster}
            {compact && usesSprite ? <RoomPlayPropLayer frame={roomPlayProp} x={petSceneX} y={petSceneY}
              scale={activityScale} facing={activityFacing} size={displayWidth} width={viewport.width} height={viewport.height} /> : null}
            </Animated.View>
            {compact && usesSprite && visibleSpeech ? (
              <Animated.View collapsable={false} pointerEvents="none" onLayout={handleSpeechLayout} style={[styles.speechOverlay, speechPositionStyle]}>
                <PetSpeechBubble message={visibleSpeech} />
              </Animated.View>
            ) : null}
            {compact && usesSprite ? (
              <Pressable style={[styles.decorateButton, decorating && styles.decorateButtonActive]}
                disabled={waitingToDecorate}
                onPress={() => {
                  setSelectedMoveItem(null); setShowEditor(false); setZoom(1);
                  if (!decorating && roomActivity) { setWaitingToDecorate(true); returnHome(); }
                  else setDecorating(current => !current);
                }}
                accessibilityRole="button" accessibilityLabel={t(decorating ? "home.finishDecorating" : "home.decorateRoom")}
                accessibilityState={{ selected: decorating, disabled: waitingToDecorate }}>
                <AppIcon name={decorating ? "check" : "sofa"} size={moderateScale(22)} />
                <Text style={styles.decorateLabel}>{t(decorating ? "home.finishDecorating" : "home.decorateRoom")}</Text>
              </Pressable>
            ) : null}
            {decorating ? <Pressable style={[styles.decorateButton, { top: undefined, bottom: 10 }]}
              onPress={() => { setShowEditor(true); }} accessibilityRole="button" accessibilityLabel={t("home.roomTools")}>
              <Text style={styles.decorateLabel}>{t("home.roomTools")}</Text>
            </Pressable> : null}
            {compact && usesSprite ? (
              <Pressable style={styles.zoomButton}
                onPress={() => { setZoom(current => current === 3 ? 1 : current+1); }}
                accessibilityRole="button"
                accessibilityLabel={t(zoom === 3 ? "home.resetZoom" : "home.zoomCat")}
                accessibilityValue={{ text: t("home.zoomLevel", { zoom }) }}>
                <Text style={styles.zoomLabel}>{zoom === 3 ? "−" : "+"} {zoom}×</Text>
              </Pressable>
            ) : null}
          </View>

          {movingItem ? <RoomItemMoveControls name={itemLabel(movingItem)}
            onMove={direction => nudgeItem(movingItem, direction)} onDone={() => setSelectedMoveItem(null)} />
            : decorating && <Text style={{ color: GameColors.textMuted, fontSize: 14, padding: 8 }}>{t("home.decorateHint")}</Text>}
          <RoomEditorSheet visible={showEditor} onClose={() => setShowEditor(false)} controls={roomEditor}
            items={layerOrder.map(item => ({ item, label: itemLabel(item), picture: itemPicture(item) }))}
            onSelect={item => { setSelectedMoveItem(item); setShowEditor(false); }}
            snap={snap} onSnap={() => setSnap(current => !current)} />
          {!decorating && <View style={[styles.stats, compact && styles.statsCompact]}>
            <PetStatsPanel stats={stats} wisdom={wisdom} compact={compact} onOpenMathStats={onOpenMathStats} />
          </View>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    width: moderateScale(170),
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
});
