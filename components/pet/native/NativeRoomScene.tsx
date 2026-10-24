import { NativeRoomColliders } from '@/components/pet/native/NativeRoomColliders';
import { recordRoomDragFrame } from '@/utils/room-drag-latency';
import { IDLE_ROOM_DRAG, roomDragPreview, type RoomDragBase, type RoomDragMotion, type RoomDragPreview } from '@/utils/room-drag-motion';
import { useSharedValue as useUISharedValue, type SharedValue } from 'react-native-reanimated';
import { pawContactImpulse, type PawObjectTarget } from '@/utils/native-paw-contact';
import type { CatCommandAttention } from '@/utils/native-cat-expression';
import type { CatTravelMotion } from '@/utils/native-cat-locomotion';
import { itemInteraction } from '@/constants/item-interactions';
import { NativeItemInteraction } from './NativeItemInteraction';
import { NativeFireplace } from './NativeFireplace';
import { configureRoomCamera } from '@/utils/native-room-camera';
import { registerRoomModelWarmup } from '@/utils/native-model-warmup';
import type { HomeRoomId } from '@/constants/home-rooms';
import { prepareModel, clearPreparedModels, useSyncSharedValue } from 'react-native-filament';
import { advanceSpotlightAim, type SpotlightAim } from '@/utils/native-spotlight-aim';
import { NativeFridge } from './NativeFridge';
import { NativeCurtain } from './NativeCurtain';
import { nativeRoomPreview } from '@/utils/native-room-preview';
import { NativeLightning } from './NativeLightning';
import type { CurtainProgress } from '@/utils/native-curtains';
/* Native worklet shared values synchronize the drawing thread with React. */
/* eslint-disable react-hooks/immutability */
import { advanceRockingChair, STILL_ROCKING_MOTION, type RockingMotion } from '@/utils/native-rocking-chair';
import { advanceBathroomMotion, bathWaterDetailPose, STILL_BATHROOM_MOTION } from '@/utils/native-bathroom';
import { NativeAirflow } from "./NativeAirflow";
import { NativeFoodSpill } from "./NativeFoodSpill";
import { isCatFeederDecorationId } from "@/constants/cat-supplies-decorations";
import { isFridgeDecorationId, isPoweredDecorationId, isAirConditionerDecorationId, isCurtainDecorationId, isLampDecorationId, isWallSpotlightDecorationId } from "@/constants/decoration-motion";
import { NativeLampLight } from './NativeLampLight';
import { NativeSpotlightHead } from './NativeSpotlightHead';
import { NativeLampGlow } from './NativeLampGlow';
import { NativeContactShadows } from './NativeContactShadows';
import { useModelShadows } from './use-model-shadows';
import { shadowCastingLampIds } from '@/utils/native-shadows';
import { NativeWorldLighting } from './NativeWorldLighting';
import { NativeWindowPane } from './NativeWindowPane';
import { NativeWindowWeather } from './NativeWindowWeather';
import { isWindowLightSource } from '@/utils/native-window-light';
import { worldClockHandAngles, type WorldClock } from '@/utils/world-clock';
import { useStartupVisualReady } from "@/contexts/StartupVisualContext";
import { useAnimationActivity } from "@/hooks/use-animation-activity";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { DefaultLight, FilamentScene, FilamentView, RenderCallbackContext, useAnimator, useBoxShape, useFilamentContext, useModel, useRigidBody, useWorkletEffect, useSphereShape, useStaticPlaneShape, useWorld, type DiscreteDynamicWorld, type Float3, } from 'react-native-filament';
import { useSharedValue, Worklets, type ISharedValue } from 'react-native-worklets-core';
import { NativeCatActor, useCatModel } from './NativeCatActor';
import { advancePlantLeaf, attachedPlantLeaf, detachPlantLeaf, LEAF_REGROW_DELAY, type PlantLeafState } from '@/utils/native-plant-play';
import { airflowStrength, roomAirflowSources, type AirflowSource } from '@/utils/native-airflow';
import { advanceHangingToy, containHangingToySwing, hangingToyContact } from '@/utils/native-hanging-toy';
import { NATIVE_MODEL_SOURCES } from '@/constants/native-model-sources';
import { FLOOR_Y, projectWorld, nativeBodyRotation, NATIVE_MODEL_CATALOG, type NativeRoomWorld, type NativeRoomObject, type NativeTravel, type Vec3 } from '@/utils/native-room-world';
import { GameColors } from '@/constants/game';
import { RecoveryBoundary } from '@/components/recovery/RecoveryBoundary';
import { SceneLoadGuard } from '@/components/recovery/SceneLoadGuard';
import { enableSimpleGraphicsForSession } from '@/lib/graphics-mode';
import type { PetPlaybackState } from '@/pet-display/types';
export type NativeRoomPicker = { pick: (x: number, y: number) => Promise<string | undefined> };
type Props = {
  entryId?: number;
  homeRoomId?: HomeRoomId;
  pickerRef?: RefObject<NativeRoomPicker | undefined>;
  spotlightAim?: ISharedValue<SpotlightAim | undefined>;
  editingObject?: ISharedValue<NativeRoomObject | undefined>;
  dragMotion?: SharedValue<RoomDragMotion>;
  dragBase?: SharedValue<RoomDragBase | undefined>;
  worldClock?: WorldClock;
  world: NativeRoomWorld;
  catPresent?: boolean;
  roomId?: string;
  skinId?: string;
  playback: PetPlaybackState;
  travel?: NativeTravel;
  activityKey?: string;
  commandAttention?: CatCommandAttention;
  playingId?: string;
  playContact?: boolean;
  paused?: boolean;
  transitioning?: boolean;
  editing?: boolean;
  initialCatPosition?: Vec3;
  onSceneReady?: () => void;
  onObjectPosition?: (id: string, point: {
    x: number;
    y: number;
  }, center?: Vec3, settled?: boolean) => void;
  onPosition?: (point: {
    x: number;
    y: number;
  }) => void;
  onContactPosition?: (position: Vec3, elapsed?: number, activityKey?: string) => void;
  onRoomStepComplete?: (key: string, position: Vec3, motion?: CatTravelMotion) => void;
  onAnimationComplete?: () => void;
  onStepComplete?: (index: number) => void;
};
function RoomModel({ id, onReady }: { id: string; onReady?: () => void }) {
  const model = useModel(NATIVE_MODEL_SOURCES[id] ?? NATIVE_MODEL_SOURCES.room1);
  useModelShadows(model.state === 'loaded' ? model.asset : undefined);
  useEffect(() => { if (model.state === 'loaded') onReady?.(); }, [model.state, onReady]);
  return null;
}
const RoomObject = memo(function RoomObject({ object, curtainProgress, lightning, windows, world, worldClock, editingObject, spotlightPose, catPosition, rockingMotion, hangingBall, floorToy, plantLeaf, pawPositions, playingId, playContact, catPresent, active, lightingActive, reduceMotion, roomWidth, catRadius, onPosition, travel, activityKey, airflow, onReady, registerPickEntities }: {
  registerPickEntities?: (id: string, entities: { id: number }[]) => () => void;
  lightning: ISharedValue<number>;
  spotlightPose?: ISharedValue<SpotlightAim | undefined>;
  editingObject?: ISharedValue<NativeRoomObject | undefined>;
  worldClock?: WorldClock;
  curtainProgress: ISharedValue<CurtainProgress>;
  windows: NativeRoomObject[];
  object: NativeRoomObject;
  onReady?: (key: string) => void;
  world: DiscreteDynamicWorld;
  catPosition: ISharedValue<Vec3>;
  rockingMotion: ISharedValue<RockingMotion>;
  hangingBall: ISharedValue<Vec3>;
  floorToy?: ISharedValue<PawObjectTarget | undefined>;
  plantLeaf: ISharedValue<Vec3 | undefined>;
  pawPositions: ISharedValue<Vec3[]>;
  playingId?: string;
  playContact?: boolean;
  active: ISharedValue<boolean>;
  lightingActive: boolean;
  reduceMotion: boolean;
  catPresent: boolean;
  airflow: AirflowSource[];
  travel?: NativeTravel;
  activityKey?: string;
  roomWidth: number;
  catRadius: number;
  onPosition?: (id: string, point: {
    x: number;
    y: number;
  }, center?: Vec3, settled?: boolean) => void;
}) {
  'use no memo';
  const { transformManager, renderableManager } = useFilamentContext();
  const modelMetadata = NATIVE_MODEL_CATALOG[object.modelId];
  const model = useModel(NATIVE_MODEL_SOURCES[object.modelId], { shouldReleaseSourceData: false });
  useEffect(() => {
    if (model.state === 'loaded') onReady?.(`${object.instanceId}:${object.modelId}`);
  }, [model.state, object.instanceId, object.modelId, onReady]);
  const entity = model.state === 'loaded' ? model.rootEntity : undefined;
  const asset = model.state === 'loaded' ? model.asset : undefined;
  useModelShadows(asset);
  useEffect(() => asset ? registerPickEntities?.(object.instanceId, asset.getRenderableEntities()) : undefined,
    [asset, object.instanceId, registerPickEntities]);
  const clockHands = useMemo(() => {
    if (!asset || object.modelId !== 'officeClockAni') return [];
    return ['Hour hand', 'Minute hand'].flatMap(name => {
      const entity = asset.getFirstEntityByName(name);
      return entity ? [{ entity, name, transform: transformManager.getTransform(entity) }] : [];
    });
  }, [asset, object.modelId, transformManager]);
  const hanging = useMemo(() => {
    if (!asset) return undefined;
    const pivot = asset.getFirstEntityByName('Hanging toy pivot');
    const ball = asset.getFirstEntityByName('Dangling toy');
    return pivot && ball ? { entity: pivot, ball, transform: transformManager.getTransform(pivot) } : undefined;
  }, [asset, transformManager]);
  const bedCover = useMemo(() => {
    const entity = asset?.getFirstEntityByName('Bed cover lift');
    return entity ? { entity, transform: transformManager.getTransform(entity) } : undefined;
  }, [asset, transformManager]);
  const coverLift = useSharedValue(0);
  const bathroomKind = object.bathroom?.kind;
  const bathroomParts = useMemo(() => {
    if (!asset || !bathroomKind) return [];
    const names = ['Toilet lid hinge', ...Array.from({ length: 8 }, (_, i) => `Bathroom water drop ${i + 1}`),
      ...Array.from({ length: 3 }, (_, i) => `Bathroom wash ripple ${i + 1}`),
      ...Array.from({ length: 4 }, (_, i) => `Bath water glint ${i + 1}`)];
    return names.flatMap(name => {
      const entity = asset.getFirstEntityByName(name);
      const surfaceDetail = name.startsWith('Bath water glint') || name.startsWith('Bathroom wash ripple');
      return entity ? [{ entity, name, transform: transformManager.getTransform(entity),
        material: surfaceDetail ? renderableManager.getMaterialInstanceAt(entity, 0) : undefined }] : [];
    });
  }, [asset, bathroomKind, renderableManager, transformManager]);
  const bathroomMotion = useSharedValue(STILL_BATHROOM_MOTION);
  const leaves = useMemo(() => {
    if (!asset) return [];
    return (NATIVE_MODEL_CATALOG[object.modelId].leaves ?? []).flatMap(meta => {
      const entity = asset.getFirstEntityByName(meta.node), contact = asset.getFirstEntityByName(meta.contact);
      return entity && contact ? [{ entity, contact, transform: transformManager.getTransform(entity) }] : [];
    });
  }, [asset, object.modelId, transformManager]);
  const leafStates = useSharedValue<PlantLeafState[]>([]);
  const leafBends = useSharedValue<number[]>([]);
  const leafCooldown = useSharedValue(0);
  const previousLeaves = useSharedValue<{ points: Vec3[]; paws: Vec3[] } | undefined>(undefined);
  useEffect(() => {
    leafStates.value = leaves.map(() => attachedPlantLeaf());
    leafBends.value = leaves.map(() => 0);
    leafCooldown.value = 0;
    previousLeaves.value = undefined;
  }, [leaves, leafStates, leafBends, leafCooldown, previousLeaves]);
  const previousContact = useSharedValue<{ ball: Vec3; paws: Vec3[] } | undefined>(undefined);
  const swing = useSharedValue({ x: 0, z: 0, vx: 0, vz: 0, touching: false });
  const animator = useAnimator(model.state === 'loaded' ? model.asset : undefined);
  const halfSize = useMemo(() => object.max.map((v, i) => Math.max(.01, (v - object.min[i]) / 2)) as Float3, [object]);
  const center = useMemo(() => object.max.map((v, i) => (v + object.min[i]) / 2) as Float3, [object]);
  const radius = Math.max(halfSize[0], halfSize[2]);
  const box = useBoxShape(...halfSize);
  const sphere = useSphereShape(radius);
  const body = useRigidBody({ id: object.instanceId, mass: object.movable ? .22 : 0,
    shape: object.movable ? sphere : box, origin: center, world: object.movable || (object.collidable ?? object.solid) && !object.collisionBoxes ? world : undefined,
    friction: .5, damping: [.35, .45] });
  const clock = useSharedValue({ time: 0, contact: false, reset: false, report: 0, screenX: Infinity, screenY: Infinity,
    lastPosition: center as Vec3, still: 0, settled: false });
  const callback = useRef(onPosition);
  useEffect(() => { callback.current = onPosition; }, [onPosition]);
  const receive = useCallback((id: string, x: number, y: number, center: Vec3, settled: boolean) => callback.current?.(id, { x, y }, center, settled), []);
  // The registered callback runs later on RN, never while React renders.
  const notify = useMemo(() => Worklets.createRunOnJS(receive), [receive]);
  const initialTransform = useMemo(() => transformManager.createIdentityMatrix().scaling([object.scale, object.scale, object.scale]).rotate(object.heading, [0, 1, 0]).translate(object.position), [object, transformManager]);
  const previewIdentity = useMemo(() => transformManager.createIdentityMatrix(), [transformManager]);
  const appliedPreview = useSharedValue<number[]>([]);
  useEffect(() => { appliedPreview.value = []; }, [appliedPreview, entity, initialTransform]);
  useWorkletEffect(() => {
    'worklet';
    if (entity)
      transformManager.setTransform(entity, initialTransform);
    if (!bathroomMotion.value.runningWater) for (const part of bathroomParts) {
      if (part.name !== 'Toilet lid hinge' && !part.name.startsWith('Bath water glint'))
        transformManager.setTransform(part.entity, part.transform.scaling([0, 0, 0]));
    }
  });
  const chase = playingId === object.instanceId ? travel?.objectPath : undefined;
  const chaseTime = useSharedValue(0);
  const [centerX, centerY, centerZ] = center;
  useEffect(() => { chaseTime.value = 0; body?.setKinematic(!!chase); }, [activityKey, body, chase, chaseTime]);
  useEffect(() => { clock.value = { time: 0, contact: false, reset: true, report: 0, screenX: Infinity, screenY: Infinity,
    lastPosition: [centerX, centerY, centerZ], still: 0, settled: false }; }, [body, clock, centerX, centerY, centerZ, object.heading, object.scale]);
  const reportDragFrame = useMemo(() => Worklets.createRunOnJS(recordRoomDragFrame), []);
  const objectAnimationOn = !itemInteraction(object.modelId)?.open && (!isPoweredDecorationId(object.modelId) || object.poweredOn === true);
  const lampAnimationOn = !isLampDecorationId(object.modelId) || object.poweredOn === true;
  // A room pause should not serialize and reinstall every furniture worklet.
  const motionActive = active;
  const render = useCallback(({ timeSinceLastFrame }: {
    timeSinceLastFrame: number;
  }) => {
    'worklet';
    if (!entity) return;
    const active = motionActive.value;
    const preview = nativeRoomPreview(editingObject?.value, object.instanceId);
    if (preview) {
      const prior = appliedPreview.value;
      if (prior[0] !== preview.scale || prior[1] !== preview.heading || prior[2] !== preview.position[0]
        || prior[3] !== preview.position[1] || prior[4] !== preview.position[2]) {
        transformManager.setTransform(entity, previewIdentity.scaling([preview.scale, preview.scale, preview.scale])
          .rotate(preview.heading, [0, 1, 0]).translate(preview.position));
        appliedPreview.value = [preview.scale, preview.heading, ...preview.position];
        const root = editingObject?.value as RoomDragPreview | undefined;
        if (__DEV__ && root?.instanceId === object.instanceId && root.dragSample) {
          reportDragFrame({ ...root.dragSample, appliedAt: Date.now() });
        }
      }
      return;
    }
    if (appliedPreview.value.length) {
      transformManager.setTransform(entity, initialTransform);
      appliedPreview.value = [];
    }
    if (bedCover) {
      const target = travel?.bed?.instanceId === object.instanceId && travel.bed.phase !== 'uncover' ? 1 : 0;
      const lift = reduceMotion ? target : coverLift.value + (target - coverLift.value)
        * (1 - Math.exp(-Math.min(1 / 15, active ? timeSinceLastFrame : 0) * 4));
      coverLift.value = lift;
      const anchor = bedCover.transform.translation;
      transformManager.setTransform(bedCover.entity, bedCover.transform.translate(anchor.map(v => -v) as Vec3)
        .scaling([1, 1 + 5.6 * lift, 1]).translate(anchor));
    }
    if (bathroomParts.length) {
      const motion = advanceBathroomMotion(bathroomMotion.value, object.instanceId, travel?.bathroom,
        timeSinceLastFrame, active, reduceMotion);
      bathroomMotion.value = motion;
      const height = modelMetadata.bathroom?.sprayHeight ?? 0;
      for (let i = 0; i < bathroomParts.length; i++) {
        const part = bathroomParts[i];
        const anchor = part.transform.translation;
        let local = part.transform;
        if (part.name === 'Toilet lid hinge') local = local.translate(anchor.map(v => -v) as Vec3)
          .rotate(-motion.lid, [1, 0, 0]).translate(anchor);
        else if (part.material) {
          const ripple = part.name.startsWith('Bathroom wash ripple');
          const detail = bathWaterDetailPose(Number(part.name.at(-1)) - 1,
            reduceMotion ? 0 : motion.surfaceTime, ripple);
          const visible = !ripple || motion.runningWater;
          local = visible ? local.translate(anchor.map(v => -v) as Vec3).scaling([detail.scale, 1, detail.scale])
            .translate(anchor).translate([detail.x, 0, detail.z]) : local.scaling([0, 0, 0]);
          part.material.setFloat4Parameter('baseColorFactor', [.552, .896, .839, visible ? detail.opacity : 0]);
        }
        else if (!motion.runningWater) local = local.scaling([0, 0, 0]);
        else if (part.name.startsWith('Bathroom water drop')) local = local.translate(anchor.map(v => -v) as Vec3)
          .scaling([1.6, 1, 1.6]).translate(anchor).translate([0,
            -((motion.time * 1.8 + i * .19) % Math.max(.01, height)), 0]);
        transformManager.setTransform(part.entity, local);
      }
    }
    if (object.modelId === 'chairRockingOak') {
      const motion = rockingMotion.value;
      const chair = motion.chair;
      const transform = chair?.instanceId === object.instanceId
        ? initialTransform.translate(chair.pivot.map(v => -v) as Vec3).rotate(motion.angle, chair.axis)
          .translate([chair.pivot[0], chair.pivot[1] + motion.lift, chair.pivot[2]])
        : initialTransform;
      transformManager.setTransform(entity, transform);
      return;
    }
    if (!active) return;
    const s = { ...clock.value };
    s.time += Math.min(1 / 15, timeSinceLastFrame);
    let transform = initialTransform;
    if (object.movable && body) {
      if (s.reset) {
        body.setPosition(...center);
        s.reset = false;
      }
      if (chase?.length) {
        chaseTime.value += Math.min(1 / 15, timeSinceLastFrame);
        const progress = Math.min(1, chaseTime.value / Math.max(.01, travel?.objectDuration ?? 1));
        let total = 0;
        for (let i = 1; i < chase.length; i++)
          total += Math.hypot(chase[i][0] - chase[i - 1][0], chase[i][2] - chase[i - 1][2]);
        let distance = total * progress;
        let p = chase[chase.length - 1];
        for (let i = 1; i < chase.length; i++) {
          const a = chase[i - 1], b = chase[i], length = Math.hypot(b[0] - a[0], b[2] - a[2]);
          if (distance <= length && length > 0) {
            const t = distance / length;
            p = [a[0] + (b[0] - a[0]) * t, FLOOR_Y, a[2] + (b[2] - a[2]) * t];
            break;
          }
          distance -= length;
        }
        body.setPosition(p[0], FLOOR_Y + radius, p[2]);
      }
      transformManager.updateTransformByRigidBody(entity, body);
      let position = transformManager.getTransform(entity).translation;
      // Recover only to the nearest floor boundary, never to the original placement.
      const edge = Math.max(0, 2.4 - radius);
      const contained: Vec3 = [Math.max(-edge, Math.min(edge, position[0])), Math.max(FLOOR_Y + radius, position[1]), Math.max(-edge, Math.min(edge, position[2]))];
      if (contained.some((v, i) => Math.abs(v - position[i]) > .001)) {
        body.setPosition(...contained);
        position = contained;
      }
      const paws=catPresent?pawPositions.value:[];
      const prior=previousContact.value;
      const pawIndex=hangingToyContact(position,paws,radius+catRadius*.075/1.04,prior);
      const impulse=pawIndex>=0?pawContactImpulse(position,paws[pawIndex],
        prior && pawIndex<prior.paws.length?prior.paws[pawIndex]:undefined,
        Math.max(0,Math.min(1/15,timeSinceLastFrame)),radius):undefined;
      if(!chase && !s.contact && impulse) {
        body.applyCentralImpulse(...impulse);
        s.still=0;s.settled=false;
      }
      s.contact=pawIndex>=0 && (s.contact || !!impulse);
      previousContact.value={ball:position,paws};
      if(floorToy && playingId===object.instanceId)floorToy.value={instanceId:object.instanceId,position,radius};
      const meta = modelMetadata;
      const localCenter = meta.max.map((v, i) => (v + meta.min[i]) / 2);
      const matrix = transformManager.getTransform(entity).data;
      const { angle, axis } = nativeBodyRotation(matrix);
      transform = transformManager.createIdentityMatrix().translate(localCenter.map(v => -v) as Float3)
        .scaling([object.scale, object.scale, object.scale]).rotate(object.heading, [0, 1, 0]).rotate(angle, axis).translate(position);
      const dt = Math.max(0, Math.min(1 / 15, timeSinceLastFrame));
      const moved = Math.hypot(position[0] - s.lastPosition[0], position[1] - s.lastPosition[1], position[2] - s.lastPosition[2]);
      if (moved > .005 * dt || chase) { s.still = 0; s.settled = false; }
      else s.still += dt;
      s.lastPosition = [position[0], position[1], position[2]];
      const landed = !chase && !s.settled && s.still >= .4;
      if (landed) s.settled = true;
      s.report += timeSinceLastFrame;
      if (s.report > .1 || landed) {
        s.report = 0;
        const point = projectWorld(position, roomWidth);
        if (landed || Math.hypot(point.x - s.screenX, point.y - s.screenY) > .75) {
          s.screenX = point.x;
          s.screenY = point.y;
          notify(object.instanceId, point.x, point.y, position, landed);
        }
      }
    }
    transformManager.setTransform(entity, transform);
    if (hanging) {
      const anchor = hanging.transform.translation;
      const ball = transformManager.getWorldTransform(hanging.ball).translation;
      const paws = catPresent ? pawPositions.value : [];
      const contactRadius = .1 * object.scale + catRadius * .075 / 1.04;
      const pawIndex = hangingToyContact(ball, paws, contactRadius, previousContact.value);
      const previous=previousContact.value;
      const impulse=pawIndex>=0?pawContactImpulse(ball,paws[pawIndex],
        previous && pawIndex<previous.paws.length?previous.paws[pawIndex]:undefined,
        Math.max(0,Math.min(1/15,timeSinceLastFrame)),contactRadius):undefined;
      const c=Math.cos(object.heading),sn=Math.sin(object.heading);
      const hit: Vec3 | undefined = impulse ? [(impulse[0]*c-impulse[2]*sn)*7,0,(impulse[2]*c+impulse[0]*sn)*7] : undefined;
      previousContact.value = { ball, paws };
      swing.value = containHangingToySwing(advanceHangingToy(swing.value,
        Math.max(0, Math.min(1 / 15, timeSinceLastFrame)), object.scale, hit), swing.value, object);
      const angle = Math.hypot(swing.value.x, swing.value.z);
      const axis: Vec3 = angle > .00001 ? [-swing.value.z / angle, 0, swing.value.x / angle] : [1, 0, 0];
      transformManager.setTransform(hanging.entity, hanging.transform.translate(anchor.map(v => -v) as Vec3).rotate(angle, axis).translate(anchor));
      if (catPresent && playingId === object.instanceId) hangingBall.value = transformManager.getWorldTransform(hanging.ball).translation;
    }
    if (worldClock && clockHands.length) {
      const angles = worldClockHandAngles(worldClock, Date.now());
      for (const hand of clockHands) {
        const z = hand.name === 'Hour hand' ? .08 : .085;
        transformManager.setTransform(hand.entity, hand.transform.translate([0, -.6, -z])
          .rotate(hand.name === 'Hour hand' ? angles.hour : angles.minute, [0, 0, 1]).translate([0, .6, z]));
      }
    }
    if (animator && animator.getAnimationCount() > 0 && !(worldClock && clockHands.length) && !object.bathroom && objectAnimationOn && lampAnimationOn && (!modelMetadata.wind || airflowStrength(center, airflow) > 0)) {
      animator.applyAnimation(0, s.time);
      animator.updateBoneMatrices();
    }
    if (leaves.length) {
      const dt = Math.max(0, Math.min(1 / 15, timeSinceLastFrame));
      const states = [...leafStates.value];
      const bends = [...leafBends.value];
      leafCooldown.value = Math.max(0, leafCooldown.value - dt);
      const paws = catPresent ? pawPositions.value : [];
      const points = leaves.map(leaf => transformManager.getWorldTransform(leaf.contact).translation);
      let target: Vec3 | undefined, nearest = Infinity;
      const cat = catPosition.value;
      for (let i = 0; i < leaves.length; i++) {
        const leaf = leaves[i], point = points[i];
        let state = states[i] ?? attachedPlantLeaf();
        if (state.age < 0 && catPresent && playingId === object.instanceId) {
          const distance = Math.hypot(point[0] - cat[0], point[1] - cat[1] - .79 * catRadius / 1.04, point[2] - cat[2]);
          if (distance < nearest) { nearest = distance; target = point; }
          const prior = previousLeaves.value;
          const pawIndex = hangingToyContact(point, paws, .20 * object.scale + .18 * catRadius,
            prior && i < prior.points.length ? { ball: prior.points[i], paws: prior.paws } : undefined);
          if (playContact && leafCooldown.value === 0 && pawIndex >= 0) {
            state = detachPlantLeaf(transformManager.getWorldTransform(leaf.entity).translation, paws[pawIndex], i);
            leafCooldown.value = .3;
          }
        }
        state = advancePlantLeaf(state, dt, FLOOR_Y + .08 * object.scale);
        states[i] = state;
        const anchor = leaf.transform.translation;
        const falling = state.age >= 0 && state.age < LEAF_REGROW_DELAY;
        const c = Math.cos(object.heading), sn = Math.sin(object.heading);
        const dx = state.position[0] - object.position[0], dz = state.position[2] - object.position[2];
        const location: Vec3 = falling ? [(dx * c - dz * sn) / object.scale,
          (state.position[1] - object.position[1]) / object.scale, (dx * sn + dz * c) / object.scale] : anchor;
        const wind = falling ? 0 : airflowStrength(point, airflow);
        // Bend across each leaf's radial direction while its petiole stays
        // attached to the stem, including leaves on the back of the plant.
        const radial = Math.hypot(anchor[0], anchor[2]);
        const bendAxis: Vec3 = radial > .001 ? [anchor[2] / radial, 0, -anchor[0] / radial] : [0, 0, 1];
        // A shared slow gust presses the leaves downward. Damping avoids rigid
        // flapping and lets them ease back when the draft stops or moves away.
        const gust = .22 + .14 * Math.sin(s.time * .9) + .06 * Math.sin(s.time * 1.4 + .4);
        const priorBend = i < bends.length ? bends[i] : 0;
        const bend = falling ? 0 : priorBend + (wind * gust - priorBend) * (1 - Math.exp(-dt * 6));
        bends[i] = bend;
        const angle = falling ? state.angle : bend * .07 * Math.sin(s.time * 3 + i * .6);
        transformManager.setTransform(leaf.entity, leaf.transform.translate(anchor.map(v => -v) as Vec3)
          .scaling([state.scale, state.scale, state.scale]).rotate(angle, [1, 0, 0]).rotate(bend, bendAxis).translate(location));
      }
      leafStates.value = states;
      leafBends.value = bends;
      previousLeaves.value = { points, paws };
      if (playingId === object.instanceId) plantLeaf.value = target;
    }
    clock.value = s;
  }, [reportDragFrame, motionActive, modelMetadata, editingObject, appliedPreview, previewIdentity, reduceMotion, airflow, animator, lampAnimationOn, objectAnimationOn, bedCover, coverLift, bathroomParts, bathroomMotion, body, catPresent, catPosition, catRadius, center, chase, chaseTime, clock, worldClock, clockHands, entity, hanging, hangingBall, floorToy, initialTransform, leafStates, leafBends, leafCooldown, leaves, notify, object, pawPositions, plantLeaf, previousLeaves, playContact, playingId, radius, rockingMotion, roomWidth, previousContact, swing, transformManager, travel]);
  RenderCallbackContext.useRenderCallback(render, [render]);
  const interaction = asset && (modelMetadata.interactionParts?.length || itemInteraction(object.modelId)?.power)
    ? <NativeItemInteraction asset={asset} object={object} active={lightingActive} reduceMotion={reduceMotion}/> : null;
  if (asset && object.modelId === 'livingFireplaceCream')
    return <NativeFireplace asset={asset} object={object} editingObject={editingObject} active={lightingActive} reduceMotion={reduceMotion}/>;
  if (asset && isFridgeDecorationId(object.modelId))
    return <NativeFridge asset={asset} object={object} editingObject={editingObject} active={lightingActive} reduceMotion={reduceMotion}/>;
  if (asset && isCurtainDecorationId(object.modelId))
    return <NativeCurtain asset={asset} object={object} windows={windows} clock={worldClock} progress={curtainProgress} lightning={lightning} active={lightingActive} reduceMotion={reduceMotion}/>;
  if (asset && isWallSpotlightDecorationId(object.modelId))
    return <><NativeSpotlightHead asset={asset} instanceId={object.instanceId} angle={object.spotlightAngle} swivel={object.spotlightSwivel} pose={spotlightPose}/><NativeLampGlow asset={asset} modelId={object.modelId} poweredOn={object.poweredOn === true}/></>;
  if (asset && isLampDecorationId(object.modelId))
    return <>{interaction}<NativeLampGlow asset={asset} modelId={object.modelId} poweredOn={object.poweredOn === true}/></>;
  return asset && worldClock && isWindowLightSource(object.modelId)
    ? <>{interaction}<NativeWindowPane asset={asset} clock={worldClock} lightning={lightning} active={lightingActive}/>
      <NativeWindowWeather object={object} editingObject={editingObject} clock={worldClock} active={lightingActive} reduceMotion={reduceMotion}/></> : interaction;
});

