import { ROOM_COMMANDS, getRoomCommands } from "@/constants/room-commands";
import { useGraphicsMode } from "@/lib/graphics-mode";
import { getCatRoomSource } from "@/constants/cat-rooms";
import { canFeedForEffect } from "@/utils/pet-care";
import { CAT_PLAY_ACTIVITIES, type CatPlayActivity } from "@/constants/cat-play";
import { GestureDetector } from "react-native-gesture-handler";
import { useRoomCamera } from "@/hooks/use-room-camera";
import { NativeRoomScene } from "@/components/pet/native/NativeRoomScene";
import { buildNativeRoomWorld, nativeObjectPlacementOffset, nativeRoomEdge, projectWorld, type Vec3 } from "@/utils/native-room-world";
import { lampSwitchPosition } from '@/utils/native-lamp-light';
import { RoomActionMenu } from '@/components/pet/RoomActionMenu';
import type { RoomSceneSlide } from "@/hooks/use-room-transition";
import { DEFAULT_HOME_ROOM_ID, HOME_ROOM_IDS, HOME_ROOM_ICONS, isRoomDoor, type HomeRoomId, type RoomEntry } from "@/constants/home-rooms";
import { RoomEditorSheet, type RoomEditorControls } from "@/components/pet/RoomEditorSheet";
import { RoomItemMoveControls } from "@/components/pet/RoomItemMoveControls";
import { RoomRotationSheet } from "@/components/pet/RoomRotationSheet";
import { getRoomItemRotation } from "@/utils/room-rotation";
import { AppIcon } from "@/components/ui/AppIcon";
import { roomActivityStepKey, roomOffsetToPoint, type RoomActivityKind } from "@/utils/room-activities";
import { createRoomActivitySegment } from "@/pet-display/registry/cat-model-registry";
import { useRoomActivity } from "@/hooks/use-room-activity";
import { getPetMediaRegistry } from "@/pet-display/registry/media-registry";
import { isPoweredDecorationId } from "@/constants/decoration-motion";
import { DecorationSpriteImage } from "@/components/pet/DecorationSpriteImage";
import { SimpleLampLight } from '@/components/pet/SimpleLampLight';
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
import { ROOM_CAT_SIZE, ROOM_OBJECT_SCALE } from "@/constants/room-scale";
import { RoomNavigation, ROOM_NAVIGATION_HEIGHT } from "@/components/pet/RoomNavigation";
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
const COMPACT_PET_MIN = 200;
const COMPACT_PET_MAX = 300;
const SPEECH_TAIL_X = moderateScale(23);
const SPEECH_ANCHOR_X = moderateScale(30) + SPEECH_TAIL_X;

