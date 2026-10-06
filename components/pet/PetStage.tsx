import { canFeedForEffect } from "@/utils/pet-care";
import { CAT_PLAY_ACTIVITIES, type CatPlayActivity } from "@/constants/cat-play";
import { GestureDetector } from "react-native-gesture-handler";
import { useRoomCamera } from "@/hooks/use-room-camera";
import { NativeRoomScene } from "@/components/pet/native/NativeRoomScene";
import { buildNativeRoomWorld } from "@/utils/native-room-world";
import { DEFAULT_HOME_ROOM_ID, HOME_ROOM_IDS, isRoomDoor, type HomeRoomId } from "@/constants/home-rooms";
import { RoomActionMenu } from "@/components/pet/RoomActionMenu";
import { RoomEditorSheet, type RoomEditorControls } from "@/components/pet/RoomEditorSheet";
import { RoomItemMoveControls } from "@/components/pet/RoomItemMoveControls";
import { AppIcon } from "@/components/ui/AppIcon";
import { buildRoomActivity, roomOffsetToPoint, type RoomActivityKind } from "@/utils/room-activities";
import { createRoomActivitySegment } from "@/pet-display/registry/cat-model-registry";
import { useRoomActivity } from "@/hooks/use-room-activity";
import { getPetMediaRegistry } from "@/pet-display/registry/media-registry";
import { isAirConditionerDecorationId } from "@/constants/decoration-motion";
import { DecorationSpriteImage } from "@/components/pet/DecorationSpriteImage";
import { DraggableRoomPet } from "@/components/pet/DraggableRoomPet";
import { PetSpeechBubble } from "@/components/pet/PetSpeechBubble";
import type { RoomItemMenuAction } from "@/components/pet/RoomActionMenu";
import { ToySpriteImage } from "@/components/pet/ToySpriteImage";
import { PetStatsPanel } from "@/components/pet/PetStatsPanel";
import { getBedDisplaySize, getCatBedSource, canFlipBed, canScaleBedDown, canScaleBedUp, getEquippedBedScale } from "@/constants/cat-beds";
import type { CatDecorationId } from "@/constants/cat-decorations";
import { isPosterDecorationId } from "@/constants/cat-decorations";
import type { CatToyId } from "@/constants/cat-toys";
import { getPlacedToyDisplaySize, getPlacedToyScale } from "@/constants/cat-toys";
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
import { getRoomObjectDepthAnchor, isRoomBackgroundDecoration } from "@/utils/room-depth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Animated, { useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue } from "react-native-reanimated";
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
const COMPACT_CAT_SIZE = 120;
const SPEECH_TAIL_X = moderateScale(23);
const SPEECH_ANCHOR_X = moderateScale(30) + SPEECH_TAIL_X;

function compactPetWidth(petType: PetType, compact: boolean) {
  const usesNativeCat = petType === "cat";
  if (compact && usesNativeCat) {
    return moderateScale(COMPACT_CAT_SIZE);
  }
  return moderateScale(compact ? 260 : 200);
}

function avatarDisplayWidth(
  petType: PetType,
  avatarWidth: number,
  displayWidth: number,
) {
  const usesNativeCat = petType === "cat";
  return usesNativeCat ? displayWidth : avatarWidth;
}