// Only these model children consume room lighting activity. Static furniture
// reads its shared motion flag without rerunning native model hooks.
function hasLightingUpdates(object: NativeRoomObject) {
  return object.modelId === 'livingFireplaceCream' || isFridgeDecorationId(object.modelId)
    || isCurtainDecorationId(object.modelId) || isWindowLightSource(object.modelId)
    || !!NATIVE_MODEL_CATALOG[object.modelId].interactionParts?.length || !!itemInteraction(object.modelId)?.power;
}
function Scene(props: Props) {
  'use no memo';
  const idleMotion = useUISharedValue<RoomDragMotion>(IDLE_ROOM_DRAG);
  const idleBase = useUISharedValue<RoomDragBase | undefined>(undefined);
  const nativeDragMotion = useSyncSharedValue(props.dragMotion ?? idleMotion);
  const nativeDragBase = useSyncSharedValue(props.dragBase ?? idleBase);
  const appliedDrag = useSharedValue('');
  const dragTarget = props.editingObject;
  const { camera, view, choreographer, engine, workletContext } = useFilamentContext();
  const homeRoomId = props.homeRoomId;
  useEffect(() => {
    if (!homeRoomId) return;
    const unregister = registerRoomModelWarmup(homeRoomId, source => prepareModel(engine, workletContext, source));
    return () => { unregister(); clearPreparedModels(engine); };
  }, [engine, workletContext, homeRoomId]);
  const pickEntities = useRef(new Map<number, string>());
  const registerPickEntities = useCallback((id: string, entities: { id: number }[]) => {
    const registry = pickEntities.current;
    for (const entity of entities) registry.set(entity.id, id);
    return () => { for (const entity of entities) if (registry.get(entity.id) === id) registry.delete(entity.id); };
  }, []);
  const { pickerRef } = props;
  useEffect(() => {
    if (!pickerRef) return;
    let mounted = true;
    const picker: NativeRoomPicker = { pick: async (x, y) => {
      const entity = await view.pickEntity(x, y);
      return mounted && entity ? pickEntities.current.get(entity.id) : undefined;
    } };
    pickerRef.current = picker;
    return () => { mounted = false; if (pickerRef.current === picker) pickerRef.current = undefined; };
  }, [pickerRef, view]);
  const [roomReady, setRoomReady] = useState(false);
  const curtainProgress = useSharedValue<CurtainProgress>({});
  const spotlightPose = useSharedValue<SpotlightAim | undefined>(undefined);
  const spotlightAim = props.spotlightAim;
  const cameraAspect = useSharedValue(0);
  useEffect(() => { cameraAspect.value = 0; }, [camera, cameraAspect]);
  const windows = useMemo(() => props.world.objects.filter(object => isWindowLightSource(object.modelId)), [props.world.objects]);
  const shadowLamps = useMemo(() => shadowCastingLampIds(props.world.objects), [props.world.objects]);
  const catPresent = props.catPresent !== false;
  const objectKeys = props.world.objects.map(object => `${object.instanceId}:${object.modelId}`);
  const catKey = `${props.roomId ?? 'room1'}:${catPresent ? props.skinId ?? 'orange' : 'empty'}${catPresent && props.entryId !== undefined ? `:${props.entryId}` : ''}`;
  const visualKey = `${catKey}:${objectKeys.join(',')}`;
  const [readyObjects, setReadyObjects] = useState<Record<string, true>>({});
  const handleObjectReady = useCallback((key: string) => {
    setReadyObjects(current => current[key] ? current : { ...current, [key]: true });
  }, []);
  const [catReadyFor, setCatReadyFor] = useState<string | null>(null);
  // Home publishes arrival before the scheduler publishes its first path.
  // Keep the prepared model hidden until that path can pose its first frame.
  const renderCat = catPresent && (props.entryId === undefined || !!props.travel || catReadyFor === catKey);
  const catModel = useCatModel(props.skinId, renderCat);
  const [paintedFor, setPaintedFor] = useState<string | null>(null);
  const ready = roomReady && catModel.state === 'loaded' && objectKeys.every(key => readyObjects[key]) && (!catPresent || catReadyFor === catKey);
  const painted = paintedFor === visualKey;
  const handleRoomReady = useCallback(() => setRoomReady(true), []);
  useStartupVisualReady(painted);
  const warmup = useSharedValue({ key: '', frames: 0 });
  const finishWarmup = useCallback((key: string) => setPaintedFor(key), [setPaintedFor]);
  const reportPainted = useMemo(() => Worklets.createRunOnJS(finishWarmup), [finishWarmup]);
  const { onSceneReady } = props;
  useEffect(() => { if (painted) onSceneReady?.(); }, [painted, onSceneReady]);
  const { active, reduceMotion } = useAnimationActivity();
  const lightning = useSharedValue(0);
  const world = useWorld(0, -9.81, 0);
  const floorShape = useStaticPlaneShape(0, 1, 0, 0);
  useRigidBody({ id: 'floor', mass: 0, shape: floorShape, origin: [0, FLOOR_Y, 0], world, friction: .7 });
  const catPosition = useSharedValue<Vec3>(props.initialCatPosition ?? props.world.home);
  const catAnimationTime = useSharedValue({ name: 'idle', time: 0 });
  const rockingMotion = useSharedValue<RockingMotion>(STILL_ROCKING_MOTION);
  const hangingBall = useSharedValue<Vec3>([0, 0, 0]);
  const floorToy = useSharedValue<PawObjectTarget | undefined>(undefined);
  const plantLeaf = useSharedValue<Vec3 | undefined>(undefined);
  const pawPositions = useSharedValue<Vec3[]>([]);
  // Navigation includes head/tail clearance. Only the torso belongs in the
  // physics body; that larger navigation box pushed toys away before a swat.
  const catShape = useSphereShape(.40 * props.world.catScale);
  const catBody = useRigidBody({ id: 'cat', mass: 0, shape: catShape, origin: props.world.home, world: catPresent ? world : undefined });
  useEffect(() => { catBody?.setKinematic(true); }, [catBody]);
  const airflow = useMemo(() => roomAirflowSources(props.world.objects), [props.world.objects]);
  const visible = active && !props.paused;
  // Keep lighting current while preparing/sliding rooms, with motion paused.
  const lightingActive = active && (!props.paused || props.transitioning === true || !painted);
  const editing = props.editing === true;
  const objectMotion = useSharedValue(visible && !reduceMotion && !editing);
  useEffect(() => { objectMotion.value = visible && !reduceMotion && !editing; }, [objectMotion, visible, reduceMotion, editing]);
  const drawing = useSharedValue({ ready, visualKey, visible, reduceMotion, editing, chair: props.travel?.rockingChair });
  useEffect(() => { drawing.value = { ready, visualKey, visible, reduceMotion, editing, chair: props.travel?.rockingChair }; }, [drawing, ready, visualKey, visible, reduceMotion, editing, props.travel?.rockingChair]);
  useEffect(() => {
    if (!painted || lightingActive) choreographer.start();
    else choreographer.stop();
  }, [choreographer, painted, lightingActive]);
  const eatingFeeder = catPresent && props.travel?.hideEatingProps && props.playback.kind === 'segment'
    && props.playback.segment.assetKey === 'eating'
    ? props.world.objects.find(object => object.instanceId === props.playingId && isCatFeederDecorationId(object.modelId))
    : undefined;
  const catScale = props.world.catScale;
  const render = useCallback(({ timeSinceLastFrame }: { timeSinceLastFrame: number }) => {
      'worklet';
      // Filament invokes this before the object callbacks, so every model,
      // light and shadow observes the same pointer pose for this frame.
      const motion = nativeDragMotion.value, base = nativeDragBase.value;
      if (dragTarget && base) {
        const key = `${motion.session}:${motion.sequence}:${base.version}`;
        if (appliedDrag.value !== key) {
          const preview = roomDragPreview(base, motion);
          if (preview) { dragTarget.value = preview; appliedDrag.value = key; }
        }
      } else appliedDrag.value = '';
      const current = drawing.value;
      const prior = spotlightPose.value;
      const next = advanceSpotlightAim(prior, spotlightAim?.value, timeSinceLastFrame, current.reduceMotion);
      if (prior?.instanceId !== next?.instanceId || prior?.angle !== next?.angle || prior?.swivel !== next?.swivel) spotlightPose.value = next;
      if (current.ready) {
        const frame = warmup.value;
        if (frame.key !== current.visualKey || frame.frames < 3) {
          const frames = frame.key === current.visualKey ? frame.frames + 1 : 1;
          // Two prior native drawing turns have uploaded and rendered the scene.
          if (frames === 3) reportPainted(current.visualKey);
          warmup.value = { key: current.visualKey, frames };
        }
      }
      const aspect = Math.max(.1, view.getAspectRatio());
      if (cameraAspect.value !== aspect) {
        configureRoomCamera(camera, aspect);
        cameraAspect.value = aspect;
      }
      if (current.reduceMotion || current.editing) rockingMotion.value = STILL_ROCKING_MOTION;
      else if (current.visible) rockingMotion.value = advanceRockingChair(rockingMotion.value, current.chair, catPresent ? catPosition.value : undefined, timeSinceLastFrame);
      if (current.visible && !current.reduceMotion && !current.editing) {
        const position = catPosition.value;
        if (catPresent) catBody?.setPosition(position[0], position[1] + .55 * catScale, position[2]);
        world.stepSimulation(Math.min(1 / 15, Math.max(0, timeSinceLastFrame)), 4, 1 / 60);
      }

  }, [nativeDragMotion, nativeDragBase, appliedDrag, dragTarget, camera, catBody, catPosition, catPresent, catScale, drawing, reportPainted, rockingMotion, view, warmup, world, spotlightAim, spotlightPose, cameraAspect]);
  return <FilamentView style={StyleSheet.flatten(StyleSheet.absoluteFill)} enableTransparentRendering renderCallback={render}>
  {props.worldClock && <NativeLightning clock={props.worldClock} flash={lightning} active={visible && windows.length > 0} reduceMotion={reduceMotion}/>}
  {props.worldClock ? <NativeWorldLighting lightning={lightning} curtainProgress={curtainProgress} clock={props.worldClock} objects={props.world.objects} editingObject={props.editingObject} active={lightingActive}/> : <DefaultLight/>}
  {props.world.objects.filter(object => isLampDecorationId(object.modelId)).map(object =>
    <NativeLampLight key={`lamp:${object.instanceId}`} castShadows={shadowLamps.has(object.instanceId)} object={object} editingObject={props.editingObject} spotlightPose={spotlightPose} active={lightingActive}/>)}
  <RoomModel id={props.roomId ?? 'room1'} onReady={handleRoomReady}/>
  <NativeContactShadows world={props.world} editingObject={props.editingObject} active={visible}/>
  <NativeRoomColliders world={world} objects={props.world.objects}/>
  {props.world.objects.map(object => <RoomObject key={object.instanceId + ':' + object.modelId} curtainProgress={curtainProgress} lightning={lightning} windows={windows} worldClock={props.worldClock} editingObject={props.editingObject} spotlightPose={spotlightPose} object={object} onReady={handleObjectReady} registerPickEntities={registerPickEntities} world={world} catPresent={catPresent} catPosition={catPosition} rockingMotion={rockingMotion} hangingBall={hangingBall} floorToy={floorToy} plantLeaf={plantLeaf} pawPositions={pawPositions} playingId={props.playingId} playContact={props.playContact} active={objectMotion} lightingActive={lightingActive && hasLightingUpdates(object)} reduceMotion={reduceMotion} airflow={airflow} travel={props.travel} activityKey={props.activityKey} roomWidth={props.world.width} catRadius={props.world.radius} onPosition={props.onObjectPosition}/>)}
  {props.world.objects.filter(o => isAirConditionerDecorationId(o.modelId) && o.poweredOn).map(o => <NativeAirflow key={o.instanceId} object={o} editingObject={props.editingObject} active={visible && !reduceMotion}/>)}
  {eatingFeeder && !reduceMotion && <NativeFoodSpill key={`${props.activityKey}:${eatingFeeder.instanceId}:${eatingFeeder.modelId}`} object={eatingFeeder} active={visible} animationTime={catAnimationTime}/>}
  {renderCat && <NativeCatActor model={catModel} registerPickEntities={registerPickEntities} key={catKey} initialPosition={props.initialCatPosition} skinId={props.skinId} playback={props.playback} commandAttention={props.commandAttention} world={props.world} travel={props.travel} activityKey={props.activityKey} active={visible} reduceMotion={reduceMotion} positionValue={catPosition} rockingMotion={rockingMotion} animationTimeValue={catAnimationTime} hangingBall={hangingBall} floorToy={floorToy} plantLeaf={plantLeaf} pawPositions={pawPositions} onReady={() => setCatReadyFor(catKey)} onPosition={props.onPosition} onContactPosition={props.onContactPosition} onRoomStepComplete={props.onRoomStepComplete} onAnimationComplete={props.onAnimationComplete} onStepComplete={props.onStepComplete}/>}
 </FilamentView>;
}
export const NativeRoomSurface = memo(function NativeRoomSurface(props: Props) {
  // Reserve the startup hold before native layout can mount the renderer.
  // Scene's own hold takes over in the same commit once dimensions are known.
  useStartupVisualReady(props.world.width > 0);
  if (props.world.width <= 0)
    return <View style={styles.loading}><ActivityIndicator color={GameColors.primary}/></View>;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: GameColors.background }]}><FilamentScene shadowing ambientOcclusionOptions={{ enabled: true, radius: .3, intensity: 1, quality: 'MEDIUM', lowPassFilter: 'MEDIUM' }}><Scene {...props}/></FilamentScene></View>;
});
function GuardedRoomSurface(props: Props) {
  const [ready, setReady] = useState(false);
  const notifyReady = props.onSceneReady;
  const onReady = useCallback(() => { setReady(true); notifyReady?.(); }, [notifyReady]);
  return <SceneLoadGuard ready={ready}><NativeRoomSurface {...props} onSceneReady={onReady}/></SceneLoadGuard>;
}
export const NativeRoomScene = memo(function NativeRoomScene(props: Props) {
  return <RecoveryBoundary scope={`room:${props.roomId ?? 'room1'}`} onError={enableSimpleGraphicsForSession}
    fallback={() => <View style={StyleSheet.absoluteFill}/> }>
    <GuardedRoomSurface {...props}/>
  </RecoveryBoundary>;
});
const styles = StyleSheet.create({ loading: { ...StyleSheet.flatten(StyleSheet.absoluteFill), alignItems: 'center', justifyContent: 'center' } });