function compactPetWidth(petType: PetType, compact: boolean) {
  const usesNativeCat = petType === "cat";
  if (compact && usesNativeCat) {
    return moderateScale(ROOM_CAT_SIZE);
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
  catHomeRoomId?: HomeRoomId;
  roomVisible?: boolean;
  nativeSceneMounted?: boolean;
  roomEntry?: RoomEntry;
  sceneSlide?: RoomSceneSlide;
  onSceneReady?: (roomId: HomeRoomId) => void;
  onSendCatToRoom?: (roomId: HomeRoomId) => void;
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
  bedRotationDegrees?: number;
  bedScale?: number;
  placedToys?: PlacedToy[];
  placedDecorations?: PlacedDecoration[];
  roomLayerOrder?: RoomLayerItem[];
  ownedToyIds?: string[];
  lastInteractionAt?: number;
  roomActivityBlocked?: boolean;
  onRoomInteraction?: () => number | void;
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
  onRotatePlacedToy?: (instanceId: string) => void;
  onSetRoomItemRotation?: (item: RoomLayerItem, degrees: number) => void;
  onFlipPlacedDecorationWall?: (instanceId: string) => void;
  onTogglePlacedDecorationPower?: (instanceId: string) => void;
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
  catHomeRoomId = homeRoomId,
  roomVisible = true,
  roomEntry,
  sceneSlide,
  onSceneReady,
  onSendCatToRoom,
  onOpenStore,
  nativeSceneMounted = true,
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
  bedRotationDegrees,
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
  onRotatePlacedToy,
  onSetRoomItemRotation,
  onFlipPlacedDecorationWall,
  onTogglePlacedDecorationPower,
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
  const graphicsMode = useGraphicsMode();
  const nativeRendering = graphicsMode === "3d";
  const simpleGraphics = graphicsMode === "simple";
  const [nativeHitPositions, setNativeHitPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [livePositions, setLivePositions] = useState<Record<string, { x: number; y: number }>>({});
  const livePosition = useCallback((id: string, point: { x: number; y: number }) => setLivePositions(current => ({ ...current, [id]: point })), []);
  const clearLivePosition = useCallback((id: string) => setLivePositions(current => { const next = { ...current }; delete next[id]; return next; }), []);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const sceneSlideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sceneSlide
    ? viewport.width * sceneSlide.direction * (sceneSlide.outgoing ? -sceneSlide.progress.get() : 1 - sceneSlide.progress.get()) : 0 }] }));
  const handleSceneReady = useCallback(() => onSceneReady?.(homeRoomId), [homeRoomId, onSceneReady]);
  const reduceMotion = useReducedMotion();
  const bedScaleMultiplier = getEquippedBedScale(bedScale);
  const bedSize = moderateScale(getBedDisplaySize(bedId) * bedScaleMultiplier * ROOM_OBJECT_SCALE);
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
  const [rotationPreview, setRotationPreview] = useState<{ item: RoomLayerItem; degrees: number } | null>(null);
  const openRotation = useCallback((item: RoomLayerItem) => {
    setSelectedMoveItem(item);
    setRotationPreview({ item, degrees: getRoomItemRotation({ bedId, bedRotationDegrees, placedDecorations, placedToys }, item) });
  }, [bedId, bedRotationDegrees, placedDecorations, placedToys, setSelectedMoveItem, setRotationPreview]);
  const movingItem = decorating && selectedMoveItem
    ? layerOrder.find(item => isSameRoomLayerItem(item, selectedMoveItem))
    : undefined;
  const displayWidth = avatarWidth;
  const catPresent = catHomeRoomId === homeRoomId;
  const hasRoomNavigation = compact && usesNativeCat && !!onVisitHomeRoom;
  const { x: sceneX, y: sceneY, scale: sceneScale, zoom, gesture: roomGesture } = useRoomCamera(viewport.width, viewport.height, compact && usesNativeCat, reduceMotion, !decorating);
  const petSceneX = useSharedValue(0);
  const petSceneY = useSharedValue(0);
  const speechHeight = useSharedValue(0);
  const hungry = stats.hunger < 30;
  const asleep = playback.kind === "segment" && playback.mood === "sleeping";
  const rotationInstanceId = rotationPreview && rotationPreview.item.kind !== "bed" ? rotationPreview.item.instanceId : undefined;
  const nativeWorld = useMemo(() => buildNativeRoomWorld({
    width: viewport.width, height: viewport.height, petSize: displayWidth, sizeScale: moderateScale(100) / 100 * ROOM_OBJECT_SCALE,
    homeOffset: roomPetOffset, bedId, bedOffset: roomBedOffset, bedFlipped, bedScale,
    bedRotationDegrees: rotationPreview?.item.kind === "bed" ? rotationPreview.degrees : bedRotationDegrees,
    decorations: rotationPreview?.item.kind === "decoration" ? roomPlacedDecorations.map(item => item.instanceId === rotationInstanceId ? { ...item, rotationDegrees: rotationPreview.degrees } : item) : roomPlacedDecorations,
    toys: rotationPreview?.item.kind === "toy" ? roomPlacedToys.map(item => item.instanceId === rotationInstanceId ? { ...item, rotationDegrees: rotationPreview.degrees } : item) : roomPlacedToys,
    livePositions, layerOrder: roomLayerOrder,
  }), [bedFlipped, bedRotationDegrees, bedId, bedScale, displayWidth, livePositions, roomBedOffset, roomPetOffset, roomPlacedDecorations, roomPlacedToys, roomLayerOrder, rotationPreview, rotationInstanceId, viewport.height, viewport.width]);
  useEffect(() => {
    // Cached rooms share the active room's editing callbacks. Their wall-anchor
    // repairs must wait until that room is visible, or they repeat indefinitely.
    if (!roomVisible || rotationPreview || viewport.width <= 0 || viewport.height <= 0) return;
    for (const object of nativeWorld.objects) {
      if (object.placementOffset && !livePositions[object.instanceId])
        onPlacedDecorationOffsetChange?.(object.instanceId, object.placementOffset);
    }
  }, [nativeWorld, livePositions, onPlacedDecorationOffsetChange, roomVisible, rotationPreview, viewport.height, viewport.width]);
  const activityOptions = useMemo(() => ({
    nativeWorld, nativeStepCompletion: nativeRendering,
    homeRoomId, entry: roomEntry,
    width: viewport.width, height: viewport.height, petSize: displayWidth,
    sizeScale: moderateScale(100) / 100 * ROOM_OBJECT_SCALE,
    homeOffset: roomPetOffset ?? { x: 0, y: 0.12 },
    decorations: roomPlacedDecorations,
    toys: placedToys ?? [], ownedToyIds: ownedToyIds ?? [],
    hungry, asleep,
  }), [nativeRendering, homeRoomId, roomEntry, nativeWorld, displayWidth, ownedToyIds, placedToys, asleep, hungry, roomPetOffset, roomPlacedDecorations, viewport.height, viewport.width]);
  const entryPosition = useMemo(() => roomEntry ? nativeRoomEdge(nativeWorld, roomEntry.direction === 1 ? -1 : 1) : undefined, [nativeWorld, roomEntry]);
  const handleReadyToDecorate = useCallback(() => {
    setWaitingToDecorate(false);
    setDecorating(true);
  }, [setWaitingToDecorate, setDecorating]);
  const { activity: roomActivity, scale: activityScale, facing: activityFacing,
    objectX, objectY, startActivity, returnHome, stopActivity, updateNativeHeight, updateObjectPosition, completeNativeStep } = useRoomActivity(activityOptions,
    compact && usesNativeCat && graphicsMode !== "loading" && catPresent && !decorating && !roomActivityBlocked,
    lastInteractionAt, petSceneX, petSceneY, instanceId => {
      const door = roomPlacedDecorations.find(item => item.instanceId === instanceId);
      if (door?.doorDestination) onVisitHomeRoom?.(door.doorDestination);
    }, onFeed, onSendCatToRoom, roomVisible, decorating, handleReadyToDecorate);
  const sofaApproach = roomActivity?.plan.steps[roomActivity.stepIndex]?.sofaApproach;
  const sofaGroundY = sofaApproach ? roomPlacedDecorations
    .filter(item => /^sofa[AB]$/.test(getPlacedDecorationSpriteId(item)))
    .map(item => {
      const size = moderateScale(getPlacedDecorationDragSize(item) * ROOM_OBJECT_SCALE);
      const center = roomOffsetToPoint(item.offset, viewport.width, viewport.height, size);
      return { ground: center.y + size * getRoomObjectDepthAnchor(getPlacedDecorationSpriteId(item)),
        distance: Math.hypot(center.x - sofaApproach.x, center.y + size * .4 - displayWidth * .31 - sofaApproach.y) };
    }).sort((a,b) => a.distance-b.distance)[0]?.ground : undefined;
  const catDepthY = useDerivedValue(() => Math.max(petSceneY.get() + displayWidth * .30 * activityScale.get(),
    sofaGroundY === undefined ? -Infinity : sofaGroundY + .5));
  useEffect(() => {
    onRoomActivityChange?.(Boolean(roomActivity), returnHome);
  }, [onRoomActivityChange, roomActivity, returnHome]);
  const handleRoomTouch = useCallback(() => {
    if (!catPresent || roomActivity?.plan.kind === "returnHome" || roomActivity?.plan.kind === "roomTravel") return;
    returnHome();
    onRoomInteraction?.();
  }, [catPresent, onRoomInteraction, returnHome, roomActivity]);
  const handleCatTap = useCallback(() => {
    if (roomActivity) returnHome();
    else onPetPress?.();
  }, [onPetPress, returnHome, roomActivity]);
  const playingId = roomActivity?.plan.targetInstanceId;
  const handleNativeObjectPosition = useCallback((id: string, point: { x: number; y: number }, center?: Vec3, settled?: boolean) => {
    if (center) updateObjectPosition?.(id, center);
    setNativeHitPositions(current => ({ ...current, [id]: point }));
    if (id === playingId) { objectX.set(point.x); objectY.set(point.y); }
    if (settled && center && roomVisible && !decorating) {
      const object = nativeWorld.objects.find(entry => entry.instanceId === id);
      const toy = roomPlacedToys.find(entry => entry.instanceId === id);
      const decoration = roomPlacedDecorations.find(entry => entry.instanceId === id);
      const placed = toy ?? decoration;
      if (object?.movable && placed) {
        const offset = nativeObjectPlacementOffset(nativeWorld, object, center);
        if (Math.hypot(offset.x - placed.offset.x, offset.y - placed.offset.y) > .001) {
          if (toy) onPlacedToyOffsetChange?.(id, offset);
          else onPlacedDecorationOffsetChange?.(id, offset);
        }
      }
    }
  }, [decorating, nativeWorld, objectX, objectY, onPlacedDecorationOffsetChange, onPlacedToyOffsetChange, playingId, roomPlacedDecorations, roomPlacedToys, roomVisible, updateObjectPosition]);
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
  const visibleSpeech = !catPresent || roomActivity || decorating ? null : speechMessage;
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
        if (item.kind === "decoration" && isRoomDoor(item.decorationId)) return false;
        if (item.kind === "decoration" && isPoweredDecorationId(item.decorationId)) return Boolean(onTogglePlacedDecorationPower);
        if (!catPresent || viewport.width <= displayWidth || viewport.height <= displayWidth) return false;
        return getRoomCommands(item).length > 0;
      }
      if (item.kind === "bed") {
        return Boolean(
          onSetRoomItemRotation || onBedRemove || onMoveRoomLayerItem || onFlipBed || onScaleBed,
        );
      }
      if (item.kind === "decoration") {
        return Boolean(
          onPlacedDecorationRemove ||
          onMoveRoomLayerItem ||
          onRotatePlacedDecoration ||
          onSetRoomItemRotation ||
          onFlipPlacedDecorationWall ||
          onScalePlacedDecoration ||
          (onTogglePlacedDecorationPower && isPoweredDecorationId(item.decorationId)),
        );
      }
      return Boolean(onSetRoomItemRotation || onPlacedToyRemove || onMoveRoomLayerItem || onScalePlacedToy || onRotatePlacedToy);
    },
    [
      decorating,
      catPresent,
      roomActivityBlocked,
      viewport.width, viewport.height, displayWidth,
      onBedRemove,
      onFlipBed,
      onScaleBed,
      onMoveRoomLayerItem,
      onPlacedDecorationRemove,
      onPlacedToyRemove,
      onScalePlacedToy,
      onRotatePlacedDecoration,
      onRotatePlacedToy,
      onSetRoomItemRotation,
      onFlipPlacedDecorationWall,
      onScalePlacedDecoration,
      onTogglePlacedDecorationPower,
    ],
  );

  const buildRoomItemMenuActions = useCallback(
    (item: RoomLayerItem) => {
      const actions: RoomItemMenuAction[] = [];
      if (!decorating && catPresent && viewport.width > displayWidth && viewport.height > displayWidth && item.kind !== "bed") {
        for (const { kind, icon } of getRoomCommands(item)) {
          const labelKind = item.kind === "decoration" && item.decorationId === "chairRockingOak"
            ? kind === "sofaSit" ? "chairSit" : kind === "sofaSleep" ? "chairSleep" : kind : kind;
          actions.push({ label: t(`home.catCommands.${labelKind}`), icon,
            disabled: roomActivityBlocked || (kind === "bowlEat" && (!onFeed || !canFeedForEffect(stats, asleep) || roomActivity?.plan.kind === "bowlEat")),
            onPress: () => { const interactionAt = onRoomInteraction?.(); startActivity(kind, item.instanceId, interactionAt ?? undefined); },
          });
        }
      }
      if (!decorating) {
        if (item.kind !== "decoration" || !isPoweredDecorationId(item.decorationId) || !onTogglePlacedDecorationPower) return actions;
        const placed = roomPlacedDecorations.find(entry => entry.instanceId === item.instanceId);
        if (placed) actions.push({
          label: t(placed.poweredOn ? "home.turnOffDecoration" : "home.turnOnDecoration"),
          icon: "power",
          onPress: () => onTogglePlacedDecorationPower(item.instanceId),
        });
        return actions;
      }

      if (onSetRoomItemRotation) actions.push({ label: rotateLabel, icon: "rotate", onPress: () => openRotation(item) });

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

        if (onTogglePlacedDecorationPower && isPoweredDecorationId(decorationId)) {
          actions.unshift({
            label: t(placed.poweredOn ? "home.turnOffDecoration" : "home.turnOnDecoration"),
            icon: "power",
            onPress: () => onTogglePlacedDecorationPower(item.instanceId),
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

        if (onRotatePlacedDecoration && canRotateDecoration(decorationId) && (!onSetRoomItemRotation || isPoster || usesStyleVariantMenu(decorationId))) {
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

      if (item.kind === "toy" && onRotatePlacedToy && !onSetRoomItemRotation) {
        actions.push({ label: rotateLabel, icon: "rotate",
          onPress: () => onRotatePlacedToy(item.instanceId) });
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
      catPresent,
      roomActivityBlocked,
      viewport.width, viewport.height, displayWidth,
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
      onRotatePlacedToy,
      onSetRoomItemRotation,
      openRotation,
      onScalePlacedDecoration,
      onTogglePlacedDecorationPower,
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
    if (item.kind === "toy") return <ToySpriteImage toyId={item.toyId as CatToyId} size={size} still />;
    const placed = roomPlacedDecorations.find(entry => entry.instanceId === item.instanceId);
    if (!placed) return null;
    return <DecorationSpriteImage decorationId={getPlacedDecorationSpriteId(placed)} size={size} still
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
        allowDrag: decorating,
        dragScale: zoom,
        interactive: decorating || manageable,
        onPetTap: decorating ? () => setSelectedMoveItem(item) : undefined,
        onDragStart: decorating ? () => setSelectedMoveItem(item) : undefined,
        menuActions: manageable ? buildRoomItemMenuActions(item) : undefined,
      };
    },
    [canManageRoomItem, buildRoomItemMenuActions, decorating, zoom, snap, itemLabel, movingItem, setSelectedMoveItem],
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

  useEffect(() => {
    if (simpleGraphics && nativeSceneMounted && viewport.width > 0) handleSceneReady();
  }, [handleSceneReady, nativeSceneMounted, simpleGraphics, viewport.width]);
  const catCommandActions = useMemo<RoomItemMenuAction[]>(() => {
    if (!compact || !usesNativeCat || !catPresent || decorating) return [];
    const actions: RoomItemMenuAction[] = [];
    const essentials = "essentials", travel = "travel", play = "play";
    if (onPetPress) actions.push({ label: t("home.pet"), icon: "paw", section: essentials, onPress: handleCatTap,
      disabled: roomActivityBlocked || Boolean(roomActivity) });
    for (const command of ROOM_COMMANDS.filter(command => command.section === essentials)) addRoomAction(command.kind, command.section);
    function addRoomAction(kind: RoomActivityKind, section: string) {
      if (viewport.width <= displayWidth || viewport.height <= displayWidth) return;
      const target = layerOrder.find(item => getRoomCommands(item).some(command => command.kind === kind));
      if (!target || (kind === "bowlEat" && !onFeed)) return;
      const command = ROOM_COMMANDS.find(command => command.kind === kind)!;
      const chair = target.kind === "decoration" && target.decorationId === "chairRockingOak";
      const labelKind = chair ? kind === "sofaSit" ? "chairSit" : kind === "sofaSleep" ? "chairSleep" : kind : kind;
      actions.push({
        label: t(`home.catCommands.${labelKind}`), section, icon: command.icon,
        disabled: roomActivityBlocked || (kind === "bowlEat" && (!canFeedForEffect(stats, asleep) || roomActivity?.plan.kind === "bowlEat")),
        onPress: () => { const interactionAt = onRoomInteraction?.(); startActivity(kind, undefined, interactionAt ?? undefined); },
      });
    }
    if (onSendCatToRoom) actions.push(...HOME_ROOM_IDS.filter(id => id !== catHomeRoomId).map(id => ({
      label: t("home.goToRoom", { room: t(`home.rooms.${id}`) }), icon: HOME_ROOM_ICONS[id],
      section: travel,
      disabled: roomActivityBlocked || roomActivity?.plan.kind === "roomTravel",
      onPress: () => { const interactionAt = onRoomInteraction?.(); startActivity("roomTravel", id, interactionAt ?? undefined); },
    })));
    if (roomActivity) actions.push({
      label: t("home.catCommands.returnHome"), icon: "home", section: travel, onPress: handleRoomTouch,
    });
    for (const command of ROOM_COMMANDS.filter(command => command.section === play)) addRoomAction(command.kind, command.section);
    if (onPlay) actions.push(...CAT_PLAY_ACTIVITIES.map(activity => ({
      label: t(`home.playStyle.${activity.id}`), icon: activity.icon,
      section: play,
      disabled: roomActivityBlocked || Boolean(roomActivity),
      onPress: () => onPlay(activity),
    })));
    return actions;
  }, [viewport.width, viewport.height, displayWidth, asleep, compact, catPresent, catHomeRoomId, onSendCatToRoom, decorating, handleCatTap, handleRoomTouch, onFeed, onPetPress, onPlay,
    onRoomInteraction, roomActivity, roomActivityBlocked, layerOrder, startActivity, stats, t, usesNativeCat]);

  const roomPetLayer =
    compact && usesNativeCat && !catPresent ? null : compact && usesNativeCat ? (
      <DraggableRoomPet
        testID="room-cat"
        accessibilityLabel={t("home.a11yCatOptions")}
        snapToGrid={snap}
        allowDrag={decorating}
        dragScale={zoom}
        animatedPosition={{ x: petSceneX, y: petSceneY }}
        petSize={displayWidth}
        hitSize={displayWidth * 0.65}
        initialOffset={roomPetOffset}
        onOffsetChange={offset => { onRoomPetOffsetChange?.(offset); clearLivePosition("cat"); }}
        onPositionChange={handlePetPositionChange}
        onDragPositionChange={point => livePosition("cat", point)}
        menuActions={decorating ? undefined : catCommandActions}
        layerZIndex={ROOM_PET_LAYER_Z_INDEX}
        depthAnchor={.30}
        depthScale={activityScale}
        depthY={decorating ? undefined : catDepthY}
      >
        {simpleGraphics ? petCluster : <View style={{ width: displayWidth, height: displayWidth }} />}
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
          {simpleGraphics ? <Image source={bedSource} style={{ width: bedSize, height: bedSize }} resizeMode="contain"/> : <View style={{ width: bedSize, height: bedSize }} />}
        </DraggableRoomPet>
      );
    }

    if (item.kind === "decoration") {
      const placed = roomPlacedDecorations.find(
        (entry) => entry.instanceId === item.instanceId,
      );
      if (!placed) return null;

      const spriteId = getPlacedDecorationSpriteId(placed);
      const decorationSize = moderateScale(getPlacedDecorationDragSize(placed) * ROOM_OBJECT_SCALE);
      const hitSize = moderateScale(getPlacedDecorationHitSize(placed) * ROOM_OBJECT_SCALE);

      return (
        <DraggableRoomPet
          externalPosition={decorating ? undefined : nativeHitPositions[item.instanceId]}
          testID={`room-object:${item.instanceId}`}
          key={`decoration:${item.instanceId}`}
          depthAnchor={isRoomBackgroundDecoration(spriteId) ? undefined : getRoomObjectDepthAnchor(spriteId)}
          petSize={decorationSize}
          hitSize={hitSize}
          initialOffset={nativeWorld.objects.find(object => object.instanceId === item.instanceId)?.placementOffset ?? placed.offset}
          onOffsetChange={(offset) =>
            { onPlacedDecorationOffsetChange?.(item.instanceId, offset); clearLivePosition(item.instanceId); }
          }
          onDragPositionChange={point => livePosition(item.instanceId, point)}
          {...roomItemDragProps(item, layerZIndex)}
        >
          {simpleGraphics ? <DecorationSpriteImage decorationId={spriteId} size={decorationSize} still flipHorizontal={getPlacedDecorationWallFlipped(placed)}/> : <View style={{ width: decorationSize, height: decorationSize }} />}
        </DraggableRoomPet>
      );
    }

    const placed = roomPlacedToys.find(
      (entry) => entry.instanceId === item.instanceId,
    );
    if (!placed) return null;

    const toyId = item.toyId as CatToyId;
    const toySize = moderateScale(getPlacedToyDisplaySize(placed) * ROOM_OBJECT_SCALE);

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
        {simpleGraphics ? <ToySpriteImage toyId={toyId} size={toySize} still/> : <View style={{ width: toySize, height: toySize }} />}
      </DraggableRoomPet>
    );
  });

  return (
    <View style={[styles.stage, compact && styles.stageCompact, sceneSlide && styles.transparentScene]}>
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
          <GestureDetector gesture={roomGesture}>
          <View collapsable={false}
            style={[
              styles.avatarWrap,
              compact && styles.avatarWrapCompact,
              sceneSlide && styles.transparentScene,
            ]}
          >
            <Animated.View style={[compact ? StyleSheet.absoluteFill : { width: "100%", minHeight: displayWidth }, hasRoomNavigation && styles.roomSceneInset, sceneSlideStyle, { backgroundColor: GameColors.background }]}
              onLayout={event => {
                const { width, height } = event.nativeEvent.layout;
                setViewport({ width, height });
              }}>
            <Animated.View style={[compact ? StyleSheet.absoluteFill : { width: "100%", minHeight: displayWidth, alignItems: "center" }, compact && usesNativeCat ? sceneZoomStyle : undefined]}>
            {usesNativeCat && compact && simpleGraphics ? <>
              <Image source={getCatRoomSource(roomId)} resizeMode="contain" style={{ position: 'absolute', width: viewport.width, height: viewport.width, top: (viewport.height - viewport.width) / 2 }}/>
              <SimpleLampLight world={nativeWorld}/>
              <Text pointerEvents="none" style={styles.graphicsHint}>{t('recovery.graphicsHint')}</Text>
            </> : null}
            {usesNativeCat && compact && nativeRendering && nativeSceneMounted ? <Pressable style={StyleSheet.absoluteFill} onPress={handleRoomTouch} accessible={false}><NativeRoomScene initialCatPosition={entryPosition} onSceneReady={handleSceneReady} world={nativeWorld} roomId={roomId} skinId={catSkinId} catPresent={catPresent} paused={!roomVisible} editing={decorating}
              playback={activityPlayback ?? playback} travel={roomActivity?.plan.steps[roomActivity.stepIndex].native}
              activityKey={roomActivity ? roomActivityStepKey(roomActivity) : undefined}
              onRoomStepComplete={completeNativeStep}
              playingId={roomActivity?.plan.targetInstanceId} playContact={roomActivity?.plan.steps[roomActivity.stepIndex].animation === "batToy"}
              onObjectPosition={handleNativeObjectPosition}
              onPosition={handleNativePetPosition}
              onContactPosition={updateNativeHeight}
              onAnimationComplete={roomActivity ? undefined : onAnimationComplete} onStepComplete={roomActivity ? undefined : onStepComplete} /></Pressable> : null}
            {roomItemLayers}
            {compact ? roomPetLayer : petCluster}
            {compact && nativeRendering && !decorating && onTogglePlacedDecorationPower && <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: ROOM_MENU_OPEN_Z_INDEX }]}>
              {nativeWorld.objects.map(object => {
                const position = lampSwitchPosition(object);
                const item = layerOrder.find(entry => entry.kind === "decoration" && entry.instanceId === object.instanceId);
                if (!position || !item || !canManageRoomItem(item)) return null;
                const point = projectWorld(position, viewport.width);
                const size = Math.max(32, Math.min(56, viewport.width * .07 * object.scale));
                return <RoomActionMenu key={`lamp-switch:${object.instanceId}`} label={t('home.lampSwitch', { name: itemLabel(item) })}
                  actions={buildRoomItemMenuActions(item)} size={{ width: size, height: size }}
                  style={{ position: 'absolute', left: viewport.width / 2 + point.x - size / 2, top: viewport.height / 2 + point.y - size / 2 }}>
                  <View pointerEvents="none" style={{ width: size, height: size }}/>
                </RoomActionMenu>;
              })}
            </View>}
            </Animated.View>
            {compact && usesNativeCat && visibleSpeech ? (
              <Animated.View collapsable={false} pointerEvents="none" onLayout={handleSpeechLayout} style={[styles.speechOverlay, speechPositionStyle]}>
                <PetSpeechBubble message={visibleSpeech} />
              </Animated.View>
            ) : null}
            </Animated.View>
            {hasRoomNavigation && !decorating && !sceneSlide?.outgoing && <RoomNavigation roomId={homeRoomId} disabled={!!sceneSlide || !!roomActivityBlocked || roomActivity?.plan.kind === "roomTravel"}
              onVisit={onVisitHomeRoom!} />}
            {compact && usesNativeCat && !sceneSlide?.outgoing ? (
              <Pressable style={[styles.decorateButton, decorating && styles.decorateButtonActive]}
                disabled={!!sceneSlide || waitingToDecorate || roomActivity?.plan.kind === "roomTravel"}
                onPress={() => {
                  setSelectedMoveItem(null); setShowEditor(false);
                  if (!decorating && roomActivity) { setWaitingToDecorate(true); stopActivity(); }
                  else setDecorating(current => !current);
                }}
                accessibilityRole="button" accessibilityLabel={t(decorating ? "home.finishDecorating" : "home.decorateRoom")}
                accessibilityState={{ selected: decorating, disabled: waitingToDecorate }}>
                <AppIcon name={decorating ? "check" : "sofa"} size={moderateScale(22)} />
                <Text style={styles.decorateLabel}>{t(decorating ? "home.finishDecorating" : "home.decorateRoom")}</Text>
              </Pressable>
            ) : null}
            {decorating ? <Pressable style={[styles.decorateButton, { left: undefined, right: moderateScale(10) }]}
              onPress={() => { setShowEditor(true); }} accessibilityRole="button" accessibilityLabel={t("home.roomTools")}>
              <Text style={styles.decorateLabel}>{t("home.roomTools")}</Text>
            </Pressable> : null}
          </View>
          </GestureDetector>

          <View style={[styles.roomControls, compact && usesNativeCat && styles.roomControlsSlot, sceneSlide?.outgoing && styles.hiddenStats]}>
          {compact ? <View pointerEvents="none" style={styles.roomBottomShadowClip}>
            <View style={styles.roomBottomShadow} />
          </View> : null}
          <View style={[styles.stats, compact && styles.statsCompact, decorating && styles.hiddenStats]}
            pointerEvents={decorating ? "none" : "auto"}
            accessibilityElementsHidden={decorating}
            importantForAccessibility={decorating ? "no-hide-descendants" : "auto"}>
            <PetStatsPanel stats={stats} wisdom={wisdom} compact={compact} onOpenMathStats={onOpenMathStats} />
          </View>
          {decorating && <View style={styles.moveControlsSlot}>
          {movingItem ? <RoomItemMoveControls name={itemLabel(movingItem)}
            rotationDegrees={getRoomItemRotation({ bedId, bedRotationDegrees, placedDecorations, placedToys }, movingItem)}
            onRotate={onSetRoomItemRotation ? () => openRotation(movingItem) : undefined}
            actions={buildRoomItemMenuActions(movingItem)}
            onMove={direction => nudgeItem(movingItem, direction)} onDone={() => setSelectedMoveItem(null)} />
            : <Text style={{ color: GameColors.textMuted, fontSize: 14, padding: 8 }}>{t("home.decorateHint")}</Text>}
          </View>}
          </View>
          <RoomRotationSheet visible={decorating && !!rotationPreview}
            name={rotationPreview ? itemLabel(rotationPreview.item) : ""} degrees={rotationPreview?.degrees ?? 0} simpleGraphics={simpleGraphics}
            onPreview={degrees => setRotationPreview(current => current ? { ...current, degrees } : null)}
            onClose={() => setRotationPreview(null)} onApply={degrees => {
              if (rotationPreview) onSetRoomItemRotation?.(rotationPreview.item, degrees); setRotationPreview(null);
            }} />
          <RoomEditorSheet visible={showEditor} onClose={() => setShowEditor(false)} controls={roomEditor}
            onOpenStore={onOpenStore ? () => { setShowEditor(false); onOpenStore(); } : undefined}
            items={showEditor ? layerOrder.map(item => ({ item, label: itemLabel(item), picture: itemPicture(item) })) : []}
            onSelect={item => { setSelectedMoveItem(item); setShowEditor(false); }}
            snap={snap} onSnap={() => setSnap(current => !current)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  graphicsHint: { position: "absolute", bottom: 8, alignSelf: "center", color: GameColors.textMuted, fontSize: 12 },
  transparentScene: { backgroundColor: 'transparent' },
  // Hidden stats keep the viewport identical in play and decoration mode.
  // The taller editing dock borrows the navigation strip above the stats.
  roomControls: { width: "100%" },
  // Clip the shadow to the gap beneath the room, excluding its top and sides.
  roomBottomShadowClip: {
    position: "absolute", top: -moderateScale(8),
    left: -COMPACT_STAGE_INSET, right: -COMPACT_STAGE_INSET,
    height: moderateScale(8), overflow: "hidden",
  },
  roomBottomShadow: {
    position: "absolute", bottom: moderateScale(8), left: 0, right: 0,
    height: COMPACT_STAGE_RADIUS * 2, borderRadius: COMPACT_STAGE_RADIUS,
    backgroundColor: GameColors.background,
    boxShadow: [{ offsetX: 0, offsetY: 2, blurRadius: 6, color: "rgba(45, 52, 54, 0.08)" }],
  },
  roomControlsSlot: { minHeight: moderateScale(74), flexShrink: 0 },
  moveControlsSlot: { position: "absolute", bottom: 0, left: 0, right: 0, minHeight: moderateScale(104), backgroundColor: GameColors.card },
  hiddenStats: { opacity: 0 },
  roomSceneInset: { bottom: ROOM_NAVIGATION_HEIGHT },
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
    paddingTop: 0,
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
    width: undefined,
    alignSelf: "stretch",
    marginHorizontal: -COMPACT_STAGE_INSET,
    minHeight: moderateScale(260),
    backgroundColor: GameColors.background,
    borderRadius: COMPACT_STAGE_RADIUS,
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