type PetStageProps = {
  roomEditor?: RoomEditorControls;
  homeRoomId?: HomeRoomId;
  onVisitHomeRoom?: (roomId: HomeRoomId) => void;
  onPlaceRoomDoor?: (roomId: HomeRoomId) => void;
  onAssignRoomDoor?: (instanceId: string, roomId: HomeRoomId) => void;
  onOpenStore?: () => void;
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
  onFeed?: () => void;
  onPlay?: (activity: CatPlayActivity) => void;
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
  homeRoomId = DEFAULT_HOME_ROOM_ID,
  onVisitHomeRoom,
  onPlaceRoomDoor,
  onAssignRoomDoor,
  onOpenStore,
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
  onFeed,
  onPlay,
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
  const usesNativeCat = petType === "cat";
  const [nativeHitPositions, setNativeHitPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [livePositions, setLivePositions] = useState<Record<string, { x: number; y: number }>>({});
  const livePosition = useCallback((id: string, point: { x: number; y: number }) => setLivePositions(current => ({ ...current, [id]: point })), []);
  const clearLivePosition = useCallback((id: string) => setLivePositions(current => { const next = { ...current }; delete next[id]; return next; }), []);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const reduceMotion = useReducedMotion();
  const bedScaleMultiplier = getEquippedBedScale(bedScale);
  const bedSize = moderateScale(getBedDisplaySize(bedId) * bedScaleMultiplier);
  const bedSource = usesNativeCat ? getCatBedSource(bedId) : undefined;
  const roomPlacedToys = useMemo(
    () => usesNativeCat ? (placedToys ?? []) : [],
    [placedToys, usesNativeCat],
  );
  const roomPlacedDecorations = useMemo(
    () => usesNativeCat ? (placedDecorations ?? []) : [],
    [placedDecorations, usesNativeCat],
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
  const displayWidth = avatarWidth;
  const { x: sceneX, y: sceneY, scale: sceneScale, zoom, reset: resetZoom, gesture: roomGesture } = useRoomCamera(viewport.width, viewport.height, compact && usesNativeCat && !decorating, reduceMotion);
  const petSceneX = useSharedValue(0);
  const petSceneY = useSharedValue(0);
  const speechHeight = useSharedValue(0);
  const hungry = stats.hunger < 30;
  const asleep = playback.kind === "segment" && playback.mood === "sleeping";
  const nativeWorld = useMemo(() => buildNativeRoomWorld({
    width: viewport.width, height: viewport.height, petSize: displayWidth, sizeScale: moderateScale(100) / 100,
    homeOffset: roomPetOffset, bedId, bedOffset: roomBedOffset, bedFlipped, bedScale,
    decorations: roomPlacedDecorations, toys: roomPlacedToys, livePositions, layerOrder: roomLayerOrder,
  }), [bedFlipped, bedId, bedScale, displayWidth, livePositions, roomBedOffset, roomPetOffset, roomPlacedDecorations, roomPlacedToys, roomLayerOrder, viewport.height, viewport.width]);
  const activityOptions = useMemo(() => ({
    nativeWorld,
    width: viewport.width, height: viewport.height, petSize: displayWidth,
    sizeScale: moderateScale(100) / 100,
    homeOffset: roomPetOffset ?? { x: 0, y: 0.12 },
    decorations: roomPlacedDecorations,
    toys: placedToys ?? [], ownedToyIds: ownedToyIds ?? [],
    hungry, asleep,
  }), [nativeWorld, displayWidth, ownedToyIds, placedToys, asleep, hungry, roomPetOffset, roomPlacedDecorations, viewport.height, viewport.width]);
  const { activity: roomActivity, scale: activityScale, facing: activityFacing,
    objectX, objectY, startActivity, returnHome, updateNativeHeight } = useRoomActivity(activityOptions,
    compact && usesNativeCat && !decorating && !roomActivityBlocked,
    lastInteractionAt, petSceneX, petSceneY, instanceId => {
      const door = roomPlacedDecorations.find(item => item.instanceId === instanceId);
      if (door?.doorDestination) onVisitHomeRoom?.(door.doorDestination);
    }, onFeed);
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
  const playingId = roomActivity?.plan.targetInstanceId;
  const handleNativeObjectPosition = useCallback((id: string, point: { x: number; y: number }) => {
    setNativeHitPositions(current => ({ ...current, [id]: point }));
    if (id === playingId) { objectX.set(point.x); objectY.set(point.y); }
  }, [objectX, objectY, playingId]);
  const handleNativePetPosition = useCallback((point: { x: number; y: number }) => {
    petSceneX.set(point.x); petSceneY.set(point.y);
  }, [petSceneX, petSceneY]);
  const activityPlayback = useMemo<PetPlaybackState | null>(() => {
    const step = roomActivity?.plan.steps[roomActivity.stepIndex];
    if (!step) return null;
    const registry = getPetMediaRegistry("cat");
    return { kind: "segment", mood: step.mood, segment: step.animation ? createRoomActivitySegment(step.animation, step.reverse, step.animationFps) : registry.getSegment(step.mood) };
  }, [roomActivity]);
  const catActivityStyle = useAnimatedStyle(() => ({
    transform: [{ scale: activityScale.get() }, { scaleX: activityFacing.get() }],
  }));
  const visibleSpeech = roomActivity || decorating ? null : speechMessage;
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
      if (!compact || usesNativeCat) return;

      const { width } = event.nativeEvent.layout;
      const clamped = Math.max(
        moderateScale(COMPACT_PET_MIN),
        Math.min(moderateScale(COMPACT_PET_MAX), Math.round(width)),
      );

      setAvatarWidth(clamped);
    },
    [compact, usesNativeCat, setAvatarWidth],
  );

  const canManageRoomItem = useCallback(
    (item: RoomLayerItem) => {
      if (!decorating) {
        if (roomActivityBlocked) return false;
        if (item.kind === "decoration" && isRoomDoor(item.decorationId)) return Boolean(onVisitHomeRoom);
        if (item.kind === "decoration" && isAirConditionerDecorationId(item.decorationId)) return Boolean(onTogglePlacedAirConditioner);
        const instanceId = item.kind === "bed" ? undefined : item.instanceId;
        return instanceId !== undefined && ["sofaSit", "sofaSleep", "toyPlay", "mouseChase", "bowlEat"].some(kind =>
          buildRoomActivity(activityOptions, 0, kind as RoomActivityKind, instanceId)?.targetInstanceId === instanceId);
      }
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
      decorating,
      roomActivityBlocked,
      activityOptions,
      onVisitHomeRoom,
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
      if (item.kind === "decoration" && isRoomDoor(item.decorationId)) {
        const door = roomPlacedDecorations.find(entry => entry.instanceId === item.instanceId);
        if (decorating && onAssignRoomDoor) {
          for (const destination of HOME_ROOM_IDS.filter(id => id !== homeRoomId)) actions.push({
            label: t("home.doorLeadsTo", { room: t(`home.rooms.${destination}`) }), icon: "home",
            disabled: door?.doorDestination === destination,
            onPress: () => onAssignRoomDoor(item.instanceId, destination),
          });
        } else if (!decorating && door?.doorDestination && onVisitHomeRoom) {
          actions.push({ label: t("home.goToRoom", { room: t(`home.rooms.${door.doorDestination}`) }), icon: "home",
            disabled: roomActivityBlocked,
            onPress: () => { onRoomInteraction?.(); startActivity("doorTravel", item.instanceId); },
          });
        }
      }
      if (!decorating && item.kind !== "bed") {
        for (const kind of ["sofaSit", "sofaSleep", "toyPlay", "mouseChase", "bowlEat"] as RoomActivityKind[]) {
          if (buildRoomActivity(activityOptions, 0, kind, item.instanceId)?.targetInstanceId !== item.instanceId) continue;
          actions.push({ label: t(`home.catCommands.${kind}`), icon: kind === "sofaSit" ? "sofa" : kind === "sofaSleep" ? "sleep" : kind === "bowlEat" ? "feed" : "play",
            disabled: roomActivityBlocked || (kind === "bowlEat" && (!onFeed || !canFeedForEffect(stats, asleep) || roomActivity?.plan.kind === "bowlEat")),
            onPress: () => { onRoomInteraction?.(); startActivity(kind, item.instanceId); },
          });
        }
      }
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
      homeRoomId,
      onAssignRoomDoor,
      onVisitHomeRoom,
      roomActivityBlocked,
      activityOptions,
      onFeed,
      stats,
      asleep,
      roomActivity,
      onRoomInteraction,
      startActivity,
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

  const itemLabel = useCallback((item: RoomLayerItem) => {
    if (item.kind === "decoration" && isRoomDoor(item.decorationId)) {
      const door = roomPlacedDecorations.find(entry => entry.instanceId === item.instanceId);
      return door?.doorDestination ? t("home.doorToRoom", { room: t(`home.rooms.${door.doorDestination}`) }) : t("home.chooseDoorDestination");
    }
    return t(item.kind === "bed" ? `store.bedName.${bedId}` : item.kind === "toy" ? `store.toyName.${item.toyId}` : `store.decorationName.${item.decorationId}`).replace(/\n/g, " ");
  }, [bedId, roomPlacedDecorations, t]);
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
      {visibleSpeech && !(compact && usesNativeCat) ? (
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
          transparentBackground={usesNativeCat}
          onPress={compact && usesNativeCat ? undefined : onPetPress}
          onAnimationComplete={roomActivity ? undefined : onAnimationComplete}
          onStepComplete={roomActivity ? undefined : onStepComplete}
        />
      </Animated.View>
    </View>
  );

  const catCommandActions = useMemo<RoomItemMenuAction[]>(() => {
    if (!compact || !usesNativeCat || decorating) return [];
    const actions: RoomItemMenuAction[] = [];
    if (onPetPress) actions.push({ label: t("home.pet"), icon: "paw", onPress: handleCatTap,
      disabled: roomActivityBlocked || Boolean(roomActivity) });
    if (onFeed && buildRoomActivity(activityOptions, 0, "bowlEat")) actions.push({
      label: t("home.catCommands.bowlEat"), icon: "feed",
      disabled: roomActivityBlocked || !canFeedForEffect(stats, asleep) || roomActivity?.plan.kind === "bowlEat",
      onPress: () => { onRoomInteraction?.(); startActivity("bowlEat"); },
    });
    for (const kind of ["sofaSit", "sofaSleep", "toyPlay", "mouseChase"] as RoomActivityKind[]) {
      if (!buildRoomActivity(activityOptions, 0, kind)) continue;
      actions.push({
        label: t(`home.catCommands.${kind}`),
        icon: kind === "sofaSit" ? "sofa" : kind === "sofaSleep" ? "sleep" : kind === "mouseChase" ? "mouse" : "play",
        disabled: roomActivityBlocked,
        onPress: () => { onRoomInteraction?.(); startActivity(kind); },
      });
    }
    if (onPlay) actions.push(...CAT_PLAY_ACTIVITIES.map(activity => ({
      label: t(`home.playStyle.${activity.id}`), icon: activity.icon,
      disabled: roomActivityBlocked || Boolean(roomActivity),
      onPress: () => onPlay(activity),
    })));
    if (roomActivity) actions.push({
      label: t("home.catCommands.returnHome"), icon: "home", onPress: handleRoomTouch,
    });
    return actions;
  }, [activityOptions, asleep, compact, decorating, handleCatTap, handleRoomTouch, onFeed, onPetPress, onPlay,
    onRoomInteraction, roomActivity, roomActivityBlocked, startActivity, stats, t, usesNativeCat]);

  const roomPetLayer =
    compact && usesNativeCat ? (
      <DraggableRoomPet
        testID="room-cat"
        accessibilityLabel={t("home.a11yCatOptions")}
        snapToGrid={snap}
        allowDrag={decorating && zoom === 1}
        animatedPosition={{ x: petSceneX, y: petSceneY }}
        petSize={displayWidth}
        hitSize={displayWidth * 0.65}
        initialOffset={roomPetOffset}
        onOffsetChange={zoom === 1 ? offset => { onRoomPetOffsetChange?.(offset); clearLivePosition("cat"); } : undefined}
        onPositionChange={handlePetPositionChange}
        onDragPositionChange={point => livePosition("cat", point)}
        menuActions={decorating ? undefined : catCommandActions}
        layerZIndex={ROOM_PET_LAYER_Z_INDEX}
        depthAnchor={.30}
        depthScale={activityScale}
        depthY={decorating ? undefined : catDepthY}
      >
        <View style={{ width: displayWidth, height: displayWidth }} />
      </DraggableRoomPet>
    ) : (
      <View style={styles.petStack}>{petCluster}</View>
    );

  const roomItemLayers = layerOrder.map((item, layerIndex) => {
    const layerZIndex = layerIndex + 1;

    if (item.kind === "bed") {
      if (!compact || !usesNativeCat || !bedSource) return null;

      return (
        <DraggableRoomPet
          testID="room-object:bed"
          key="bed"
          depthAnchor={getRoomObjectDepthAnchor(`bed-${bedId}`)}
          petSize={bedSize}
          initialOffset={roomBedOffset ?? { x: -0.15, y: 0.3 }}
          onOffsetChange={offset => { onRoomBedOffsetChange?.(offset); clearLivePosition("bed"); }}
          onDragPositionChange={point => livePosition("bed", point)}
          {...roomItemDragProps(item, layerZIndex)}
        >
          <View style={{ width: bedSize, height: bedSize }} />
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

      return (
        <DraggableRoomPet
          externalPosition={decorating ? undefined : nativeHitPositions[item.instanceId]}
          testID={`room-object:${item.instanceId}`}
          key={`decoration:${item.instanceId}`}
          depthAnchor={isRoomBackgroundDecoration(spriteId) ? undefined : getRoomObjectDepthAnchor(spriteId)}
          petSize={decorationSize}
          hitSize={hitSize}
          initialOffset={placed.offset}
          onOffsetChange={(offset) =>
            { onPlacedDecorationOffsetChange?.(item.instanceId, offset); clearLivePosition(item.instanceId); }
          }
          onDragPositionChange={point => livePosition(item.instanceId, point)}
          {...roomItemDragProps(item, layerZIndex)}
        >
          <View style={{ width: decorationSize, height: decorationSize }} />
        </DraggableRoomPet>
      );
    }

    const placed = roomPlacedToys.find(
      (entry) => entry.instanceId === item.instanceId,
    );
    if (!placed) return null;

    const toyId = item.toyId as CatToyId;
    const toySize = moderateScale(getPlacedToyDisplaySize(placed));

    return (
      <DraggableRoomPet
        testID={`room-object:${item.instanceId}`}
        key={`toy:${item.instanceId}`}
        depthAnchor={getRoomObjectDepthAnchor(`toy-${toyId}`)}
        externalPosition={decorating ? undefined : nativeHitPositions[item.instanceId]}
        petSize={toySize}
        initialOffset={placed.offset}
        onOffsetChange={(offset) =>
          { onPlacedToyOffsetChange?.(item.instanceId, offset); clearLivePosition(item.instanceId); }
        }
        onDragPositionChange={point => livePosition(item.instanceId, point)}
        {...roomItemDragProps(item, layerZIndex)}
      >
        <View style={{ width: toySize, height: toySize }} />
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

      {compact && usesNativeCat && onVisitHomeRoom && <RoomActionMenu label={t("home.chooseRoom")} blocked={roomActivityBlocked}
        actions={HOME_ROOM_IDS.filter(id => id !== homeRoomId).map(id => ({
          label: t("home.goToRoom", { room: t(`home.rooms.${id}`) }), icon: "home",
          onPress: () => onVisitHomeRoom(id),
        }))}>
        <View style={styles.roomName}><AppIcon name="home" size={20} />
          <Text style={styles.decorateLabel}>{t(`home.rooms.${homeRoomId}`)}</Text><AppIcon name="chevron-down" size={16} />
        </View>
      </RoomActionMenu>}
      <View style={styles.petColumnMeasure} onLayout={handleAvatarLayout}>
        <View style={[styles.petColumn, compact && styles.petColumnCompact]}>
          <GestureDetector gesture={roomGesture}>
          <View collapsable={false}
            onLayout={event => {
              const { width, height } = event.nativeEvent.layout;
              setViewport({ width, height });
            }}
            style={[
              styles.avatarWrap,
              compact && styles.avatarWrapCompact,
            ]}
          >
            <Animated.View style={[compact ? StyleSheet.absoluteFill : { width: "100%", minHeight: displayWidth, alignItems: "center" }, compact && usesNativeCat ? sceneZoomStyle : undefined]}>
            {usesNativeCat && compact ? <Pressable style={StyleSheet.absoluteFill} onPress={handleRoomTouch} accessible={false}><NativeRoomScene world={nativeWorld} roomId={roomId} skinId={catSkinId}
              playback={activityPlayback ?? playback} travel={roomActivity?.plan.steps[roomActivity.stepIndex].native}
              activityKey={roomActivity ? `${roomActivity.plan.kind}:${roomActivity.plan.targetInstanceId}:${roomActivity.stepIndex}` : undefined}
              playingId={roomActivity?.plan.targetInstanceId} playContact={roomActivity?.plan.steps[roomActivity.stepIndex].animation === "batToy"}
              onObjectPosition={handleNativeObjectPosition}
              onPosition={handleNativePetPosition}
              onContactPosition={updateNativeHeight}
              onAnimationComplete={roomActivity ? undefined : onAnimationComplete} onStepComplete={roomActivity ? undefined : onStepComplete} /></Pressable> : null}
            {roomItemLayers}
            {compact ? roomPetLayer : petCluster}
            </Animated.View>
            {compact && usesNativeCat && visibleSpeech ? (
              <Animated.View collapsable={false} pointerEvents="none" onLayout={handleSpeechLayout} style={[styles.speechOverlay, speechPositionStyle]}>
                <PetSpeechBubble message={visibleSpeech} />
              </Animated.View>
            ) : null}
            {compact && usesNativeCat ? (
              <Pressable style={[styles.decorateButton, decorating && styles.decorateButtonActive]}
                disabled={waitingToDecorate}
                onPress={() => {
                  setSelectedMoveItem(null); setShowEditor(false); resetZoom();
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
          </View>
          </GestureDetector>

          {movingItem ? <RoomItemMoveControls name={itemLabel(movingItem)}
            onMove={direction => nudgeItem(movingItem, direction)} onDone={() => setSelectedMoveItem(null)} />
            : decorating && <Text style={{ color: GameColors.textMuted, fontSize: 14, padding: 8 }}>{t("home.decorateHint")}</Text>}
          <RoomEditorSheet visible={showEditor} onClose={() => setShowEditor(false)} controls={roomEditor}
            homeRoomId={homeRoomId} onPlaceDoor={onPlaceRoomDoor}
            onOpenStore={onOpenStore ? () => { setShowEditor(false); onOpenStore(); } : undefined}
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
  roomName: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44 },
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
