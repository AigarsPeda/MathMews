/* Native worklet shared values synchronize the drawing thread with React. */
/* eslint-disable react-hooks/immutability */
import { NativeAirflow } from "./NativeAirflow";
import { NativeFoodSpill } from "./NativeFoodSpill";
import { isFoodBowlDecorationId } from "@/constants/cat-supplies-decorations";
import { isAirConditionerDecorationId } from "@/constants/decoration-motion";
import { useStartupVisualReady } from "@/contexts/StartupVisualContext";
import { useAnimationActivity } from "@/hooks/use-animation-activity";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { DefaultLight, FilamentScene, FilamentView, RenderCallbackContext, useAnimator, useBoxShape, useFilamentContext, useModel, useRigidBody, useWorkletEffect, useSphereShape, useStaticPlaneShape, useWorld, type DiscreteDynamicWorld, type Float3, } from 'react-native-filament';
import { useSharedValue, Worklets, type ISharedValue } from 'react-native-worklets-core';
import { NativeCatActor } from './NativeCatActor';
import { NATIVE_MODEL_SOURCES } from '@/constants/native-model-sources';
import { FLOOR_Y, ROOM_SPAN, projectWorld, nativeBodyRotation, NATIVE_MODEL_CATALOG, type NativeRoomWorld, type NativeRoomObject, type NativeTravel, type Vec3 } from '@/utils/native-room-world';
import { GameColors } from '@/constants/game';
import type { PetPlaybackState } from '@/pet-display/types';
type Props = {
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
  initialCatPosition?: Vec3;
  onSceneReady?: () => void;
  onObjectPosition?: (id: string, point: {
    x: number;
    y: number;
  }, center?: Vec3) => void;
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
function RoomObject({ object, world, catPosition, playingId, playContact, catPresent, active, roomWidth, catRadius, onPosition, travel, activityKey, breezy, onReady }: {
  object: NativeRoomObject;
  onReady?: (key: string) => void;
  world: DiscreteDynamicWorld;
  catPosition: ISharedValue<Vec3>;
  playingId?: string;
  playContact?: boolean;
  active: boolean;
  catPresent: boolean;
  breezy: boolean;
  travel?: NativeTravel;
  activityKey?: string;
  roomWidth: number;
  catRadius: number;
  onPosition?: (id: string, point: {
    x: number;
    y: number;
  }, center?: Vec3) => void;
}) {
  'use no memo';
  const { transformManager } = useFilamentContext();
  const model = useModel(NATIVE_MODEL_SOURCES[object.modelId], { shouldReleaseSourceData: false });
  useEffect(() => {
    if (model.state === 'loaded') onReady?.(`${object.instanceId}:${object.modelId}`);
  }, [model.state, object.instanceId, object.modelId, onReady]);
  const entity = model.state === 'loaded' ? model.rootEntity : undefined;
  const animator = useAnimator(model.state === 'loaded' ? model.asset : undefined);
  const halfSize = useMemo(() => object.max.map((v, i) => Math.max(.01, (v - object.min[i]) / 2)) as Float3, [object]);
  const center = useMemo(() => object.max.map((v, i) => (v + object.min[i]) / 2) as Float3, [object]);
  const radius = Math.max(halfSize[0], halfSize[2]);
  const box = useBoxShape(...halfSize);
  const sphere = useSphereShape(radius);
  const body = useRigidBody({ id: object.instanceId, mass: object.movable ? .22 : 0,
    shape: object.movable ? sphere : box, origin: center, world: object.movable || (object.collidable ?? object.solid) && !object.collisionBoxes ? world : undefined,
    friction: .5, damping: [.35, .45] });
  const clock = useSharedValue({ time: 0, contact: false, nextTap: .65, reset: false, report: 0, screenX: Infinity, screenY: Infinity });
  const callback = useRef(onPosition);
  useEffect(() => { callback.current = onPosition; }, [onPosition]);
  const receive = useCallback((id: string, x: number, y: number, center: Vec3) => callback.current?.(id, { x, y }, center), []);
  // The registered callback runs later on RN, never while React renders.
  const notify = useMemo(() => Worklets.createRunOnJS(receive), [receive]);
  const initialTransform = useMemo(() => transformManager.createIdentityMatrix().scaling([object.scale, object.scale, object.scale]).rotate(object.heading, [0, 1, 0]).translate(object.position), [object, transformManager]);
  useWorkletEffect(() => {
    'worklet';
    if (entity)
      transformManager.setTransform(entity, initialTransform);
  });
  const chase = playingId === object.instanceId ? travel?.objectPath : undefined;
  const chaseTime = useSharedValue(0);
  const [centerX, centerY, centerZ] = center;
  useEffect(() => { chaseTime.value = 0; body?.setKinematic(!!chase); }, [activityKey, body, chase, chaseTime]);
  useEffect(() => { clock.value = { time: 0, contact: false, nextTap: .65, reset: true, report: 0, screenX: Infinity, screenY: Infinity }; }, [body, clock, centerX, centerY, centerZ, object.heading, object.scale]);
  const render = useCallback(({ timeSinceLastFrame }: {
    timeSinceLastFrame: number;
  }) => {
    'worklet';
    if (!entity || !active)
      return;
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
      const position = transformManager.getTransform(entity).translation;
      const cat = catPosition.value;
      const distance = Math.hypot(cat[0] - position[0], cat[2] - position[2]);
      if (catPresent && !chase && distance < radius + catRadius + .08 && (playingId === object.instanceId && playContact && s.time > s.nextTap || !s.contact)) {
        const dx = position[0] - cat[0], dz = position[2] - cat[2], length = Math.max(.01, Math.hypot(dx, dz));
        body.applyCentralImpulse(dx / length * .12, .025, dz / length * .12);
        s.nextTap = s.time + 1.3;
      }
      s.contact = distance < radius + catRadius + .08;
      const meta = NATIVE_MODEL_CATALOG[object.modelId];
      const localCenter = meta.max.map((v, i) => (v + meta.min[i]) / 2);
      const matrix = transformManager.getTransform(entity).data;
      const { angle, axis } = nativeBodyRotation(matrix);
      transform = transformManager.createIdentityMatrix().translate(localCenter.map(v => -v) as Float3)
        .scaling([object.scale, object.scale, object.scale]).rotate(angle, axis).translate(position);
      s.report += timeSinceLastFrame;
      if (s.report > .1) {
        s.report = 0;
        const point = projectWorld(position, roomWidth);
        if (Math.hypot(point.x - s.screenX, point.y - s.screenY) > .75) {
          s.screenX = point.x;
          s.screenY = point.y;
          notify(object.instanceId, point.x, point.y, position);
        }
      }
      if (Math.abs(position[0]) > 2.25 || Math.abs(position[2]) > 2.25 || position[1] < FLOOR_Y)
        body.setPosition(...center);
    }
    transformManager.setTransform(entity, transform);
    if (animator && animator.getAnimationCount() > 0 && object.poweredOn !== false && (!NATIVE_MODEL_CATALOG[object.modelId].wind || breezy)) {
      animator.applyAnimation(0, s.time);
      animator.updateBoneMatrices();
    }
    clock.value = s;
  }, [active, animator, body, breezy, catPresent, catPosition, catRadius, center, chase, chaseTime, clock, entity, initialTransform, notify, object, playContact, playingId, radius, roomWidth, transformManager, travel]);
  RenderCallbackContext.useRenderCallback(render, [render]);
  return null;
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
  const catShape = useBoxShape(props.world.radius, .40 * props.world.catScale, props.world.radius);
  const catBody = useRigidBody({ id: 'cat', mass: 0, shape: catShape, origin: props.world.home, world: catPresent ? world : undefined });
  useEffect(() => { catBody?.setKinematic(true); }, [catBody]);
  const breezy = props.world.objects.some(o => isAirConditionerDecorationId(o.modelId) && o.poweredOn);
  const visible = active && !props.paused;
  const drawing = useSharedValue({ ready, visualKey, visible, reduceMotion });
  useEffect(() => { drawing.value = { ready, visualKey, visible, reduceMotion }; }, [drawing, ready, visualKey, visible, reduceMotion]);
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
      if (current.visible && !current.reduceMotion) {
        const position = catPosition.value;
        if (catPresent) catBody?.setPosition(position[0], position[1] + .40 * catScale, position[2]);
        world.stepSimulation(Math.min(1 / 15, Math.max(0, timeSinceLastFrame)), 4, 1 / 60);
      }

  }, [camera, catBody, catPosition, catPresent, catScale, drawing, reportPainted, view, warmup, world]);
  return <FilamentView style={StyleSheet.flatten(StyleSheet.absoluteFill)} enableTransparentRendering renderCallback={render}>
  <DefaultLight />
  <RoomModel id={props.roomId ?? 'room1'} onReady={handleRoomReady}/>
  {([-1, 1] as const).flatMap(side => [
      <BoxCollider key={'x' + side} id={'wall-x' + side} world={world} size={[.05, 1.5, 2.5]} position={[side * 2.45, 1.5, 0]}/>,
      <BoxCollider key={'z' + side} id={'wall-z' + side} world={world} size={[2.5, 1.5, .05]} position={[0, 1.5, side * 2.45]}/>,
    ])}
  {props.world.objects.flatMap(object => (object.collisionBoxes ?? []).map((box, index) =>
    <BoxCollider key={object.instanceId + ':part:' + index} id={object.instanceId + ':part:' + index} world={world}
      size={box.max.map((v, i) => Math.max(.01, (v - box.min[i]) / 2)) as Float3}
      position={box.max.map((v, i) => (v + box.min[i]) / 2) as Float3}/>))}
  {props.world.objects.map(object => <RoomObject key={object.instanceId + ':' + object.modelId} object={object} onReady={handleObjectReady} world={world} catPresent={catPresent} catPosition={catPosition} playingId={props.playingId} playContact={props.playContact} active={visible && !reduceMotion} breezy={breezy} travel={props.travel} activityKey={props.activityKey} roomWidth={props.world.width} catRadius={props.world.radius} onPosition={props.onObjectPosition}/>)}
  {props.world.objects.filter(o => isAirConditionerDecorationId(o.modelId) && o.poweredOn).map(o => <NativeAirflow key={o.instanceId} object={o} active={visible && !reduceMotion}/>)}
  {eatingBowl && !reduceMotion && <NativeFoodSpill key={props.activityKey} object={eatingBowl} active={visible} animationTime={catAnimationTime}/>}
  {catPresent && <NativeCatActor key={catKey} initialPosition={props.initialCatPosition} skinId={props.skinId} playback={props.playback} world={props.world} travel={props.travel} activityKey={props.activityKey} active={visible} reduceMotion={reduceMotion} positionValue={catPosition} animationTimeValue={catAnimationTime} onReady={() => setCatReadyFor(catKey)} onPosition={props.onPosition} onContactPosition={props.onContactPosition} onRoomStepComplete={props.onRoomStepComplete} onAnimationComplete={props.onAnimationComplete} onStepComplete={props.onStepComplete}/>}
 </FilamentView>;
}
export const NativeRoomScene = memo(function NativeRoomScene(props: Props) {
  // Reserve the startup hold before native layout can mount the renderer.
  // Scene's own hold takes over in the same commit once dimensions are known.
  useStartupVisualReady(props.world.width > 0);
  if (props.world.width <= 0)
    return <View style={styles.loading}><ActivityIndicator color={GameColors.primary}/></View>;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: GameColors.background }]}><FilamentScene ambientOcclusionOptions={{ enabled: true, radius: .3, intensity: 1 }}><Scene {...props}/></FilamentScene></View>;
});
const styles = StyleSheet.create({ loading: { ...StyleSheet.flatten(StyleSheet.absoluteFill), alignItems: 'center', justifyContent: 'center' } });
