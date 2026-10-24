import { sameRoomDragFeedback } from '@/utils/room-drag-feedback';
import { createRoomDragPlacement } from '@/utils/room-drag-placement';
import { registerRoomDragLatency } from '@/utils/room-drag-latency';
import { IDLE_ROOM_DRAG, roomDragAnchor, snapshotRoomDragObject, type RoomDragBase, type RoomDragMotion, type RoomDragPreview } from '@/utils/room-drag-motion';
import { ambiguousRoomItems, selectedRoomItemAtPoint } from '@/utils/room-selection';
import { roomPlacementAccess } from '@/utils/room-placement-access';
import { markDecorationTiming } from '@/utils/decoration-timing';
import { setRoomPreview } from '@/utils/native-room-preview';
import { clampRoomCamera, roomEditingFrame } from '@/utils/room-camera';
import type { CatTravelMotion } from '@/utils/native-cat-locomotion';
import { isOpenableDecorationId, isDecorationOpen, itemInteraction } from '@/constants/item-interactions';
import type { RoomDecorationEntry, RoomDecorationTarget } from "@/utils/room-decoration-entry";
import type { SpotlightAim } from '@/utils/native-spotlight-aim';
import { curtainAtWindow } from '@/utils/native-curtains';
import { isWindowLightSource } from '@/utils/native-window-light';
import { ROOM_COMMANDS, getRoomCommands, roomCommandLabel } from "@/constants/room-commands";
import { useGraphicsMode } from "@/lib/graphics-mode";
import { getCatRoomSource } from "@/constants/cat-rooms";
import { canFeedForEffect } from "@/utils/pet-care";
import { CAT_PLAY_ACTIVITIES, type CatPlayActivity } from "@/constants/cat-play";
import { GestureDetector } from "react-native-gesture-handler";
import { useRoomCamera } from "@/hooks/use-room-camera";
import { NativeRoomScene, type NativeRoomPicker } from "@/components/pet/native/NativeRoomScene";
import { RoomPlacementOverlay } from '@/components/pet/RoomPlacementOverlay';
import type { RoomObjectEdit, RoomPlacementDraft, storedRoomItems } from '@/utils/room-edit';
import { attachRoomObject, transformRoomObject, moveRoomSupportGroup, roomSupport, roomSupportGroup } from '@/utils/room-support';
import { RoomActivityNotice } from '@/components/pet/RoomActivityNotice';
import { NativeRoomEditor } from "@/components/pet/NativeRoomEditor";
import { catFloorPoint, catScreenPoint, placeObjectOnSurface, buildNativeRoomWorld, nativeObjectPlacementOffset, nativeRoomEdge, projectWorld, ROOM_SPAN, NATIVE_MODEL_CATALOG, type NativeRoomObject, type Vec3 } from "@/utils/native-room-world";
import { createRoomPlacementResolver, createRoomPlacementResolverCache, roomPlacementStatus, roomItemAnchor, type RoomPlacementFeedback } from '@/utils/room-item-placement';
import { useSharedValue as useDrawingSharedValue } from 'react-native-worklets-core';
import { lampSwitchPosition } from '@/utils/native-lamp-light';
import { fireplaceLightPosition } from '@/utils/native-fireplace';
import { RoomActionMenu } from '@/components/pet/RoomActionMenu';
import type { RoomSceneSlide } from "@/hooks/use-room-transition";
import { DEFAULT_HOME_ROOM_ID, HOME_ROOM_IDS, HOME_ROOM_ICONS, isRoomDoor, type HomeRoomId, type RoomEntry } from "@/constants/home-rooms";
import { RoomEditorSheet, RoomOverlapChooser, type RoomEditorControls } from "@/components/pet/RoomEditorSheet";
import { RoomToolTransition } from "@/components/pet/RoomToolTransition";
import { RoomControlsTransition } from "@/components/pet/RoomControlsTransition";
import { RoomItemMoveControls } from "@/components/pet/RoomItemMoveControls";
import { RoomSpotlightControls } from "@/components/pet/RoomSpotlightControls";
import { RoomRotationControls } from "@/components/pet/RoomRotationControls";
import { getRoomItemRotation } from "@/utils/room-rotation";
import { AppIcon } from "@/components/ui/AppIcon";
import { roomActivityStepKey, roomOffsetToPoint, type RoomActivityCommand, type RoomActivityKind } from "@/utils/room-activities";
import { createRoomActivitySegment } from "@/pet-display/registry/cat-model-registry";
import { useRoomActivity, type BlockedRoomActivity } from "@/hooks/use-room-activity";
import { getPetMediaRegistry } from "@/pet-display/registry/media-registry";
import { isFridgeDecorationId, isCurtainDecorationId, isPoweredDecorationId, isWallSpotlightDecorationId, normalizeSpotlightAngle, normalizeSpotlightSwivel } from "@/constants/decoration-motion";
import { DecorationSpriteImage } from "@/components/pet/DecorationSpriteImage";
import { SimpleLampLight } from '@/components/pet/SimpleLampLight';
import { WorldRoomTint } from '@/components/pet/WorldRoomTint';
import type { WorldClock, WorldPeriod } from '@/utils/world-clock';
import { useWorldPeriod } from '@/hooks/use-world-period';
import { DraggableRoomPet } from "@/components/pet/DraggableRoomPet";
import { PetSpeechBubble } from "@/components/pet/PetSpeechBubble";
import type { RoomItemMenuAction } from "@/components/pet/RoomActionMenu";
import { ToySpriteImage } from "@/components/pet/ToySpriteImage";
import { PetStatsPanel } from "@/components/pet/PetStatsPanel";
import { getBedDisplaySize, getCatBedSource, canFlipBed, canScaleBedDown, canScaleBedUp, getEquippedBedScale } from "@/constants/cat-beds";
import { isWindowDecorationId } from "@/constants/window-decorations";
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
  scaleDecorationBy,
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
  roomLayerItemKey,
  ROOM_MENU_OPEN_Z_INDEX,
  ROOM_PET_LAYER_Z_INDEX,
} from "@/utils/room-layer-order";
import { moderateScale } from "@/utils/scale";
import { getRoomObjectDepthAnchor, isRoomBackgroundDecoration } from "@/utils/room-depth";
import { cloneElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Animated, { useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue } from "react-native-reanimated";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
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

export type RoomActivityFailureNotice = {
  roomId: HomeRoomId;
  target?: string;
  onMove: () => void;
  onDismiss: () => void;
};

type PetStageProps = {
  placementDraft?: RoomPlacementDraft;
  onCancelPlacementDraft?: () => void;
  onCommitRoomEdit?: (edits: RoomObjectEdit[], remove?: string[]) => boolean;
  storedItems?: ReturnType<typeof storedRoomItems>;
  onPlaceStoredItem?: (target: RoomDecorationTarget) => void;
  roomToolbar?: { decorating: boolean; onDecoratingChange: (roomId: HomeRoomId, active: boolean) => void };
  decorationEntry?: RoomDecorationEntry | null;
  onDecorationEntryConsumed?: () => void;
  worldClock?: WorldClock;
  roomEditor?: RoomEditorControls;
  homeRoomId?: HomeRoomId;
  onVisitHomeRoom?: (roomId: HomeRoomId) => void;
  catHomeRoomId?: HomeRoomId;
  roomVisible?: boolean;
  nativeSceneMounted?: boolean;
  roomEntry?: RoomEntry;
  sceneSlide?: RoomSceneSlide;
  onSceneReady?: (roomId: HomeRoomId) => void;
  onSendCatToRoom?: (roomId: HomeRoomId, ambientPeriod?: WorldPeriod, motion?: CatTravelMotion) => void;
  roomCommand?: RoomActivityCommand;
  onRequestRoomCommand?: (roomId: HomeRoomId, kind: RoomActivityKind, instanceId?: string, interactionAt?: number) => void;
  onRoomCommandAccepted?: (id: number) => void;
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
  onRoomActivityCompleted?: (kind: RoomActivityKind, instanceId?: string) => void;
  onRoomActivityFailure?: (notice: RoomActivityFailureNotice) => void;
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
  onSetRoomItemRotation?: (item: RoomLayerItem, degrees: number, offset?: RoomItemOffset) => void;
  onFlipPlacedDecorationWall?: (instanceId: string) => void;
  onAimPlacedSpotlight?: (instanceId: string, angle: number, swivel?: number) => void;
  onTogglePlacedDecorationOpen?: (instanceId: string) => void;
  onTogglePlacedCurtain?: (instanceId: string) => void;
  onTogglePlacedFridge?: (instanceId: string, opening?: "full" | "ajar") => void;
  onFlipPlacedFridgeHinge?: (instanceId: string) => void;
  onTogglePlacedDecorationPower?: (instanceId: string) => void;
  onScalePlacedDecoration?: (
    instanceId: string,
    direction: "up" | "down",
    offset?: RoomItemOffset,
  ) => void;
  onMoveRoomLayerItem?: (item: RoomLayerItem, direction: "up" | "down") => void;
  onBedRemove?: () => void;
  onFlipBed?: () => void;
  onScaleBed?: (direction: "up" | "down", offset?: RoomItemOffset) => void;
  onPlacedToyRemove?: (instanceId: string) => void;
  onScalePlacedToy?: (instanceId: string, direction: "up" | "down", offset?: RoomItemOffset) => void;
  onOpenMathStats?: () => void;
  onAnimationComplete?: () => void;
  onStepComplete?: (stepIndex: number) => void;
};

export function PetStage({
  placementDraft, onCancelPlacementDraft, onCommitRoomEdit, storedItems = [], onPlaceStoredItem,
  roomToolbar,
  decorationEntry,
  onDecorationEntryConsumed,
  worldClock,
  roomEditor,
  homeRoomId = DEFAULT_HOME_ROOM_ID,
  onVisitHomeRoom,
  catHomeRoomId = homeRoomId,
  roomVisible = true,
  roomEntry,
  sceneSlide,
  onSceneReady,
  onSendCatToRoom,
  roomCommand,
  onRequestRoomCommand,
  onRoomCommandAccepted,
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
  onRoomActivityCompleted,
  onRoomActivityFailure,
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
  onTogglePlacedCurtain,
  onTogglePlacedFridge,
  onTogglePlacedDecorationOpen,
  onFlipPlacedFridgeHinge,
  onAimPlacedSpotlight,
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
  const editingObject = useDrawingSharedValue<NativeRoomObject | undefined>(undefined);
  const dragMotion = useSharedValue<RoomDragMotion>(IDLE_ROOM_DRAG);
  const dragBase = useSharedValue<RoomDragBase | undefined>(undefined);
  const dragPlacement = useRef<{ session: number; id: string; resolve: ReturnType<typeof createRoomDragPlacement> } | undefined>(undefined);
  const measureDrag = useSharedValue(false);
  useEffect(() => registerRoomDragLatency(measureDrag), [measureDrag]);
  const dragX = useDerivedValue(() => roomDragAnchor(dragBase.get(), dragMotion.get(), { x: 0, y: 0 }).x);
  const dragY = useDerivedValue(() => roomDragAnchor(dragBase.get(), dragMotion.get(), { x: 0, y: 0 }).y);
  const dragPosition = useMemo(() => ({ x: dragX, y: dragY }), [dragX, dragY]);
  const spotlightAim = useDrawingSharedValue<SpotlightAim | undefined>(undefined);
  const nativePicker = useRef<NativeRoomPicker | undefined>(undefined);
  const pickNativeItem = useCallback((point: { x: number; y: number }) =>
    nativePicker.current?.pick(point.x, point.y) ?? Promise.resolve(undefined), []);
  const clearLivePosition = useCallback((id: string) => setLivePositions(current => {
    if (!(id in current)) return current;
    const next = { ...current }; delete next[id]; return next;
  }), []);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
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
  const layerOrder = useMemo(() => normalizeRoomLayerOrder({
    bedId,
    placedDecorations: roomPlacedDecorations,
    placedToys: roomPlacedToys,
    roomLayerOrder,
  }), [bedId, roomPlacedDecorations, roomPlacedToys, roomLayerOrder]);
  const removeMenuLabel = t("home.putAway");
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
  const [localDecorating, setLocalDecorating] = useState(false);
  const decorating = roomToolbar?.decorating ?? localDecorating;
  const sceneStatus = useRef({ roomVisible, decorating });
  useLayoutEffect(() => { sceneStatus.current = { roomVisible, decorating }; }, [roomVisible, decorating]);
  const handleSceneReady = useCallback(() => { if (placementDraft && sceneStatus.current.roomVisible) markDecorationTiming('scenePainted'); onSceneReady?.(homeRoomId); }, [homeRoomId, onSceneReady, placementDraft]);
  const onDecoratingChange = roomToolbar?.onDecoratingChange;
  const setDecorating = useCallback((active: boolean) => {
    if (onDecoratingChange) onDecoratingChange(homeRoomId, active);
    else setLocalDecorating(active);
  }, [homeRoomId, onDecoratingChange]);
  const [waitingToDecorate, setWaitingToDecorate] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [snap, setSnap] = useState(false);
  const [selectedMoveItem, setSelectedMoveItem] = useState<RoomLayerItem | null>(null);
  const [placementFeedback, setPlacementFeedback] = useState<RoomPlacementFeedback>();
  const dragFeedback = useRef<RoomPlacementFeedback | undefined>(undefined);
  useLayoutEffect(() => { dragFeedback.current = placementFeedback; }, [placementFeedback]);
  const [editNotice, setEditNotice] = useState<string>();
  const [pendingMove, setPendingMove] = useState(false);
  const [draggingRoomItem, setDraggingRoomItem] = useState(false);
  const [tapToMove, setTapToMove] = useState(false);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [overlapChoices, setOverlapChoices] = useState<string[]>([]);
  const heldSnap = useRef<NativeRoomObject | undefined>(undefined);
  const [spotlightPreview, setSpotlightPreview] = useState<{ instanceId: string; angle: number; swivel: number } | null>(null);
  const [rotationPreview, setRotationPreview] = useState<{ item: RoomLayerItem; degrees: number } | null>(null);
  const [rotationOrigin, setRotationOrigin] = useState<NativeRoomObject>();
  const movingItem = decorating && selectedMoveItem
    ? layerOrder.find(item => isSameRoomLayerItem(item, selectedMoveItem))
    : undefined;
  if ((!decorating || !roomVisible || !movingItem) && (pendingMove || placementFeedback || tapToMove)) {
    setPendingMove(false); setPlacementFeedback(undefined); setTapToMove(false);
  }
  // Clear transient previews when their room or selection disappears.
  if ((rotationPreview || spotlightPreview) && (!decorating || !roomVisible || !movingItem)) {
    setRotationPreview(null);
    setSpotlightPreview(null);
  }
  const displayWidth = avatarWidth;
  const catPresent = catHomeRoomId === homeRoomId;
  const hasRoomNavigation = compact && usesNativeCat && !!onVisitHomeRoom;
  const editingDockHeight = Math.min(moderateScale(260), Math.max(160, viewport.height * .55));
  const editingFrame = decorating && compact && usesNativeCat
    ? roomEditingFrame(viewport.width, viewport.height, editingDockHeight, moderateScale(74), hasRoomNavigation ? ROOM_NAVIGATION_HEIGHT : 0, moderateScale(roomToolbar ? 66 : 116))
    : { overlap: 0, scale: 1, y: 0 };
  const { x: sceneX, y: sceneY, scale: sceneScale, zoom: cameraZoom, gesture: roomGesture } = useRoomCamera(viewport.width, viewport.height, compact && usesNativeCat, reduceMotion, !decorating, editingFrame.scale, editingFrame.y);
  const zoom = cameraZoom * editingFrame.scale;
  const petSceneX = useSharedValue(0);
  const petSceneY = useSharedValue(0);
  const speechHeight = useSharedValue(0);
  const hungry = stats.hunger < 30;
  const asleep = playback.kind === "segment" && playback.mood === "sleeping";
  const canFeed = canFeedForEffect(stats, asleep);
  const canSendCatToRoom = !!onSendCatToRoom;
  const period = useWorldPeriod(worldClock, (roomVisible || catPresent) && !decorating);
  const nativeWorldOptions = useMemo(() => ({
      width: viewport.width, height: viewport.height, petSize: displayWidth, sizeScale: moderateScale(100) / 100 * ROOM_OBJECT_SCALE,
      homeOffset: roomPetOffset, bedId, bedOffset: roomBedOffset, bedFlipped, bedScale,
      bedRotationDegrees, decorations: roomPlacedDecorations, toys: roomPlacedToys, livePositions, layerOrder: roomLayerOrder,
    }), [bedFlipped, bedRotationDegrees, bedId, bedScale, displayWidth, livePositions, roomBedOffset, roomPetOffset, roomPlacedDecorations, roomPlacedToys, roomLayerOrder, viewport.height, viewport.width]);
  const savedNativeWorld = useMemo(() => buildNativeRoomWorld(nativeWorldOptions), [nativeWorldOptions]);
  const resolveRotation = useCallback((item: RoomLayerItem, degrees: number) => {
    const saved = savedNativeWorld;
    const instanceId = item.kind === "bed" ? "bed" : item.instanceId;
    const preview = buildNativeRoomWorld({ ...nativeWorldOptions,
      bedRotationDegrees: item.kind === "bed" ? degrees : bedRotationDegrees,
      decorations: item.kind === "decoration" ? roomPlacedDecorations.map(entry => entry.instanceId === instanceId ? { ...entry, rotationDegrees: degrees } : entry) : roomPlacedDecorations,
      toys: item.kind === "toy" ? roomPlacedToys.map(entry => entry.instanceId === instanceId ? { ...entry, rotationDegrees: degrees } : entry) : roomPlacedToys,
    });
    const id = instanceId;
    const before = saved.objects.find(object => object.instanceId === id), after = preview.objects.find(object => object.instanceId === id);
    const ids = before ? roomSupportGroup(saved.objects, [before.instanceId, ...groupIds]).map(object => object.instanceId) : [];
    const resolver = createRoomPlacementResolver(saved, ids);
    const rotationBase = rotationOrigin?.instanceId === id ? rotationOrigin : before?.supportId ? before : undefined;
    const rotated = before && rotationBase
      ? transformRoomObject(rotationBase, rotationBase.position, before.heading + degrees * Math.PI / 180
        - getRoomItemRotation({ bedId, bedRotationDegrees, placedDecorations, placedToys }, item) * Math.PI / 180) : after;
    const adjusted = before && rotated ? viewport.width <= 0 ? rotated : resolver.rotate(before, rotated) : undefined;
    if (!adjusted) return { world: saved, allowed: false, offset: undefined };
    const point = roomItemAnchor(adjusted, viewport.width);
    const size = adjusted.scale * viewport.width * NATIVE_MODEL_CATALOG[adjusted.modelId].renderScale / ROOM_SPAN;
    const offset = adjusted.position.some((value, i) => Math.abs(value - after!.position[i]) > 1e-8)
      ? { x: point.x / Math.max(1, (viewport.width - size) / 2), y: point.y / Math.max(1, (viewport.height - size) / 2) } : undefined;
    // An angle preview changes one instance. Other models and decals retain
    // their references and native transforms throughout the slider gesture.
    const objects = moveRoomSupportGroup(saved.objects, before!, adjusted, groupIds);
    const allowed = objects.every(object => resolver.canPlace(object) && (!object.supportId || placeObjectOnSurface(
      { ...object, supportId: undefined }, [...saved.objects.filter(entry => !ids.includes(entry.instanceId)), ...objects], viewport.width).supportId === object.supportId));
    return { world: { ...saved, objects: saved.objects.map(object => objects.find(moved => moved.instanceId === object.instanceId) ?? object) }, allowed, offset };
  }, [savedNativeWorld, nativeWorldOptions, bedId, bedRotationDegrees, placedDecorations, placedToys, roomPlacedDecorations, roomPlacedToys, viewport.height, viewport.width, groupIds, rotationOrigin]);
  const rotationPlacement = useMemo(() => rotationPreview
    ? resolveRotation(rotationPreview.item, rotationPreview.degrees)
    : { world: savedNativeWorld, allowed: true, offset: undefined }, [resolveRotation, rotationPreview, savedNativeWorld]);
  const nativeWorld = rotationPlacement.world;
  const openRotation = useCallback((item: RoomLayerItem) => {
    const pose = editingObject.value;
    const id = item.kind === 'bed' ? 'bed' : item.instanceId;
    const saved = savedNativeWorld.objects.find(object => object.instanceId === id);
    const delta = pose?.instanceId === id && saved ? (pose.heading - saved.heading) * 180 / Math.PI : 0;
    setRotationOrigin(pose);
    setRoomPreview(editingObject, undefined);
    setPlacementFeedback(undefined);
    setSelectedMoveItem(item);
    setSpotlightPreview(null);
    setRotationPreview({ item, degrees: getRoomItemRotation({ bedId, bedRotationDegrees, placedDecorations, placedToys }, item) + delta });
  }, [savedNativeWorld, bedId, bedRotationDegrees, editingObject, placedDecorations, placedToys, setSelectedMoveItem, setRotationPreview, setSpotlightPreview, setPlacementFeedback, setRotationOrigin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    if (!spotlightPreview) spotlightAim.value = undefined;
  }, [spotlightPreview, spotlightAim]);
  const editingIds = useMemo(() => roomSupportGroup(nativeWorld.objects, [
    ...(selectedMoveItem ? [selectedMoveItem.kind === 'bed' ? 'bed' : selectedMoveItem.instanceId] : []), ...groupIds,
  ]).map(object => object.instanceId), [nativeWorld, selectedMoveItem, groupIds]);
  const resolvePlacement = useMemo(() => createRoomPlacementResolverCache(), []);
  const placement = useMemo(() => resolvePlacement(nativeWorld, editingIds), [resolvePlacement, nativeWorld, editingIds]);
  const suggestionStarted = useRef<RoomPlacementDraft | undefined>(undefined);
  const suggestionAbort = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    if (!placementDraft || !movingItem || !roomVisible || viewport.width <= 0 || suggestionStarted.current === placementDraft) return;
    suggestionStarted.current = placementDraft;
    markDecorationTiming('roomMounted');
    const id = placementDraft.item.kind === 'bed' ? 'bed' : placementDraft.item.instanceId;
    const object = nativeWorld.objects.find(object => object.instanceId === id);
    if (!object) return;
    const controller = new AbortController(); suggestionAbort.current = controller;
    const frame = requestAnimationFrame(() => {
      setPendingMove(true);
      setRoomPreview(editingObject, object);
      setPlacementFeedback(placement.feedback(object));
      markDecorationTiming('initialPreviewReady');
      void (async () => {
      const window = isCurtainDecorationId(object.modelId) && nativeWorld.objects.find(other => isWindowLightSource(other.modelId) && other.wallAxis === object.wallAxis);
      const fitted = window ? curtainAtWindow(object, window) : undefined;
      const suggestion = fitted && placement.canPlace(fitted) ? fitted : await placement.nearestFreeAsync(object, controller.signal, true);
      if (controller.signal.aborted) return;
      markDecorationTiming('suggestionReady');
      controller.abort();
      const candidate = suggestion ?? object;
      setRoomPreview(editingObject, { ...candidate, position: [...candidate.position] });
      setPlacementFeedback(placement.feedback(candidate));
    })(); });
    return () => { if (!controller.signal.aborted) suggestionStarted.current = undefined; controller.abort(); cancelAnimationFrame(frame); };
  }, [placementDraft, roomVisible, viewport.width, nativeWorld, placement, editingObject, movingItem]);
  const cancelMove = useCallback(() => {
    dragPlacement.current = undefined;
    dragBase.set(undefined); setDraggingRoomItem(false);
    suggestionAbort.current?.abort(); heldSnap.current = undefined;
    setRoomPreview(editingObject, undefined);
    setPendingMove(false); setTapToMove(false); setPlacementFeedback(undefined); setEditNotice(undefined);
    setRotationPreview(null); setSpotlightPreview(null);
    onCancelPlacementDraft?.();
  }, [dragBase, editingObject, onCancelPlacementDraft, setPendingMove, setTapToMove, setPlacementFeedback, setEditNotice, setRotationPreview, setSpotlightPreview]);
  const accessCache = useRef<{ key: string; optional: boolean; result: ReturnType<typeof roomPlacementAccess> } | undefined>(undefined);
  const checkAccess = useCallback((objects: NativeRoomObject[], remove: string[] = [], includeOptional = false) => {
    const start = catFloorPoint({ x: petSceneX.get(), y: petSceneY.get() }, nativeWorld);
    const key = JSON.stringify([start, nativeWorld.objects.map(object => [object.instanceId, object.position, object.heading, object.scale]),
      objects.map(object => [object.instanceId, object.position, object.heading, object.scale]), remove]);
    if (accessCache.current?.key === key && (!includeOptional || accessCache.current.optional)) return accessCache.current.result;
    const after = { ...nativeWorld, objects: nativeWorld.objects.filter(object => !remove.includes(object.instanceId))
      .map(object => objects.find(candidate => candidate.instanceId === object.instanceId) ?? object) };
    const result = roomPlacementAccess(nativeWorld, after, start, includeOptional);
    accessCache.current = { key, result, optional: includeOptional };
    return result;
  }, [nativeWorld, petSceneX, petSceneY]);
  const commitObjects = useCallback((objects: NativeRoomObject[], remove: string[] = []) => {
    if (!onCommitRoomEdit) return false;
    const access = checkAccess(objects, remove);
    if (access.blockedExit) {
      setPlacementFeedback(current => current ? { ...current, access: 'blocked' } : current);
      setEditNotice(t('home.catExitWarning')); setPendingMove(true); return false;
    }
    const edits = objects.map(object => {
      const original = savedNativeWorld.objects.find(item => item.instanceId === object.instanceId)!;
      const item = layerOrder.find(item => (item.kind === 'bed' ? 'bed' : item.instanceId) === object.instanceId);
      const point = roomItemAnchor(object, viewport.width);
      const size = object.scale * viewport.width * NATIVE_MODEL_CATALOG[object.modelId].renderScale / ROOM_SPAN;
      const parent = object.supportId && (objects.find(item => item.instanceId === object.supportId)
        ?? nativeWorld.objects.find(item => item.instanceId === object.supportId));
      return { instanceId: object.instanceId,
        offset: { x: point.x / Math.max(1, (viewport.width - size) / 2), y: point.y / Math.max(1, (viewport.height - size) / 2) },
        rotationDegrees: (item ? getRoomItemRotation({ bedId, bedRotationDegrees, placedDecorations, placedToys }, item) : 0)
          + (object.heading - original.heading) * 180 / Math.PI,
        support: parent ? roomSupport(object, parent) : undefined,
        scale: (item?.kind === 'bed' ? getEquippedBedScale(bedScale)
          : item?.kind === 'toy' ? getPlacedToyScale(roomPlacedToys.find(entry => entry.instanceId === item.instanceId)!)
            : item?.kind === 'decoration' ? getPlacedDecorationScale(roomPlacedDecorations.find(entry => entry.instanceId === item.instanceId)!) : 1) * object.scale / original.scale };
    });
    if (catPresent) {
      const point = catScreenPoint(access.origin, nativeWorld);
      edits.push({ instanceId: 'cat', offset: { x: point.x / Math.max(1, (viewport.width - displayWidth) / 2),
        y: point.y / Math.max(1, (viewport.height - displayWidth) / 2) }, rotationDegrees: 0, scale: 1, support: undefined });
    }
    const accepted = onCommitRoomEdit(edits, remove);
    if (!accepted) setEditNotice(t('home.layoutChanged'));
    if (accepted) {
      heldSnap.current = undefined; setPendingMove(false); setPlacementFeedback(undefined); setTapToMove(false);
      setRoomPreview(editingObject, undefined);
    }
    return accepted;
  }, [onCommitRoomEdit, savedNativeWorld, nativeWorld, layerOrder, viewport, bedId, bedRotationDegrees, placedDecorations, placedToys, editingObject, bedScale, roomPlacedToys, roomPlacedDecorations, setPendingMove, setPlacementFeedback, setTapToMove, checkAccess, setEditNotice, t, catPresent, displayWidth]);
  const previewPlacement = useCallback((id: string, point: { x: number; y: number }, snapping = true, session?: number) => {
    const captured = dragPlacement.current;
    const resolved = captured?.id === id && captured.session === session ? captured.resolve(point) : undefined;
    const preview = resolved ? { object: resolved.object, point, snapped: false,
      feedback: { ...placement.feedback(resolved.object), unsupportedSurfaceId: resolved.unsupportedSurfaceId } }
      : placement.preview(id, point, zoom, heldSnap.current, snapping);
    const original = nativeWorld.objects.find(object => object.instanceId === id);
    if (!preview || !original) return undefined;
    if (!resolved) heldSnap.current = preview.snapped ? preview.object : undefined;
    const previous = editingObject.value?.instanceId === id ? editingObject.value : undefined;
    if (!resolved && previous && (previous.heading !== original.heading || previous.scale !== original.scale)) {
      preview.object = transformRoomObject(preview.object, preview.object.position, previous.heading, previous.scale);
      preview.point = roomItemAnchor(preview.object, viewport.width);
      if (preview.object.supportId && placeObjectOnSurface({ ...preview.object, supportId: undefined }, nativeWorld.objects, viewport.width, true).supportId !== preview.object.supportId) {
        preview.feedback.unsupportedSurfaceId = preview.object.supportId;
      }
    }
    const objects = moveRoomSupportGroup(nativeWorld.objects, original, preview.object, groupIds);
    const details = objects.map(object => object === preview.feedback.candidate ? preview.feedback : placement.feedback(object));
    const feedback = { candidate: preview.object, snapped: preview.snapped, unsupportedSurfaceId: preview.feedback.unsupportedSurfaceId, boundaries: [...new Set(details.flatMap(detail => detail.boundaries))],
      blockers: [...new Map(details.flatMap(detail => detail.blockers).map(blocker => [blocker.instanceId, blocker])).values()] };
    return { ...preview, objects, feedback, accepted: !feedback.boundaries.length && !feedback.blockers.length && !feedback.unsupportedSurfaceId };
  }, [placement, nativeWorld, groupIds, zoom, editingObject, viewport.width]);
  const resizeSelection = useCallback((item: RoomLayerItem, direction: 'up' | 'down') => {
    const id = item.kind === 'bed' ? 'bed' : item.instanceId;
    const original = nativeWorld.objects.find(object => object.instanceId === id);
    if (!original) return;
    const before = editingObject.value?.instanceId === id ? editingObject.value : original;
    const currentScale = item.kind === 'bed' ? getEquippedBedScale(bedScale) : item.kind === 'toy'
      ? getPlacedToyScale(roomPlacedToys.find(entry => entry.instanceId === id)!)
      : getPlacedDecorationScale(roomPlacedDecorations.find(entry => entry.instanceId === id)!);
    const scale = scaleDecorationBy(currentScale * before.scale / original.scale, direction, item.kind === 'decoration' ? item.decorationId as CatDecorationId : undefined);
    const next = transformRoomObject(before, before.position, before.heading, original.scale * scale / currentScale);
    const adjusted = placement.resize(before, next);
    if (!adjusted) { setEditNotice(t('home.resizeBlocked')); return; }
    const objects = moveRoomSupportGroup(nativeWorld.objects, original, adjusted);
    // Supported items keep their own size while their attachment follows the resized support.
    for (let i = 1; i < objects.length; i++) {
      const child = nativeWorld.objects.find(object => object.instanceId === objects[i].instanceId)!;
      const parent = nativeWorld.objects.find(object => object.instanceId === child.supportId);
      const nextParent = objects.find(object => object.instanceId === child.supportId);
      if (parent && nextParent) objects[i] = attachRoomObject(child, nextParent, roomSupport(child, parent));
    }
    if (!objects.every(object => placement.canPlace(object) && (!object.supportId || placeObjectOnSurface(
      { ...object, supportId: undefined }, [...nativeWorld.objects.filter(entry => !editingIds.includes(entry.instanceId)), ...objects], viewport.width).supportId === object.supportId))) {
      setEditNotice(t('home.resizeBlocked')); return;
    }
    setEditNotice(undefined);
    if (pendingMove || placementDraft) {
      setRoomPreview(editingObject, { ...adjusted, editingChildren: objects.slice(1) });
      setPendingMove(true); setPlacementFeedback(placement.feedback(adjusted));
    } else commitObjects(objects);
  }, [nativeWorld, editingObject, bedScale, roomPlacedToys, roomPlacedDecorations, placement, editingIds, viewport.width, pendingMove, placementDraft, commitObjects, t, setEditNotice, setPendingMove, setPlacementFeedback]);
  const livePosition = useCallback((id: string, point: { x: number; y: number }, motion?: RoomDragMotion) => {
    if (id === 'cat') { setLivePositions(current => ({ ...current, [id]: point })); return point; }
    suggestionAbort.current?.abort();
    markDecorationTiming('firstMove');
    const moved = previewPlacement(id, point, true, motion?.session);
    if (!moved) return point;
    const object = { ...moved.object, position: [...moved.object.position] as Vec3,
      editingChildren: moved.objects.filter(object => object.instanceId !== id) };
    if (motion) {
      dragBase.set({ session: motion.session, version: motion.sequence + 1, x: motion.x, y: motion.y,
        width: viewport.width, anchor: moved.point, object });
    } else setRoomPreview(editingObject, object);
    if (!motion || !sameRoomDragFeedback(dragFeedback.current, moved.feedback)) {
      dragFeedback.current = moved.feedback;
      setEditNotice(undefined); setPlacementFeedback(moved.feedback); setPendingMove(true);
    }
    return moved.point;
  }, [dragBase, viewport.width, editingObject, previewPlacement, setPlacementFeedback, setPendingMove, setLivePositions, setEditNotice]);
  const finishPlacement = useCallback((id: string, point: { x: number; y: number }, motion?: RoomDragMotion) => {
    setEditNotice(undefined);
    const drop = previewPlacement(id, point, true, motion?.session);
    if (!drop) return point;
    const preview: RoomDragPreview = { ...drop.object, editingChildren: drop.objects.filter(object => object.instanceId !== id),
      dragSample: motion?.measure ? { session: motion.session, sequence: motion.sequence, inputAt: motion.at, phase: 'release' } : undefined };
    setRoomPreview(editingObject, preview);
    setPlacementFeedback(drop.feedback);
    if (drop.accepted) commitObjects(drop.objects);
    else { setPendingMove(true); setPlacementFeedback(drop.feedback); }
    return drop.point;
  }, [editingObject, previewPlacement, commitObjects, setPendingMove, setPlacementFeedback, setEditNotice]);
  useEffect(() => {
    if (!decorating || !roomVisible || !movingItem) {
      setRoomPreview(editingObject, undefined);
      heldSnap.current = undefined;
      suggestionAbort.current?.abort();
    }
  }, [decorating, roomVisible, movingItem, editingObject]);
  const activityOptions = useMemo(() => ({
    nativeWorld, nativeStepCompletion: nativeRendering,
    homeRoomId, entry: roomEntry,
    width: viewport.width, height: viewport.height, petSize: displayWidth,
    sizeScale: moderateScale(100) / 100 * ROOM_OBJECT_SCALE,
    homeOffset: roomPetOffset ?? { x: 0, y: 0.12 },
    decorations: roomPlacedDecorations,
    toys: placedToys ?? [], ownedToyIds: ownedToyIds ?? [],
    bedId, bedOffset: roomBedOffset, hungry, asleep, period,
  }), [bedId, roomBedOffset, nativeRendering, homeRoomId, roomEntry, nativeWorld, displayWidth, ownedToyIds, placedToys, asleep, hungry, period, roomPetOffset, roomPlacedDecorations, viewport.height, viewport.width]);
  const entryPosition = useMemo(() => roomEntry ? nativeRoomEdge(nativeWorld, roomEntry.direction === 1 ? -1 : 1) : undefined, [nativeWorld, roomEntry]);
  const handleReadyToDecorate = useCallback(() => {
    setWaitingToDecorate(false);
    setDecorating(true);
  }, [setWaitingToDecorate, setDecorating]);
  const blockedActivityHandler = useRef<((failure: BlockedRoomActivity) => void) | null>(null);
  const { activity: roomActivity, commandAttention, blockedActivity, clearBlockedActivity, scale: activityScale, facing: activityFacing,
    objectX, objectY, startActivity, returnHome, stopActivity, updateNativeHeight, updateObjectPosition, completeNativeStep } = useRoomActivity(activityOptions,
    compact && usesNativeCat && graphicsMode !== "loading" && catPresent && !decorating && !roomActivityBlocked,
    lastInteractionAt, petSceneX, petSceneY, (instanceId, motion) => {
      const door = roomPlacedDecorations.find(item => item.instanceId === instanceId);
      if (door?.doorDestination) {
        if(onSendCatToRoom)onSendCatToRoom(door.doorDestination,undefined,motion);
        else onVisitHomeRoom?.(door.doorDestination);
      }
    }, onFeed, onSendCatToRoom, roomVisible, decorating, handleReadyToDecorate, onRoomActivityCompleted,
    failure => blockedActivityHandler.current?.(failure));
  // Activity actions capture the current visibility/travel guards. Menus only
  // need their latest implementation when pressed, not a rebuild on navigation.
  const menuActivity = useRef({ startActivity, returnHome });
  useLayoutEffect(() => { menuActivity.current = { startActivity, returnHome }; }, [startActivity, returnHome]);
  const startMenuActivity = useCallback<typeof startActivity>((...args) => menuActivity.current.startActivity(...args), []);
  const returnFromMenuActivity = useCallback(() => menuActivity.current.returnHome(), []);
  const sofaApproach = roomActivity?.plan.steps[roomActivity.stepIndex]?.sofaApproach;
  const handledRoomCommand = useRef(0);
  useEffect(() => {
    if (!roomCommand || handledRoomCommand.current === roomCommand.id || !compact || !usesNativeCat || !catPresent
      || decorating || roomActivityBlocked || graphicsMode === 'loading'
      || viewport.width <= displayWidth || viewport.height <= displayWidth) return;
    handledRoomCommand.current = roomCommand.id;
    startActivity(roomCommand.kind, roomCommand.instanceId, roomCommand.interactionAt, roomCommand.ambientPeriod);
    onRoomCommandAccepted?.(roomCommand.id);
  }, [catPresent, compact, decorating, displayWidth, graphicsMode, onRoomCommandAccepted,
    roomActivityBlocked, roomCommand, startActivity, usesNativeCat, viewport.height, viewport.width]);
  useEffect(() => {
    if (!decorationEntry || decorationEntry.roomId !== homeRoomId || !roomVisible) return;
    // Consume a one-shot navigation command and synchronize the native activity exit.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedMoveItem(decorationEntry.item ?? null);
    setShowEditor(false);
    setPlacementFeedback(undefined);
    setRotationPreview(null);
    setSpotlightPreview(null);
    if (roomActivity) {
      setWaitingToDecorate(true);
      stopActivity();
    } else {
      setDecorating(true);
    }
    onDecorationEntryConsumed?.();
  }, [decorationEntry, homeRoomId, roomVisible, roomActivity, stopActivity, onDecorationEntryConsumed, setDecorating]);
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
    setNativeHitPositions(current => current[id]?.x === point.x && current[id]?.y === point.y
      ? current : { ...current, [id]: point });
    if (id === playingId) { objectX.set(point.x); objectY.set(point.y); }
    if (settled && center && sceneStatus.current.roomVisible && !sceneStatus.current.decorating) {
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
  }, [nativeWorld, objectX, objectY, onPlacedDecorationOffsetChange, onPlacedToyOffsetChange, playingId, roomPlacedDecorations, roomPlacedToys, updateObjectPosition]);
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
      { translateY: sceneY.get() + editingFrame.y },
      { scale: sceneScale.get() * editingFrame.scale },
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
        if (item.kind === "decoration" && isOpenableDecorationId(item.decorationId) && onTogglePlacedDecorationOpen) return true;
        if (item.kind === "decoration" && isRoomDoor(item.decorationId)) return Boolean(canSendCatToRoom && roomPlacedDecorations.find(placed=>placed.instanceId===item.instanceId)?.doorDestination);
        if (item.kind === "decoration" && isFridgeDecorationId(item.decorationId)) return Boolean(onTogglePlacedFridge);
        if (item.kind === "decoration" && isCurtainDecorationId(item.decorationId)) return Boolean(onTogglePlacedCurtain);
        if (item.kind === "decoration" && isPoweredDecorationId(item.decorationId)) return Boolean(onTogglePlacedDecorationPower);
        if ((!catPresent && !onRequestRoomCommand) || viewport.width <= displayWidth || viewport.height <= displayWidth) return false;
        return getRoomCommands(item, bedId).length > 0;
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
      bedId,
      decorating,
      catPresent,
      canSendCatToRoom, roomPlacedDecorations,
      onRequestRoomCommand,
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
      onTogglePlacedCurtain,
      onTogglePlacedFridge,
  onTogglePlacedDecorationOpen,
    ],
  );

  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingCloseId || roomActivity) return;
    const timer = setTimeout(() => {
      setPendingCloseId(null);
      const placed = roomPlacedDecorations.find(item => item.instanceId === pendingCloseId);
      if (placed && isDecorationOpen(placed)) onTogglePlacedDecorationOpen?.(pendingCloseId);
    }, 0);
    return () => clearTimeout(timer);
  }, [pendingCloseId, roomActivity, roomPlacedDecorations, onTogglePlacedDecorationOpen]);

  const toggleItemOpen = useCallback((instanceId: string) => {
    const placed = roomPlacedDecorations.find(item => item.instanceId === instanceId);
    if (placed && isDecorationOpen(placed) && roomActivity?.plan.targetInstanceId === instanceId
      && (roomActivity.plan.kind === 'drawerHide' || roomActivity.plan.kind === 'cupboardHide' || roomActivity.plan.kind === 'returnHome')) {
      setPendingCloseId(instanceId);
      returnFromMenuActivity();
    } else onTogglePlacedDecorationOpen?.(instanceId);
  }, [roomPlacedDecorations, roomActivity, returnFromMenuActivity, onTogglePlacedDecorationOpen]);

  const startRoomCommand = useCallback((kind: RoomActivityKind, instanceId?: string) => {
    clearBlockedActivity();
    if (kind === 'drawerHide' || kind === 'cupboardHide') {
      const drawer = roomPlacedDecorations.find(item => item.instanceId === instanceId);
      if (!drawer || !onTogglePlacedDecorationOpen) return;
      setPendingCloseId(null);
      if (!isDecorationOpen(drawer)) onTogglePlacedDecorationOpen(drawer.instanceId);
    }
    if(kind==='doorTravel') {
      const door=roomPlacedDecorations.find(item=>item.instanceId===instanceId);
      if(door && !isDecorationOpen(door))onTogglePlacedDecorationOpen?.(door.instanceId);
    }
    if (kind === 'fridgeInvestigate') {
      const fridge = roomPlacedDecorations.find(item => isFridgeDecorationId(item.decorationId)
        && (!instanceId || item.instanceId === instanceId));
      if (!fridge || !onTogglePlacedFridge) return;
      instanceId = fridge.instanceId;
      if (fridge.fridgeOpen !== true) onTogglePlacedFridge(instanceId, 'full');
    }
    const interactionAt = onRoomInteraction?.();
    if (onRequestRoomCommand) onRequestRoomCommand(homeRoomId, kind, instanceId, interactionAt ?? undefined);
    else startMenuActivity(kind, instanceId, interactionAt ?? undefined);
  }, [clearBlockedActivity, homeRoomId, onRequestRoomCommand, roomPlacedDecorations, onTogglePlacedFridge, onTogglePlacedDecorationOpen, onRoomInteraction, startMenuActivity]);

  const buildRoomItemMenuActions = useCallback(
    (item: RoomLayerItem) => {
      const actions: RoomItemMenuAction[] = [];
      if (!decorating && (catPresent || onRequestRoomCommand) && viewport.width > displayWidth && viewport.height > displayWidth) {
        for (const { kind, icon } of getRoomCommands(item, bedId)) {
          const labelKind = roomCommandLabel(kind,item.kind === 'decoration' ? item.decorationId : undefined);
          actions.push({ label: t(`home.catCommands.${labelKind}`), icon,
            disabled: roomActivityBlocked || (kind === 'cupboardHide' && !nativeWorld.objects.find(object => object.instanceId === (item.kind === 'bed' ? 'bed' : item.instanceId))?.cupboardFits) || ((kind === 'drawerHide' || kind === 'cupboardHide') && !onTogglePlacedDecorationOpen) || (kind === 'fridgeInvestigate' && !onTogglePlacedFridge) || (kind === "bowlEat" && (!onFeed || !canFeed || roomActivity?.plan.kind === "bowlEat")),
            onPress: () => startRoomCommand(kind, item.kind === "bed" ? "bed" : item.instanceId),
          });
        }
      }
      if(!decorating && item.kind==='decoration' && isRoomDoor(item.decorationId) && canSendCatToRoom && (catPresent || onRequestRoomCommand)) {
        const door=roomPlacedDecorations.find(placed=>placed.instanceId===item.instanceId);
        if(door?.doorDestination)actions.push({
          label:t('home.goToRoom',{room:t(`home.rooms.${door.doorDestination}`)}),icon:HOME_ROOM_ICONS[door.doorDestination],
          disabled:roomActivityBlocked,onPress:()=>startRoomCommand('doorTravel',item.instanceId),
        });
      }
      if (item.kind === 'decoration' && isOpenableDecorationId(item.decorationId) && onTogglePlacedDecorationOpen) {
        const placed = roomPlacedDecorations.find(entry => entry.instanceId === item.instanceId);
        if (placed) actions.push({
          label: t(isDecorationOpen(placed) ? 'home.closeItem' : 'home.openItem', { name: t(`store.decorationName.${item.decorationId}`) }),
          icon: isDecorationOpen(placed) ? 'arrow-right' : 'arrow-left',
          onPress: () => toggleItemOpen(item.instanceId),
        });
      }
      if (item.kind === "decoration" && isFridgeDecorationId(item.decorationId) && onTogglePlacedFridge) {
        const placed = roomPlacedDecorations.find(entry => entry.instanceId === item.instanceId);
        if (placed) actions.push({
          label: t(placed.fridgeOpen ? "home.closeFridge" : "home.openFridge"),
          icon: placed.fridgeOpen ? "arrow-right" : "arrow-left",
          onPress: () => onTogglePlacedFridge(item.instanceId),
        });
        if (placed) actions.push({
          label: t(placed.fridgeOpen === "ajar" ? "home.openFridge" : "home.openFridgeAjar"),
          icon: "arrow-left",
          onPress: () => onTogglePlacedFridge(item.instanceId, placed.fridgeOpen === "ajar" ? "full" : "ajar"),
        });
        if (placed && decorating && onFlipPlacedFridgeHinge) {
          const side = placed.fridgeHingeSide ?? (placed.decorationId === 'kitchenFridge' ? 'right' : 'left');
          actions.push({ label: t(side === 'left' ? 'home.fridgeHingeRight' : 'home.fridgeHingeLeft'), icon: 'rotate',
            onPress: () => onFlipPlacedFridgeHinge(item.instanceId) });
        }
      }
      if (item.kind === "decoration" && isCurtainDecorationId(item.decorationId) && onTogglePlacedCurtain) {
        const placed = roomPlacedDecorations.find(entry => entry.instanceId === item.instanceId);
        if (placed) actions.push({
          label: t(placed.curtainOpen === false ? "home.openCurtains" : "home.closeCurtains"),
          icon: placed.curtainOpen === false ? "arrow-left" : "arrow-right",
          onPress: () => onTogglePlacedCurtain(item.instanceId),
        });
      }
      if (decorating && item.kind === "decoration" && isWallSpotlightDecorationId(item.decorationId) && onAimPlacedSpotlight) {
        const placed = roomPlacedDecorations.find(entry => entry.instanceId === item.instanceId);
        if (placed) actions.push({ label: t("home.aimSpotlight", { name: t(`store.decorationName.${item.decorationId}`) }), icon: "rotate",
          onPress: () => {
            editingObject.value = undefined;
            setPlacementFeedback(undefined);
            setSelectedMoveItem(item);
            setRotationPreview(null);
            const aim = { instanceId: item.instanceId, angle: normalizeSpotlightAngle(placed.spotlightAngle), swivel: normalizeSpotlightSwivel(placed.spotlightSwivel) };
            spotlightAim.value = aim;
            setSpotlightPreview(aim);
          },
        });
      }
      if (!decorating) {
        if (item.kind !== "decoration" || !isPoweredDecorationId(item.decorationId) || !onTogglePlacedDecorationPower) return actions;
        const placed = roomPlacedDecorations.find(entry => entry.instanceId === item.instanceId);
        if (placed) actions.push({
          label: t(placed.decorationId === 'livingFireplaceCream'
            ? placed.poweredOn ? "home.extinguishFire" : "home.lightFire"
            : itemInteraction(placed.decorationId)?.power === "water"
            ? placed.poweredOn ? "home.stopWater" : "home.runWater"
            : placed.poweredOn ? "home.turnOffDecoration" : "home.turnOnDecoration"),
          icon: "power",
          onPress: () => onTogglePlacedDecorationPower(item.instanceId),
        });
        return actions;
      }

      if (onSetRoomItemRotation && !(item.kind === "decoration" && isWindowDecorationId(item.decorationId))) actions.push({ id: "turn", label: rotateLabel, icon: "rotate", onPress: () => openRotation(item) });

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
            label: t(placed.decorationId === 'livingFireplaceCream'
            ? placed.poweredOn ? "home.extinguishFire" : "home.lightFire"
            : itemInteraction(placed.decorationId)?.power === "water"
            ? placed.poweredOn ? "home.stopWater" : "home.runWater"
            : placed.poweredOn ? "home.turnOffDecoration" : "home.turnOnDecoration"),
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
            id: "face-wall", label: flipWallLabel,
            icon: "rotate",
            onPress: () => {
              onFlipPlacedDecorationWall(item.instanceId);
            },
          });
        }

        if (onRotatePlacedDecoration && !isWindowDecorationId(decorationId) && canRotateDecoration(decorationId) && (!onSetRoomItemRotation || isPoster || usesStyleVariantMenu(decorationId))) {
          const styleVariant = usesStyleVariantMenu(decorationId);
          actions.push({
            id: isPoster ? "face-wall" : undefined,
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
            id: "size-up", label: biggerLabel,
            icon: "zoom-in",
            onPress: () => {
              resizeSelection(item, 'up');
            },
            disabled: !canScaleDecorationUp(scale, decorationId),
          });
          actions.push({
            id: "size-down", label: smallerLabel,
            icon: "zoom-out",
            onPress: () => {
              resizeSelection(item, 'down');
            },
            disabled: !canScaleDecorationDown(scale),
          });
        }
      }

      if (item.kind === "toy" && onRotatePlacedToy && !onSetRoomItemRotation) {
        actions.push({ id: "turn", label: rotateLabel, icon: "rotate",
          onPress: () => onRotatePlacedToy(item.instanceId) });
      }

      if (item.kind === "toy" && onScalePlacedToy) {
        const placed = roomPlacedToys.find(entry => entry.instanceId === item.instanceId);
        if (placed) {
          const scale = getPlacedToyScale(placed);
          actions.push({ id: "size-up", label: biggerLabel, icon: "zoom-in",
            onPress: () => { resizeSelection(item, 'up'); },
            disabled: !canScaleDecorationUp(scale) });
          actions.push({ id: "size-down", label: smallerLabel, icon: "zoom-out",
            onPress: () => { resizeSelection(item, 'down'); },
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
          id: "size-up", label: biggerLabel,
          icon: "zoom-in",
          onPress: () => {
            resizeSelection(item, 'up');
          },
          disabled: !canScaleBedUp(scale),
        });
        actions.push({
          id: "size-down", label: smallerLabel,
          icon: "zoom-out",
          onPress: () => {
            resizeSelection(item, 'down');
          },
          disabled: !canScaleBedDown(scale),
        });
      }

      if (item.kind === "bed" && onBedRemove) {
        actions.push({
          id: "put-away", label: removeMenuLabel,
          icon: "box",
          onPress: () => {
            onBedRemove();
          },
        });
      }

      if (item.kind === "decoration" && onPlacedDecorationRemove) {
        actions.push({
          id: "put-away", label: removeMenuLabel,
          icon: "box",
          onPress: () => {
            onPlacedDecorationRemove(item.instanceId);
          },
        });
      }

      if (item.kind === "toy" && onPlacedToyRemove) {
        actions.push({
          id: "put-away", label: removeMenuLabel,
          icon: "box",
          onPress: () => {
            onPlacedToyRemove(item.instanceId);
          },
        });
      }

      return placementDraft ? actions.filter(action => ['turn', 'size-up', 'size-down', 'put-away', 'face-wall'].includes(action.id ?? '')) : actions;
    },
    [
      placementDraft,
      nativeWorld,
      bedId,
      bedScale,
      decorating,
      catPresent,
      canSendCatToRoom,
      onRequestRoomCommand,
      roomActivityBlocked,
      viewport.width, viewport.height, displayWidth,
      onFeed,
      canFeed,
      roomActivity,
      startRoomCommand,
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
      resizeSelection,
      onScalePlacedDecoration,
      onTogglePlacedDecorationPower,
      toggleItemOpen,
      onTogglePlacedCurtain,
      onTogglePlacedFridge,
  onTogglePlacedDecorationOpen,
      onFlipPlacedFridgeHinge,
      onAimPlacedSpotlight,
      spotlightAim,
      setSpotlightPreview,
      setRotationPreview,
      setPlacementFeedback,
      setSelectedMoveItem,
      editingObject,
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
  const blockedItem = blockedActivity?.instanceId ? layerOrder.find(item =>
    (item.kind === 'bed' ? 'bed' : item.instanceId) === blockedActivity.instanceId) : undefined;
  const moveBlockedFurniture = useCallback((item?: RoomLayerItem) => {
    clearBlockedActivity();
    setSelectedMoveItem(item ?? blockedItem ?? null);
    setShowEditor(false);
    setPlacementFeedback(undefined);
    setRotationPreview(null);
    setSpotlightPreview(null);
    if (roomActivity) { setWaitingToDecorate(true); stopActivity(); }
    else setDecorating(true);
  }, [blockedItem, clearBlockedActivity, roomActivity, setDecorating, setSelectedMoveItem,
    setShowEditor, setPlacementFeedback, setRotationPreview, setSpotlightPreview, setWaitingToDecorate, stopActivity]);
  const notifyBlockedActivity = useCallback((failure: BlockedRoomActivity) => {
    const item = layerOrder.find(item => (item.kind === 'bed' ? 'bed' : item.instanceId) === failure.instanceId);
    onRoomActivityFailure?.({ roomId: homeRoomId, target: item ? itemLabel(item) : undefined,
      onMove: () => moveBlockedFurniture(item), onDismiss: clearBlockedActivity });
  }, [clearBlockedActivity, homeRoomId, itemLabel, layerOrder, moveBlockedFurniture, onRoomActivityFailure]);
  useEffect(() => { blockedActivityHandler.current = notifyBlockedActivity; }, [notifyBlockedActivity]);
  const itemPicture = (item: RoomLayerItem, pictureSize = 64) => {
    const size = moderateScale(pictureSize);
    if (item.kind === "bed") return <Image source={getCatBedSource(bedId)} style={{ width: size, height: size }} resizeMode="contain" />;
    if (item.kind === "toy") return <ToySpriteImage toyId={item.toyId as CatToyId} size={size} still />;
    const placed = roomPlacedDecorations.find(entry => entry.instanceId === item.instanceId);
    if (!placed) return null;
    return <DecorationSpriteImage decorationId={getPlacedDecorationSpriteId(placed)} size={size} still
      flipHorizontal={getPlacedDecorationWallFlipped(placed)} />;
  };
  const nudgeItem = (item: RoomLayerItem, direction: "left" | "right" | "up" | "down") => {
    setEditNotice(undefined);
    const offset = item.kind === "bed" ? roomBedOffset ?? { x: -0.15, y: 0.3 }
      : item.kind === "toy" ? roomPlacedToys.find(entry => entry.instanceId === item.instanceId)?.offset
      : roomPlacedDecorations.find(entry => entry.instanceId === item.instanceId)?.offset;
    if (!offset) return;
    const id = item.kind === 'bed' ? 'bed' : item.instanceId;
    const object = nativeWorld.objects.find(object => object.instanceId === id);
    if (!object) return;
    const previous = editingObject.value?.instanceId === id ? editingObject.value : object;
    const anchor = roomItemAnchor(previous, viewport.width), step = 8 / zoom;
    heldSnap.current = undefined;
    const point = { x: anchor.x + (direction === 'left' ? -step : direction === 'right' ? step : 0),
      y: anchor.y + (direction === 'up' ? -step : direction === 'down' ? step : 0) };
    const preview = previewPlacement(id, point, false);
    if (!preview) return;
    suggestionAbort.current?.abort();
    setRoomPreview(editingObject, { ...preview.object, editingChildren: preview.objects.slice(1) });
    setPlacementFeedback(preview.feedback); setPendingMove(true);
    if (!tapToMove && !placementDraft && preview.accepted) commitObjects(preview.objects);

  };

  // Editing options live in the selected-item dock, not on each hit target.
  const roomItemMenuActions = decorating ? undefined : buildRoomItemMenuActions;
  // Physics reports change hit positions when a room resumes. Keep menu actions
  // cached independently so moving one toy does not rebuild every native menu.
  // eslint-disable-next-line react-hooks/refs
  const roomItemMenus = useMemo(() => new Map(layerOrder.map(item =>
    [item, canManageRoomItem(item) ? roomItemMenuActions?.(item) : undefined])),
  [layerOrder, canManageRoomItem, roomItemMenuActions]);
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
        onPetTap: decorating ? () => { setPlacementFeedback(undefined); setRotationPreview(null); setSpotlightPreview(null); setSelectedMoveItem(item); } : undefined,
        onDragStart: decorating ? () => { setPlacementFeedback(undefined); setRotationPreview(null); setSpotlightPreview(null); setSelectedMoveItem(item); } : undefined,
        onDragEnd: (point: { x: number; y: number }) => finishPlacement(item.kind === 'bed' ? 'bed' : item.instanceId, point),
        menuActions: roomItemMenus.get(item),
      };
    },
    [canManageRoomItem, roomItemMenus, decorating, zoom, snap, itemLabel, movingItem, setSelectedMoveItem, finishPlacement, setPlacementFeedback, setRotationPreview, setSpotlightPreview],
  );

  const pickEditingItem = async (point: { x: number; y: number }) => {
    if (tapToMove) return undefined;
    const selectedId = movingItem && (movingItem.kind === 'bed' ? 'bed' : movingItem.instanceId);
    const selected = editingObject.value?.instanceId === selectedId ? editingObject.value
      : nativeWorld.objects.find(object => object.instanceId === selectedId);
    if (selected && selectedRoomItemAtPoint(selected,
      { x: point.x - viewport.width / 2, y: point.y - viewport.height / 2 }, viewport.width, zoom)) return selected.instanceId;
    return pickNativeItem(point);
  };
  const nativeDragAnchor = (id: string) => {
    if (editingObject.value?.instanceId === id) return roomItemAnchor(editingObject.value, viewport.width);
    if (id === 'cat') return { x: petSceneX.get(), y: petSceneY.get() };
    const object = nativeWorld.objects.find(object => object.instanceId === id);
    return object ? roomItemAnchor(object, viewport.width) : undefined;
  };
  const panOrigin = useRef({ x: 0, y: 0 });
  const selectNativeItem = (id: string | undefined) => {
    panOrigin.current = { x: sceneX.get(), y: sceneY.get() };
    if (tapToMove) return;
    const selectedId = movingItem && (movingItem.kind === 'bed' ? 'bed' : movingItem.instanceId);
    if (id !== selectedId) { cancelMove(); if (!id || !groupIds.includes(id)) setGroupIds([]); }
    setRotationPreview(null); setSpotlightPreview(null);
    setSelectedMoveItem(layerOrder.find(item => (item.kind === 'bed' ? 'bed' : item.instanceId) === id) ?? null);
  };
  const prepareNativeDrag = (id: string, anchor: { x: number; y: number }, motion: RoomDragMotion) => {
    if (id === 'cat' || tapToMove) return;
    const object = editingObject.value?.instanceId === id ? editingObject.value : nativeWorld.objects.find(item => item.instanceId === id);
    if (!object) return;
    dragFeedback.current = undefined;
    setDraggingRoomItem(true);
    const selectedId = movingItem && (movingItem.kind === 'bed' ? 'bed' : movingItem.instanceId);
    const children = roomSupportGroup(nativeWorld.objects, [id, ...(selectedId === id ? groupIds : [])]).filter(item => item.instanceId !== id);
    const captured = snapshotRoomDragObject({ ...object, editingChildren: object.editingChildren ?? children });
    dragPlacement.current = { session: motion.session, id,
      resolve: createRoomDragPlacement(captured, nativeWorld.objects, viewport.width, zoom, children.map(child => child.instanceId)) };
    heldSnap.current = undefined;
    dragBase.set({ session: motion.session, version: 0, x: 0, y: 0, width: viewport.width, anchor,
      object: captured });
  };
  const stopNativeDrag = () => { dragBase.set(undefined); setDraggingRoomItem(false); };
  const moveNativeItem = (id: string, point: { x: number; y: number }, motion?: RoomDragMotion) => {
    if (id !== 'cat') return livePosition(id, point, motion);
    const maxX = Math.max(0, (viewport.width - displayWidth) / 2), maxY = Math.max(0, (viewport.height - displayWidth) / 2);
    return livePosition(id, { x: Math.max(-maxX, Math.min(maxX, point.x)), y: Math.max(-maxY, Math.min(maxY, point.y)) });
  };
  const discardNativeDrag = (id: string) => {
    dragPlacement.current = undefined;
    stopNativeDrag();
    if (editingObject.value?.instanceId === id) {
      // Drawing-thread previews are mutable shared values.
      setRoomPreview(editingObject, undefined);
    }
    heldSnap.current = undefined; setPlacementFeedback(undefined); setPendingMove(!!placementDraft);
    clearLivePosition(id);
  };
  const commitNativeDrag = (id: string, point: { x: number; y: number }, motion?: RoomDragMotion) => {
    stopNativeDrag();
    if (id !== 'cat') {
      if (snap) {
        const captured = dragPlacement.current;
        const support = captured?.id === id && captured.session === motion?.session
          ? captured.resolve(point).object.supportId : placement.move(id, point)?.object.supportId;
        if (!support) {
          point = { x: Math.round(point.x / (12 / zoom)) * (12 / zoom), y: Math.round(point.y / (12 / zoom)) * (12 / zoom) };
          livePosition(id, point);
        }
      }
      finishPlacement(id, point, motion);
      dragPlacement.current = undefined;
      return;
    }
    const maxX = Math.max(1, (viewport.width - displayWidth) / 2), maxY = Math.max(1, (viewport.height - displayWidth) / 2);
    onRoomPetOffsetChange?.({ x: point.x / maxX, y: point.y / maxY });
    clearLivePosition(id);
  };
  const placePreview = () => {
    const object = editingObject.value;
    if (object) finishPlacement(object.instanceId, roomItemAnchor(object, viewport.width));
  };
  const putAwaySelection = () => {
    if (placementDraft) { cancelMove(); setSelectedMoveItem(null); return; }
    if (!movingItem) return;
    const id = movingItem.kind === 'bed' ? 'bed' : movingItem.instanceId;
    const ids = roomSupportGroup(nativeWorld.objects, [id, ...groupIds]).map(object => object.instanceId);
    const remove = () => { if (onCommitRoomEdit?.([], ids)) { cancelMove(); setSelectedMoveItem(null); setGroupIds([]); } };
    if (ids.length > 1) Alert.alert(t('home.storeGroupTitle', { count: ids.length }), t('home.storeGroupHint'), [
      { text: t('common.cancel'), style: 'cancel' }, { text: t('home.putAway'), onPress: remove },
    ]);
    else remove();
  };
  const replaceBlockers = () => {
    const candidate = editingObject.value;
    if (!candidate || !placementFeedback || placementFeedback.boundaries.length) return;
    const removeIds = roomSupportGroup(nativeWorld.objects, placementFeedback.blockers.map(blocker => blocker.instanceId))
      .map(object => object.instanceId).filter(id => !editingIds.includes(id));
    const objects = [candidate, ...(candidate.editingChildren ?? [])];
    const resolver = createRoomPlacementResolver(nativeWorld, [...editingIds, ...removeIds]);
    if (!objects.every(object => resolver.canPlace(object))) return;
    const names = layerOrder.filter(item => removeIds.includes(item.kind === 'bed' ? 'bed' : item.instanceId)).map(itemLabel);
    Alert.alert(t('home.replaceTitle'), t('home.replaceReview', { names: names.join(', ') }), [
      { text: t('common.cancel'), style: 'cancel' }, { text: t('home.replaceAction'), onPress: () => {
        // Check the latest rendered layout again before committing the complete operation.
        if (objects.every(object => resolver.canPlace(object))) commitObjects(objects, removeIds);
      } },
    ]);
  };
  useEffect(() => {
    if (draggingRoomItem || !pendingMove || !placementFeedback || placementFeedback.access || placementFeedback.unsupportedSurfaceId || placementFeedback.blockers.length || placementFeedback.boundaries.length) return;
    const timer = setTimeout(() => {
      const root = editingObject.value;
      if (!root) return;
      const access = checkAccess([root, ...(root.editingChildren ?? [])], [], true);
      setPlacementFeedback(current => current === placementFeedback ? { ...current, access: access.blockedExit ? 'blocked' : 'clear' } : current);
      const target = layerOrder.find(item => (item.kind === 'bed' ? 'bed' : item.instanceId) === access.unreachable[0]);
      setEditNotice(access.blockedExit ? t('home.catExitWarning') : target ? t('home.catAccessWarning', { name: itemLabel(target) }) : undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [draggingRoomItem, pendingMove, placementFeedback, editingObject, checkAccess, layerOrder, itemLabel, t]);
  const activeFeedback = decorating && roomVisible && movingItem && placementFeedback
    && (movingItem.kind === 'bed' ? 'bed' : movingItem.instanceId) === placementFeedback.candidate.instanceId
    ? placementFeedback : undefined;
  const preparedFeedback = useMemo(() => {
    if (!decorating || !roomVisible || !movingItem) return undefined;
    const id = movingItem.kind === 'bed' ? 'bed' : movingItem.instanceId;
    const candidate = nativeWorld.objects.find(object => object.instanceId === id);
    return candidate ? { candidate, blockers: [], boundaries: [] } : undefined;
  }, [decorating, roomVisible, movingItem, nativeWorld]);
  const overlayFeedback = activeFeedback ?? preparedFeedback;
  const blockingNames = activeFeedback?.blockers.flatMap(hit => {
    const item = layerOrder.find(entry => (entry.kind === 'bed' ? 'bed' : entry.instanceId) === hit.instanceId);
    return item ? [itemLabel(item)] : [];
  });
  const placementMessage = activeFeedback ? [
    activeFeedback.access === 'blocked' ? t('home.catExitWarning') : activeFeedback.unsupportedSurfaceId ? t('home.surfaceDoesNotFit') : roomPlacementStatus(activeFeedback) === 'blocked' ? t('home.placementNotSaved') : roomPlacementStatus(activeFeedback) === 'checking' ? t('home.placementChecking') : t(activeFeedback.snapped ? 'home.placementAligned' : 'home.placementReady'),
    activeFeedback.candidate.supportId ? t('home.onSupport', { name: layerOrder.filter(item => (item.kind === 'bed' ? 'bed' : item.instanceId) === activeFeedback.candidate.supportId).map(itemLabel).join('') }) : '',
    blockingNames?.length ? t('home.placementBlocked', { names: blockingNames.join(', ') }) : '',
    activeFeedback.boundaries.length ? t('home.placementOutside', {
      edges: activeFeedback.boundaries.map(edge => t(`home.placementEdge.${edge}`)).join(', '),
    }) : '',
  ].filter(Boolean).join(' · ') : undefined;

  // This creates event handlers; it does not invoke their preview/ref reads.
  // eslint-disable-next-line react-hooks/refs
  const selectedItemActions = movingItem ? buildRoomItemMenuActions(movingItem).map(action => action.id === 'put-away' ? { ...action, onPress: putAwaySelection } : action) : [];
  const petCluster = useMemo(() => (
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
  ), [compact, petDisplayWidth, visibleSpeech, usesNativeCat, catActivityStyle, petType, catSkinId,
    activityPlayback, playback, roomActivity, displayWidth, onPetPress, onAnimationComplete, onStepComplete]);

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
      const target = layerOrder.find(item => getRoomCommands(item, bedId).some(command => command.kind === kind));
      if (!target || (kind === "bowlEat" && !onFeed)) return;
      const command = ROOM_COMMANDS.find(command => command.kind === kind)!;
      const labelKind = roomCommandLabel(kind,target.kind === 'decoration' ? target.decorationId : undefined);
      actions.push({
        label: t(`home.catCommands.${labelKind}`), section, icon: command.icon,
        disabled: roomActivityBlocked || (kind === 'cupboardHide' && !nativeWorld.objects.find(object => object.instanceId === (target.kind === 'bed' ? 'bed' : target.instanceId))?.cupboardFits) || ((kind === 'drawerHide' || kind === 'cupboardHide') && !onTogglePlacedDecorationOpen) || (kind === 'fridgeInvestigate' && !onTogglePlacedFridge) || (kind === "bowlEat" && (!canFeed || roomActivity?.plan.kind === "bowlEat")),
        onPress: () => startRoomCommand(kind, (kind === 'fridgeInvestigate' || kind === 'drawerHide' || kind === 'cupboardHide' || kind === 'investigate') && target.kind === 'decoration' ? target.instanceId : undefined),
      });
    }
    if (canSendCatToRoom) actions.push(...HOME_ROOM_IDS.filter(id => id !== catHomeRoomId).map(id => ({
      label: t("home.goToRoom", { room: t(`home.rooms.${id}`) }), icon: HOME_ROOM_ICONS[id],
      section: travel,
      disabled: roomActivityBlocked || roomActivity?.plan.kind === "roomTravel",
      onPress: () => startRoomCommand("roomTravel", id),
    })));
    if (roomActivity) actions.push({
      label: t("home.catCommands.returnHome"), icon: "home", section: travel, onPress: handleRoomTouch,
    });
    // Menu construction stores event handlers without invoking their refs.
    // eslint-disable-next-line react-hooks/refs
    for (const command of ROOM_COMMANDS.filter(command => command.section === play)) addRoomAction(command.kind, command.section);
    if (onPlay) actions.push(...CAT_PLAY_ACTIVITIES.map(activity => ({
      label: t(`home.playStyle.${activity.id}`), icon: activity.icon,
      section: play,
      disabled: roomActivityBlocked || Boolean(roomActivity),
      onPress: () => onPlay(activity),
    })));
    return actions;
  }, [nativeWorld, bedId, viewport.width, viewport.height, displayWidth, compact, catPresent, catHomeRoomId, canSendCatToRoom, decorating, handleCatTap, handleRoomTouch, onFeed, onPetPress, onPlay,
    onTogglePlacedFridge,
  onTogglePlacedDecorationOpen, roomActivity, roomActivityBlocked, layerOrder, startRoomCommand, canFeed, t, usesNativeCat]);

  const roomPetLayer = useMemo(() =>
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
    ), [compact, usesNativeCat, catPresent, t, snap, decorating, zoom, petSceneX, petSceneY, displayWidth,
    roomPetOffset, onRoomPetOffsetChange, clearLivePosition, handlePetPositionChange, livePosition,
    catCommandActions, activityScale, catDepthY, simpleGraphics, petCluster]);

  // Stationary hit targets keep their saved anchors while a selected item moves.
  const editingAnchors = useMemo(() => decorating ? Object.fromEntries(nativeWorld.objects.map(object =>
    [object.instanceId, roomItemAnchor(object, viewport.width)])) : undefined, [decorating, nativeWorld, viewport.width]);
  const roomItemLayers = useMemo(() => layerOrder.map((item, layerIndex) => {
    const layerZIndex = layerIndex + 1;

    if (item.kind === "bed") {
      if (!compact || !usesNativeCat || !bedSource) return null;

      return (
        <DraggableRoomPet
          externalPosition={editingAnchors?.bed}
          testID="room-object:bed"
          key="bed"
          depthAnchor={getRoomObjectDepthAnchor(`bed-${bedId}`)}
          petSize={bedSize}
          initialOffset={roomBedOffset ?? { x: -0.15, y: 0.3 }}
          onOffsetChange={offset => { if (!onCommitRoomEdit) onRoomBedOffsetChange?.(offset); clearLivePosition("bed"); }}
          onDragPositionChange={point => livePosition("bed", point)}
          {...roomItemDragProps(item, layerZIndex)}
        >
          {simpleGraphics ? <Image source={bedSource} style={{ width: bedSize, height: bedSize }} resizeMode="contain"/> : undefined}
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
          externalPosition={editingAnchors ? editingAnchors[item.instanceId] : nativeHitPositions[item.instanceId]}
          testID={`room-object:${item.instanceId}`}
          key={`decoration:${item.instanceId}`}
          depthAnchor={isRoomBackgroundDecoration(spriteId) ? undefined : getRoomObjectDepthAnchor(spriteId)}
          petSize={decorationSize}
          constrainToRoom={!isCurtainDecorationId(spriteId)}
          hitSize={hitSize}
          initialOffset={nativeWorld.objects.find(object => object.instanceId === item.instanceId)?.placementOffset ?? placed.offset}
          onOffsetChange={(offset) =>
            { if (!onCommitRoomEdit) onPlacedDecorationOffsetChange?.(item.instanceId, offset); clearLivePosition(item.instanceId); }
          }
          onDragPositionChange={point => livePosition(item.instanceId, point)}
          {...roomItemDragProps(item, layerZIndex)}
        >
          {simpleGraphics ? <DecorationSpriteImage decorationId={spriteId} size={decorationSize} still flipHorizontal={getPlacedDecorationWallFlipped(placed)}/> : undefined}
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
        externalPosition={editingAnchors ? editingAnchors[item.instanceId] : nativeHitPositions[item.instanceId]}
        petSize={toySize}
        initialOffset={placed.offset}
        onOffsetChange={(offset) =>
          { if (!onCommitRoomEdit) onPlacedToyOffsetChange?.(item.instanceId, offset); clearLivePosition(item.instanceId); }
        }
        onDragPositionChange={point => livePosition(item.instanceId, point)}
        {...roomItemDragProps(item, layerZIndex)}
      >
        {simpleGraphics ? <ToySpriteImage toyId={toyId} size={toySize} still/> : undefined}
      </DraggableRoomPet>
    );
  }), [layerOrder, compact, usesNativeCat, bedSource, editingAnchors, bedId, bedSize, roomBedOffset,
    onCommitRoomEdit, onRoomBedOffsetChange, clearLivePosition, livePosition, roomItemDragProps,
    simpleGraphics, roomPlacedDecorations, nativeHitPositions, nativeWorld, onPlacedDecorationOffsetChange,
    roomPlacedToys, onPlacedToyOffsetChange]);

  // Only the selected target needs a fresh preview anchor. Reuse the other JSX
  // nodes so drag feedback does not rebuild every item's gestures and children.
  const visibleRoomItemLayers = decorating && movingItem ? roomItemLayers.map((layer, index) => {
    const id = movingItem.kind === 'bed' ? 'bed' : movingItem.instanceId;
    return layer && isSameRoomLayerItem(layerOrder[index], movingItem)
      ? cloneElement(layer, { externalPosition: nativeDragAnchor(id), animatedPosition: draggingRoomItem ? dragPosition : undefined }) : layer;
  }) : roomItemLayers;

  // The lamp targets depend on furniture and available actions, not numeric stats.
  // eslint-disable-next-line react-hooks/refs
  const lampSwitches = useMemo(() => !compact || !nativeRendering || decorating || !onTogglePlacedDecorationPower ? null : nativeWorld.objects.map(object => {
    const fireplace = object.modelId === 'livingFireplaceCream';
    const position = fireplace ? fireplaceLightPosition(object) : lampSwitchPosition(object);
    const item = layerOrder.find(entry => entry.kind === "decoration" && entry.instanceId === object.instanceId);
    if (!position || !item || !canManageRoomItem(item)) return null;
    const point = projectWorld(position, viewport.width);
    const size = Math.max(32, Math.min(56, viewport.width * .07 * object.scale));
    return <RoomActionMenu key={`lamp-switch:${object.instanceId}`} label={fireplace ? itemLabel(item) : t('home.lampSwitch', { name: itemLabel(item) })}
      actions={buildRoomItemMenuActions(item)} size={{ width: size, height: size }}
      style={{ position: 'absolute', left: viewport.width / 2 + point.x - size / 2, top: viewport.height / 2 + point.y - size / 2 }}>
      <View pointerEvents="none" style={{ width: size, height: size }}/>
    </RoomActionMenu>;
  }), [compact, nativeRendering, decorating, onTogglePlacedDecorationPower, nativeWorld, layerOrder, canManageRoomItem, viewport.width, viewport.height, itemLabel, t, buildRoomItemMenuActions]);

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
            <Animated.View style={[compact ? StyleSheet.absoluteFill : { width: "100%", minHeight: displayWidth }, hasRoomNavigation && styles.roomSceneInset, { backgroundColor: GameColors.background }]}
              onLayout={event => {
                const { width, height } = event.nativeEvent.layout;
                setViewport({ width, height });
              }}>
            <View style={compact ? [StyleSheet.absoluteFill, { bottom: editingFrame.overlap, overflow: 'hidden' }] : { width: '100%' }}>
            <Animated.View style={[compact ? [StyleSheet.absoluteFill, { bottom: -editingFrame.overlap }] : { width: "100%", minHeight: displayWidth, alignItems: "center" }, compact && usesNativeCat ? sceneZoomStyle : undefined]}>
            {usesNativeCat && compact && simpleGraphics ? <>
              <Image source={getCatRoomSource(roomId)} resizeMode="contain" style={{ position: 'absolute', width: viewport.width, height: viewport.width, top: (viewport.height - viewport.width) / 2 }}/>
              {worldClock && <WorldRoomTint clock={worldClock} roomId={roomId} size={viewport.width} top={(viewport.height - viewport.width) / 2}/>}
              <SimpleLampLight world={nativeWorld}/>
              <Text pointerEvents="none" style={styles.graphicsHint}>{t('recovery.graphicsHint')}</Text>
            </> : null}
            {usesNativeCat && compact && nativeRendering && nativeSceneMounted ? <Pressable style={StyleSheet.absoluteFill} onPress={handleRoomTouch} accessible={false}><NativeRoomScene homeRoomId={homeRoomId} pickerRef={nativePicker} worldClock={worldClock} editingObject={editingObject} dragMotion={dragMotion} dragBase={dragBase} spotlightAim={spotlightAim} entryId={roomEntry?.id} initialCatPosition={entryPosition} onSceneReady={handleSceneReady} world={nativeWorld} roomId={roomId} skinId={catSkinId} catPresent={catPresent} paused={!roomVisible} transitioning={!!sceneSlide} editing={decorating}
              commandAttention={roomVisible && catPresent ? commandAttention : undefined} playback={activityPlayback ?? playback} travel={roomActivity?.plan.steps[roomActivity.stepIndex].native}
              activityKey={roomActivity ? roomActivityStepKey(roomActivity) : undefined}
              onRoomStepComplete={completeNativeStep}
              playingId={roomActivity?.plan.targetInstanceId} playContact={roomActivity?.plan.steps[roomActivity.stepIndex].animation === "batToy"}
              onObjectPosition={handleNativeObjectPosition}
              onPosition={handleNativePetPosition}
              onContactPosition={updateNativeHeight}
              onAnimationComplete={roomActivity ? undefined : onAnimationComplete} onStepComplete={roomActivity ? undefined : onStepComplete} /></Pressable> : null}
            {visibleRoomItemLayers}
            {compact ? roomPetLayer : petCluster}
            {overlayFeedback && <RoomPlacementOverlay visible={!!activeFeedback} world={nativeWorld} feedback={overlayFeedback} isNew={!!placementDraft} dragMotion={dragMotion} dragBase={dragBase}/>}
            {usesNativeCat && compact && nativeRendering && nativeSceneMounted && decorating && roomVisible &&
              <NativeRoomEditor zoom={zoom} cameraGesture={roomGesture} base={dragBase} motion={dragMotion} measure={measureDrag} prepare={prepareNativeDrag} stop={stopNativeDrag} pick={pickEditingItem} anchor={nativeDragAnchor}
                select={selectNativeItem} move={moveNativeItem} commit={commitNativeDrag} discard={discardNativeDrag}
                tap={(point, id) => {
                  if (!tapToMove) {
                    if (id && !placementDraft && groupIds.length < 2) setOverlapChoices(ambiguousRoomItems(nativeWorld, id,
                      { x: point.x - viewport.width / 2, y: point.y - viewport.height / 2 }, zoom));
                    return;
                  }
                  if (!movingItem) return;
                  livePosition(movingItem.kind === 'bed' ? 'bed' : movingItem.instanceId,
                    { x: point.x - viewport.width / 2, y: point.y - viewport.height / 2 });
                }}
                pan={(dx, dy) => {
                  if (tapToMove) return;
                  const camera = clampRoomCamera((panOrigin.current.x + dx * zoom) / editingFrame.scale, (panOrigin.current.y + dy * zoom) / editingFrame.scale, cameraZoom, viewport.width, viewport.height);
                  sceneX.set(camera.x * editingFrame.scale); sceneY.set(camera.y * editingFrame.scale);
                }}/>}
            {compact && nativeRendering && !decorating && onTogglePlacedDecorationPower && <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: ROOM_MENU_OPEN_Z_INDEX }]}>
              {lampSwitches}
            </View>}
            </Animated.View>
            </View>
            {compact && usesNativeCat && visibleSpeech ? (
              <Animated.View collapsable={false} pointerEvents="none" onLayout={handleSpeechLayout} style={[styles.speechOverlay, speechPositionStyle]}>
                <PetSpeechBubble message={visibleSpeech} />
              </Animated.View>
            ) : null}
            </Animated.View>
            {hasRoomNavigation && !sceneSlide?.outgoing && <RoomControlsTransition visible={!decorating}
              instant={reduceMotion || !roomVisible || (compact && usesNativeCat)} offsetY={8} style={StyleSheet.absoluteFill}>
              <RoomNavigation roomId={homeRoomId} disabled={decorating || !!sceneSlide || !!roomActivityBlocked || roomActivity?.plan.kind === "roomTravel"}
                onVisit={onVisitHomeRoom!} />
            </RoomControlsTransition>}
            {compact && usesNativeCat && !sceneSlide?.outgoing && !roomToolbar ? (
              onOpenStore && !decorating ? <Pressable style={styles.decorateButton}
                disabled={!!sceneSlide || waitingToDecorate}
                accessibilityRole="button" accessibilityLabel={t("home.a11yStore")}
                onPress={onOpenStore}>
                  <AppIcon name="store" size={moderateScale(22)} />
                  <Text style={styles.decorateLabel}>{t("home.shop")}</Text>
              </Pressable> :
              <Pressable style={[styles.decorateButton, decorating && styles.decorateButtonActive]}
                disabled={!!sceneSlide || waitingToDecorate || roomActivity?.plan.kind === "roomTravel"}
                onPress={() => {
                  setSelectedMoveItem(null); setShowEditor(false); setRotationPreview(null); setSpotlightPreview(null);
                  if (!decorating && roomActivity) { setWaitingToDecorate(true); stopActivity(); }
                  else setDecorating(!decorating);
                }}
                accessibilityRole="button" accessibilityLabel={t(decorating ? "home.finishDecorating" : "home.decorateRoom")}
                accessibilityState={{ selected: decorating, disabled: waitingToDecorate }}>
                <AppIcon name={decorating ? "check" : "sofa"} size={moderateScale(22)} />
                <Text style={styles.decorateLabel}>{t(decorating ? "home.finishDecorating" : "home.decorateRoom")}</Text>
              </Pressable>
            ) : null}
            {blockedActivity && !onRoomActivityFailure && roomVisible && catPresent && !decorating && !roomActivityBlocked && !sceneSlide &&
              <View style={styles.activityNotice}>
                <RoomActivityNotice name={name} target={blockedItem ? itemLabel(blockedItem) : undefined}
                  onMove={() => moveBlockedFurniture(blockedItem)} onDismiss={clearBlockedActivity} />
              </View>}
            <RoomControlsTransition visible={decorating} instant={reduceMotion || !roomVisible || (compact && usesNativeCat)} offsetY={-6}
              style={[styles.editorToolbar, { top: moderateScale(roomToolbar ? 10 : 60) }]}>
              {onOpenStore && !roomToolbar && <Pressable style={styles.editorToolbarButton} disabled={!!sceneSlide}
                onPress={onOpenStore} accessibilityRole="button" accessibilityLabel={decorating ? t("home.a11yStore") : undefined}>
                <AppIcon name="store" size={22} /><Text style={styles.decorateLabel}>{t("home.shop")}</Text>
              </Pressable>}
              {roomEditor && <Pressable style={styles.editorToolbarButton}
                disabled={!roomEditor.canUndo || !!spotlightPreview}
                accessibilityRole="button" accessibilityLabel={t("home.undo")}
                accessibilityState={{ disabled: !roomEditor.canUndo || !!spotlightPreview }}
                onPress={() => { cancelMove(); setGroupIds([]); roomEditor.undo(); }}>
                <AppIcon name="undo" size={22} style={{ opacity: roomEditor.canUndo && !spotlightPreview ? 1 : .35 }} />
                <Text style={[styles.decorateLabel, (!roomEditor.canUndo || !!spotlightPreview) && { color: GameColors.textMuted }]}>{t("home.undoShort")}</Text>
              </Pressable>}
              <Pressable style={styles.editorToolbarButton} onPress={() => setShowEditor(true)}
                accessibilityRole="button" accessibilityLabel={decorating ? t("home.roomTools") : undefined}>
                <AppIcon name="chair" size={22} /><Text style={[styles.decorateLabel, { flexShrink: 1 }]}>{t("home.roomTools")}</Text>
              </Pressable>
            </RoomControlsTransition>
          </View>
          </GestureDetector>

          <View style={[styles.roomControls, compact && usesNativeCat && styles.roomControlsSlot,
            compact && usesNativeCat && decorating && { height: editingDockHeight, marginTop: moderateScale(74) - editingDockHeight },
            sceneSlide?.outgoing && styles.hiddenStats]}>
          {compact ? <View pointerEvents="none" style={styles.roomBottomShadowClip}>
            <View style={styles.roomBottomShadow} />
          </View> : null}
          <RoomControlsTransition visible={!decorating} instant={reduceMotion || !roomVisible || (compact && usesNativeCat)} offsetY={6}
            style={[styles.stats, compact && styles.statsCompact]}>
            <PetStatsPanel stats={stats} wisdom={wisdom} compact={compact} visible={roomVisible && !decorating} onOpenMathStats={onOpenMathStats} />
          </RoomControlsTransition>
          <RoomControlsTransition visible={decorating} instant={reduceMotion || !roomVisible || (compact && usesNativeCat)} offsetY={8}
            style={[styles.moveControlsSlot, compact && styles.moveControlsSlotCompact, compact && usesNativeCat && { height: editingDockHeight }]}>
          <ScrollView style={compact && usesNativeCat ? { height: editingDockHeight } : undefined}
            bounces={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          <RoomToolTransition panelKey={rotationPreview ? "turn" : spotlightPreview ? "spotlight" : movingItem ? roomLayerItemKey(movingItem) : "welcome"}>
          {rotationPreview ? <RoomRotationControls key={rotationPreview.item.kind === "bed" ? "bed" : rotationPreview.item.instanceId}
            placementAllowed={rotationPlacement.allowed} name={itemLabel(rotationPreview.item)}
            degrees={rotationPreview.degrees} simpleGraphics={simpleGraphics}
            onPreview={degrees => setRotationPreview(current => current ? { ...current, degrees } : null)}
            onClose={() => {
              if (pendingMove || placementDraft) {
                const id = rotationPreview.item.kind === 'bed' ? 'bed' : rotationPreview.item.instanceId;
                const root = rotationPlacement.allowed ? rotationPlacement.world.objects.find(object => object.instanceId === id) : rotationOrigin;
                if (root) {
                  setRoomPreview(editingObject, { ...root, editingChildren: rotationPlacement.allowed ? roomSupportGroup(rotationPlacement.world.objects, [id, ...groupIds]).filter(object => object.instanceId !== id) : root.editingChildren });
                  setPlacementFeedback(placement.feedback(root));
                }
              }
              setRotationPreview(null); setRotationOrigin(undefined);
            }} onCommit={degrees => {
              // Validate the released angle itself, including a tap before preview rerenders.
              const result = resolveRotation(rotationPreview.item, degrees);
              if (result.allowed && !pendingMove && !placementDraft) {
                const id = rotationPreview.item.kind === 'bed' ? 'bed' : rotationPreview.item.instanceId;
                commitObjects(roomSupportGroup(result.world.objects, [id, ...groupIds]));
              }
            }} /> : spotlightPreview ? <RoomSpotlightControls key={spotlightPreview.instanceId} simpleGraphics={simpleGraphics}
            name={t(`store.decorationName.${roomPlacedDecorations.find(item => item.instanceId === spotlightPreview.instanceId)?.decorationId}`)}
            angle={spotlightPreview.angle} swivel={spotlightPreview.swivel}
            onPreview={(angle, swivel) => {
              // Updating a native preview never rebuilds the room or its physics.
              // eslint-disable-next-line react-hooks/immutability
              spotlightAim.value = { instanceId: spotlightPreview.instanceId, angle, swivel };
            }}
            onClose={() => setSpotlightPreview(null)} onApply={(angle, swivel) => {
              onAimPlacedSpotlight?.(spotlightPreview.instanceId, angle, swivel);
              setSpotlightPreview(null);
            }} /> : movingItem ? <RoomItemMoveControls key={roomLayerItemKey(movingItem)} name={groupIds.length > 1 ? t('home.selectedGroup', { count: editingIds.length }) : itemLabel(movingItem)} picture={itemPicture(movingItem, 44)} feedback={editNotice ?? placementMessage} feedbackError={!!editNotice || !!activeFeedback?.blockers.length || !!activeFeedback?.boundaries.length || !!activeFeedback?.unsupportedSurfaceId}
            rotationDegrees={getRoomItemRotation({ bedId, bedRotationDegrees, placedDecorations, placedToys }, movingItem)}
            onRotate={onSetRoomItemRotation && !(movingItem.kind === "decoration" && isWindowDecorationId(movingItem.decorationId)) ? () => openRotation(movingItem) : undefined}
            onFaceWall={movingItem.kind === "decoration" && isWindowDecorationId(movingItem.decorationId) && onFlipPlacedDecorationWall
              ? () => { setPlacementFeedback(undefined); onFlipPlacedDecorationWall(movingItem.instanceId); } : undefined}
            pending={pendingMove || !!placementDraft} placementAllowed={!!activeFeedback && roomPlacementStatus(activeFeedback) === 'ready'}
            onPlace={placePreview} onCancel={cancelMove} onTapMove={() => setTapToMove(current => !current)} tapToMove={tapToMove}
            onReplace={activeFeedback?.blockers.length && !activeFeedback.boundaries.length && !activeFeedback.unsupportedSurfaceId ? replaceBlockers : undefined}
            onPlaceAnother={storedItems.some(entry => entry.target.kind === movingItem.kind && entry.target.id === (movingItem.kind === 'bed' ? bedId : movingItem.kind === 'toy' ? movingItem.toyId : movingItem.decorationId)) && !placementDraft
              ? () => onPlaceStoredItem?.({ kind: movingItem.kind, id: movingItem.kind === 'bed' ? bedId! : movingItem.kind === 'toy' ? movingItem.toyId : movingItem.decorationId }) : undefined}
            actions={selectedItemActions}
            onMove={direction => nudgeItem(movingItem, direction)} onDone={() => { cancelMove(); setSelectedMoveItem(null); setGroupIds([]); }} />
            : <View style={styles.editorWelcome}>
              <AppIcon name="chair" size={30} />
              <View style={{ flex: 1, gap: 4 }}><Text style={styles.editorWelcomeTitle}>{t("home.decorateStart")}</Text>
              <Text style={styles.editorWelcomeHint}>{t("home.decorateHint")}</Text></View>
            </View>}
          </RoomToolTransition>
          </ScrollView>
          </RoomControlsTransition>
          </View>
          {decorating && overlapChoices.length > 1 && <RoomOverlapChooser
            items={layerOrder.filter(item => overlapChoices.includes(item.kind === 'bed' ? 'bed' : item.instanceId)).map(item => ({ item, label: itemLabel(item), picture: itemPicture(item, 44) }))}
            onSelect={item => { cancelMove(); setGroupIds([]); setSelectedMoveItem(item); setOverlapChoices([]); }} onClose={() => setOverlapChoices([])}/>}
          <RoomEditorSheet storedItems={showEditor ? storedItems.map(entry => ({ ...entry,
            label: t(`store.${entry.target.kind === 'bed' ? 'bed' : entry.target.kind === 'toy' ? 'toy' : 'decoration'}Name.${entry.target.id}`).replace(/\n/g, ' '),
            picture: entry.target.kind === 'bed' ? <Image source={getCatBedSource(entry.target.id)} style={{ width: 72, height: 72 }} resizeMode="contain"/>
              : entry.target.kind === 'toy' ? <ToySpriteImage toyId={entry.target.id as CatToyId} size={72} still/>
                : <DecorationSpriteImage decorationId={entry.target.id as CatDecorationId} size={72} still/>,
          })) : []}
            onPlaceStoredItem={target => { cancelMove(); setShowEditor(false); onPlaceStoredItem?.(target); }}
            onSelectGroup={items => { cancelMove(); setGroupIds(items.map(item => item.kind === 'bed' ? 'bed' : item.instanceId)); setSelectedMoveItem(items[0]); setShowEditor(false); }}
            visible={showEditor} onClose={() => setShowEditor(false)} controls={roomEditor}
            onOpenStore={onOpenStore ? () => { setShowEditor(false); onOpenStore(); } : undefined}
            items={showEditor ? layerOrder.map(item => ({ item, label: itemLabel(item), picture: itemPicture(item) })) : []}
            onSelect={item => { cancelMove(); setGroupIds([]); setSelectedMoveItem(item); setShowEditor(false); }}
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
  moveControlsSlot: { position: "absolute", bottom: 0, left: 0, right: 0, minHeight: moderateScale(104), backgroundColor: GameColors.card, borderRadius: COMPACT_STAGE_RADIUS, overflow: "hidden" },
  // Align the dock's rounded edge with the stage instead of covering its
  // inset room corners with an opaque square. Keep the scene viewport stable.
  moveControlsSlotCompact: { left: -COMPACT_STAGE_INSET, right: -COMPACT_STAGE_INSET, paddingHorizontal: COMPACT_STAGE_INSET },
  hiddenStats: { opacity: 0 },
  roomSceneInset: { bottom: ROOM_NAVIGATION_HEIGHT },
  decorateButton: {
    position: "absolute", top: moderateScale(10), left: moderateScale(10),
    zIndex: ROOM_MENU_OPEN_Z_INDEX + 4,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: moderateScale(6),
    width: moderateScale(112), height: moderateScale(44), paddingHorizontal: moderateScale(12),
    borderRadius: moderateScale(20), backgroundColor: GameColors.card,
    borderWidth: 1, borderColor: GameColors.cardBorder,
  },
  activityNotice: { position: 'absolute', top: moderateScale(10), left: moderateScale(10), right: moderateScale(10), zIndex: ROOM_MENU_OPEN_Z_INDEX + 4 },
  editorToolbar: { position: "absolute", left: moderateScale(10), right: moderateScale(10), zIndex: ROOM_MENU_OPEN_Z_INDEX + 4, flexDirection: "row", gap: 8 },
  editorToolbarButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 48, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: GameColors.card, borderRadius: 16, borderWidth: 1, borderColor: GameColors.cardBorder },
  editorWelcome: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10, minHeight: 104 },
  editorWelcomeTitle: { fontSize: moderateScale(17), fontWeight: "700", color: GameColors.text },
  editorWelcomeHint: { fontSize: moderateScale(14), color: GameColors.textMuted },
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
