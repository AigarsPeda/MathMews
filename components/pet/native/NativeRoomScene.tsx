/* Native worklet shared values synchronize the drawing thread with React. */
/* eslint-disable react-hooks/immutability */
import { advanceRockingChair, STILL_ROCKING_MOTION, type RockingMotion } from '@/utils/native-rocking-chair';
import { advanceBathroomMotion, STILL_BATHROOM_MOTION } from '@/utils/native-bathroom';
import { NativeAirflow } from "./NativeAirflow";
import { NativeFoodSpill } from "./NativeFoodSpill";
import { isFoodBowlDecorationId } from "@/constants/cat-supplies-decorations";
import { isAirConditionerDecorationId, isLampDecorationId } from "@/constants/decoration-motion";
import { NativeLampLight } from './NativeLampLight';
import { NativeLampGlow } from './NativeLampGlow';
import { NativeWorldLighting } from './NativeWorldLighting';
import { NativeWindowPane } from './NativeWindowPane';
import { isWindowLightSource } from '@/utils/native-window-light';
import { worldClockHandAngles, type WorldClock } from '@/utils/world-clock';
import { useStartupVisualReady } from "@/contexts/StartupVisualContext";
import { useAnimationActivity } from "@/hooks/use-animation-activity";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { DefaultLight, FilamentScene, FilamentView, RenderCallbackContext, useAnimator, useBoxShape, useFilamentContext, useModel, useRigidBody, useWorkletEffect, useSphereShape, useStaticPlaneShape, useWorld, type DiscreteDynamicWorld, type Float3, } from 'react-native-filament';
import { useSharedValue, Worklets, type ISharedValue } from 'react-native-worklets-core';
import { NativeCatActor } from './NativeCatActor';
import { advancePlantLeaf, attachedPlantLeaf, detachPlantLeaf, LEAF_REGROW_DELAY, type PlantLeafState } from '@/utils/native-plant-play';
import { airflowStrength, roomAirflowSources, type AirflowSource } from '@/utils/native-airflow';
import { advanceHangingToy, containHangingToySwing, hangingToyContact } from '@/utils/native-hanging-toy';
import { NATIVE_MODEL_SOURCES } from '@/constants/native-model-sources';
import { FLOOR_Y, ROOM_SPAN, projectWorld, nativeBodyRotation, NATIVE_MODEL_CATALOG, type NativeRoomWorld, type NativeRoomObject, type NativeTravel, type Vec3 } from '@/utils/native-room-world';
import { GameColors } from '@/constants/game';
import { RecoveryBoundary } from '@/components/recovery/RecoveryBoundary';
import { SceneLoadGuard } from '@/components/recovery/SceneLoadGuard';
import { enableSimpleGraphicsForSession } from '@/lib/graphics-mode';
import type { PetPlaybackState } from '@/pet-display/types';
type Props = {
  worldClock?: WorldClock;
  world: NativeRoomWorld;
  catPresent?: boolean;
  roomId?: string;
  skinId?: string;
  playback: PetPlaybackState;
  travel?: NativeTravel;
  activityKey?: string;
  playingId?: string;
  playContact?: boolean;
  paused?: boolean;
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
  onContactPosition?: (position: Vec3, elapsed?: number) => void;
  onRoomStepComplete?: (key: string, position: Vec3) => void;
  onAnimationComplete?: () => void;
  onStepComplete?: (index: number) => void;
};
function RoomModel({ id, onReady }: { id: string; onReady?: () => void }) {
  const model = useModel(NATIVE_MODEL_SOURCES[id] ?? NATIVE_MODEL_SOURCES.room1);
  useEffect(() => { if (model.state === 'loaded') onReady?.(); }, [model.state, onReady]);
  return null;
}
function BoxCollider({ world, id, size, position }: {
  world: DiscreteDynamicWorld;
  id: string;
  size: Float3;
  position: Float3;
}) {
  const shape = useBoxShape(...size);
  useRigidBody({ id, mass: 0, shape, origin: position, world, friction: .7 });
  return null;
}
function RoomObject({ object, world, worldClock, catPosition, rockingMotion, hangingBall, plantLeaf, pawPositions, playingId, playContact, catPresent, active, lightingActive, reduceMotion, roomWidth, catRadius, onPosition, travel, activityKey, airflow, onReady }: {
  worldClock?: WorldClock;
  object: NativeRoomObject;
  onReady?: (key: string) => void;
  world: DiscreteDynamicWorld;
  catPosition: ISharedValue<Vec3>;
  rockingMotion: ISharedValue<RockingMotion>;
  hangingBall: ISharedValue<Vec3>;
  plantLeaf: ISharedValue<Vec3 | undefined>;
  pawPositions: ISharedValue<Vec3[]>;
  playingId?: string;
  playContact?: boolean;
  active: boolean;
  lightingActive?: boolean;
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
  const { transformManager } = useFilamentContext();
  const model = useModel(NATIVE_MODEL_SOURCES[object.modelId], { shouldReleaseSourceData: false });
  useEffect(() => {
    if (model.state === 'loaded') onReady?.(`${object.instanceId}:${object.modelId}`);
  }, [model.state, object.instanceId, object.modelId, onReady]);
  const entity = model.state === 'loaded' ? model.rootEntity : undefined;
  const asset = model.state === 'loaded' ? model.asset : undefined;
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
  const bathroomKind = object.bathroom?.kind;
  const bathroomParts = useMemo(() => {
    if (!asset || !bathroomKind) return [];
    const names = ['Toilet lid hinge', ...Array.from({ length: 8 }, (_, i) => `Bathroom water drop ${i + 1}`),
      ...Array.from({ length: 3 }, (_, i) => `Bathroom wash ripple ${i + 1}`)];
    return names.flatMap(name => {
      const entity = asset.getFirstEntityByName(name);
      return entity ? [{ entity, name, transform: transformManager.getTransform(entity) }] : [];
    });
  }, [asset, bathroomKind, transformManager]);
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
  const clock = useSharedValue({ time: 0, contact: false, nextTap: .65, reset: false, report: 0, screenX: Infinity, screenY: Infinity,
    lastPosition: center as Vec3, still: 0, settled: false });
  const callback = useRef(onPosition);
  useEffect(() => { callback.current = onPosition; }, [onPosition]);
  const receive = useCallback((id: string, x: number, y: number, center: Vec3, settled: boolean) => callback.current?.(id, { x, y }, center, settled), []);
  // The registered callback runs later on RN, never while React renders.
  const notify = useMemo(() => Worklets.createRunOnJS(receive), [receive]);
  const initialTransform = useMemo(() => transformManager.createIdentityMatrix().scaling([object.scale, object.scale, object.scale]).rotate(object.heading, [0, 1, 0]).translate(object.position), [object, transformManager]);
  useWorkletEffect(() => {
    'worklet';
    if (entity)
      transformManager.setTransform(entity, initialTransform);
    if (!bathroomMotion.value.runningWater) for (const part of bathroomParts) {
      if (part.name !== 'Toilet lid hinge') transformManager.setTransform(part.entity, part.transform.scaling([0, 0, 0]));
    }
  });
  const chase = playingId === object.instanceId ? travel?.objectPath : undefined;
  const chaseTime = useSharedValue(0);
  const [centerX, centerY, centerZ] = center;
  useEffect(() => { chaseTime.value = 0; body?.setKinematic(!!chase); }, [activityKey, body, chase, chaseTime]);
  useEffect(() => { clock.value = { time: 0, contact: false, nextTap: .65, reset: true, report: 0, screenX: Infinity, screenY: Infinity,
    lastPosition: [centerX, centerY, centerZ], still: 0, settled: false }; }, [body, clock, centerX, centerY, centerZ, object.heading, object.scale]);
  const lampAnimationOn = !isLampDecorationId(object.modelId) || object.poweredOn === true;
  const render = useCallback(({ timeSinceLastFrame }: {
    timeSinceLastFrame: number;
  }) => {
    'worklet';
    if (!entity) return;
    if (bathroomParts.length) {
      const motion = advanceBathroomMotion(bathroomMotion.value, object.instanceId, travel?.bathroom,
        timeSinceLastFrame, active, reduceMotion);
      bathroomMotion.value = motion;
      const height = NATIVE_MODEL_CATALOG[object.modelId].bathroom?.sprayHeight ?? 0;
      for (let i = 0; i < bathroomParts.length; i++) {
        const part = bathroomParts[i];
        const anchor = part.transform.translation;
        let local = part.transform;
        if (part.name === 'Toilet lid hinge') local = local.translate(anchor.map(v => -v) as Vec3)
          .rotate(-motion.lid, [1, 0, 0]).translate(anchor);
        else if (!motion.runningWater) local = local.scaling([0, 0, 0]);
        else if (part.name.startsWith('Bathroom water drop')) local = local.translate(anchor.map(v => -v) as Vec3)
          .scaling([1.6, 1, 1.6]).translate(anchor).translate([0,
            -((motion.time * 1.8 + i * .19) % Math.max(.01, height)), 0]);
        else {
          const factor = .65 + .40 * ((motion.time * .8 + i * .33) % 1);
          local = local.translate(anchor.map(v => -v) as Vec3).scaling([factor, 1, factor]).translate(anchor);
        }
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
      const cat = catPosition.value;
      const distance = Math.hypot(cat[0] - position[0], cat[2] - position[2]);
      if (catPresent && !chase && distance < radius + catRadius + .08 && (playingId === object.instanceId && playContact && s.time > s.nextTap || !s.contact)) {
        const dx = position[0] - cat[0], dz = position[2] - cat[2], length = Math.max(.01, Math.hypot(dx, dz));
        body.applyCentralImpulse(dx / length * .12, .025, dz / length * .12);
        s.nextTap = s.time + 1.3;
        s.still = 0;
        s.settled = false;
      }
      s.contact = distance < radius + catRadius + .08;
      const meta = NATIVE_MODEL_CATALOG[object.modelId];
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
      const contactRadius = .1 * object.scale + catRadius * .18;
      const pawIndex = hangingToyContact(ball, paws, contactRadius, previousContact.value);
      const hit: Vec3 | undefined = pawIndex >= 0 ? [-.7, 0, pawIndex === 0 ? .9 : -.9] : undefined;
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
    if (animator && animator.getAnimationCount() > 0 && !(worldClock && clockHands.length) && !object.bathroom && object.poweredOn !== false && lampAnimationOn && (!NATIVE_MODEL_CATALOG[object.modelId].wind || airflowStrength(center, airflow) > 0)) {
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
  }, [active, reduceMotion, airflow, animator, lampAnimationOn, bathroomParts, bathroomMotion, body, catPresent, catPosition, catRadius, center, chase, chaseTime, clock, worldClock, clockHands, entity, hanging, hangingBall, initialTransform, leafStates, leafBends, leafCooldown, leaves, notify, object, pawPositions, plantLeaf, previousLeaves, playContact, playingId, radius, rockingMotion, roomWidth, previousContact, swing, transformManager, travel]);
  RenderCallbackContext.useRenderCallback(render, [render]);
  if (asset && isLampDecorationId(object.modelId))
    return <NativeLampGlow asset={asset} modelId={object.modelId} poweredOn={object.poweredOn === true}/>;
  return asset && worldClock && isWindowLightSource(object.modelId)
    ? <NativeWindowPane asset={asset} clock={worldClock} active={lightingActive ?? active}/> : null;
}
function Scene(props: Props) {
  'use no memo';
  const { camera, view, choreographer } = useFilamentContext();
  const [roomReady, setRoomReady] = useState(false);
  const catPresent = props.catPresent !== false;
  const objectKeys = props.world.objects.map(object => `${object.instanceId}:${object.modelId}`);
  const catKey = `${props.roomId ?? 'room1'}:${catPresent ? props.skinId ?? 'orange' : 'empty'}`;
  const visualKey = `${catKey}:${objectKeys.join(',')}`;
  const [readyObjects, setReadyObjects] = useState<Record<string, true>>({});
  const handleObjectReady = useCallback((key: string) => {
    setReadyObjects(current => current[key] ? current : { ...current, [key]: true });
  }, []);
  const [catReadyFor, setCatReadyFor] = useState<string | null>(null);
  const [paintedFor, setPaintedFor] = useState<string | null>(null);
  const ready = roomReady && objectKeys.every(key => readyObjects[key]) && (!catPresent || catReadyFor === catKey);
  const painted = paintedFor === visualKey;
  const handleRoomReady = useCallback(() => setRoomReady(true), []);
  useStartupVisualReady(painted);
  const warmup = useSharedValue({ key: '', frames: 0 });
  const finishWarmup = useCallback((key: string) => setPaintedFor(key), [setPaintedFor]);
  const reportPainted = useMemo(() => Worklets.createRunOnJS(finishWarmup), [finishWarmup]);
  const { onSceneReady } = props;
  useEffect(() => { if (painted) onSceneReady?.(); }, [painted, onSceneReady]);
  const { active, reduceMotion } = useAnimationActivity();
  const world = useWorld(0, -9.81, 0);
  const floorShape = useStaticPlaneShape(0, 1, 0, 0);
  useRigidBody({ id: 'floor', mass: 0, shape: floorShape, origin: [0, FLOOR_Y, 0], world, friction: .7 });
  const catPosition = useSharedValue<Vec3>(props.initialCatPosition ?? props.world.home);
  const catAnimationTime = useSharedValue({ name: 'idle', time: 0 });
  const rockingMotion = useSharedValue<RockingMotion>(STILL_ROCKING_MOTION);
  const hangingBall = useSharedValue<Vec3>([0, 0, 0]);
  const plantLeaf = useSharedValue<Vec3 | undefined>(undefined);
  const pawPositions = useSharedValue<Vec3[]>([]);
  const catShape = useBoxShape(props.world.radius, .40 * props.world.catScale, props.world.radius);
  const catBody = useRigidBody({ id: 'cat', mass: 0, shape: catShape, origin: props.world.home, world: catPresent ? world : undefined });
  useEffect(() => { catBody?.setKinematic(true); }, [catBody]);
  const airflow = useMemo(() => roomAirflowSources(props.world.objects), [props.world.objects]);
  const visible = active && !props.paused;
  const editing = props.editing === true;
  const drawing = useSharedValue({ ready, visualKey, visible, reduceMotion, editing, chair: props.travel?.rockingChair });
  useEffect(() => { drawing.value = { ready, visualKey, visible, reduceMotion, editing, chair: props.travel?.rockingChair }; }, [drawing, ready, visualKey, visible, reduceMotion, editing, props.travel?.rockingChair]);
  useEffect(() => {
    if (!painted || visible) choreographer.start();
    else choreographer.stop();
  }, [choreographer, painted, visible]);
  const eatingBowl = catPresent && props.travel?.hideEatingProps && props.playback.kind === 'segment'
    && props.playback.segment.assetKey === 'eating'
    ? props.world.objects.find(object => object.instanceId === props.playingId && isFoodBowlDecorationId(object.modelId))
    : undefined;
  const catScale = props.world.catScale;
  const render = useCallback(({ timeSinceLastFrame }: { timeSinceLastFrame: number }) => {
      'worklet';
      const current = drawing.value;
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
      camera.setOrthographicProjection(-ROOM_SPAN / 2, ROOM_SPAN / 2, -ROOM_SPAN / 2 / aspect, ROOM_SPAN / 2 / aspect, .1, 50);
      camera.lookAt([8, 7, 8], [0, .9, 0], [0, 1, 0]);
      if (current.reduceMotion || current.editing) rockingMotion.value = STILL_ROCKING_MOTION;
      else if (current.visible) rockingMotion.value = advanceRockingChair(rockingMotion.value, current.chair, catPresent ? catPosition.value : undefined, timeSinceLastFrame);
      if (current.visible && !current.reduceMotion && !current.editing) {
        const position = catPosition.value;
        if (catPresent) catBody?.setPosition(position[0], position[1] + .40 * catScale, position[2]);
        world.stepSimulation(Math.min(1 / 15, Math.max(0, timeSinceLastFrame)), 4, 1 / 60);
      }

  }, [camera, catBody, catPosition, catPresent, catScale, drawing, reportPainted, rockingMotion, view, warmup, world]);
  return <FilamentView style={StyleSheet.flatten(StyleSheet.absoluteFill)} enableTransparentRendering renderCallback={render}>
  {props.worldClock ? <NativeWorldLighting clock={props.worldClock} objects={props.world.objects} active={visible}/> : <DefaultLight/>}
  {props.world.objects.filter(object => isLampDecorationId(object.modelId)).map(object =>
    <NativeLampLight key={`lamp:${object.instanceId}`} object={object} active={visible}/>)}
  <RoomModel id={props.roomId ?? 'room1'} onReady={handleRoomReady}/>
  {([-1, 1] as const).flatMap(side => [
      <BoxCollider key={'x' + side} id={'wall-x' + side} world={world} size={[.05, 1.5, 2.5]} position={[side * 2.45, 1.5, 0]}/>,
      <BoxCollider key={'z' + side} id={'wall-z' + side} world={world} size={[2.5, 1.5, .05]} position={[0, 1.5, side * 2.45]}/>,
    ])}
  {props.world.objects.flatMap(object => (object.collisionBoxes ?? []).map((box, index) =>
    <BoxCollider key={object.instanceId + ':part:' + index} id={object.instanceId + ':part:' + index} world={world}
      size={box.max.map((v, i) => Math.max(.01, (v - box.min[i]) / 2)) as Float3}
      position={box.max.map((v, i) => (v + box.min[i]) / 2) as Float3}/>))}
  {props.world.objects.map(object => <RoomObject key={object.instanceId + ':' + object.modelId} worldClock={props.worldClock} object={object} onReady={handleObjectReady} world={world} catPresent={catPresent} catPosition={catPosition} rockingMotion={rockingMotion} hangingBall={hangingBall} plantLeaf={plantLeaf} pawPositions={pawPositions} playingId={props.playingId} playContact={props.playContact} active={visible && !reduceMotion && !editing} lightingActive={visible} reduceMotion={reduceMotion} airflow={airflow} travel={props.travel} activityKey={props.activityKey} roomWidth={props.world.width} catRadius={props.world.radius} onPosition={props.onObjectPosition}/>)}
  {props.world.objects.filter(o => isAirConditionerDecorationId(o.modelId) && o.poweredOn).map(o => <NativeAirflow key={o.instanceId} object={o} active={visible && !reduceMotion}/>)}
  {eatingBowl && !reduceMotion && <NativeFoodSpill key={props.activityKey} object={eatingBowl} active={visible} animationTime={catAnimationTime}/>}
  {catPresent && <NativeCatActor key={catKey} initialPosition={props.initialCatPosition} skinId={props.skinId} playback={props.playback} world={props.world} travel={props.travel} activityKey={props.activityKey} active={visible} reduceMotion={reduceMotion} positionValue={catPosition} rockingMotion={rockingMotion} animationTimeValue={catAnimationTime} hangingBall={hangingBall} plantLeaf={plantLeaf} pawPositions={pawPositions} onReady={() => setCatReadyFor(catKey)} onPosition={props.onPosition} onContactPosition={props.onContactPosition} onRoomStepComplete={props.onRoomStepComplete} onAnimationComplete={props.onAnimationComplete} onStepComplete={props.onStepComplete}/>}
 </FilamentView>;
}
export const NativeRoomSurface = memo(function NativeRoomSurface(props: Props) {
  // Reserve the startup hold before native layout can mount the renderer.
  // Scene's own hold takes over in the same commit once dimensions are known.
  useStartupVisualReady(props.world.width > 0);
  if (props.world.width <= 0)
    return <View style={styles.loading}><ActivityIndicator color={GameColors.primary}/></View>;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: GameColors.background }]}><FilamentScene ambientOcclusionOptions={{ enabled: true, radius: .3, intensity: 1 }}><Scene {...props}/></FilamentScene></View>;
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
