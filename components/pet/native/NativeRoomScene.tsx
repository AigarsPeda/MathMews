import { NativeAirflow } from "./NativeAirflow";
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
  roomId?: string;
  skinId?: string;
  playback: PetPlaybackState;
  travel?: NativeTravel;
  activityKey?: string;
  playingId?: string;
  playContact?: boolean;
  paused?: boolean;
  onObjectPosition?: (id: string, point: {
    x: number;
    y: number;
  }) => void;
  onPosition?: (point: {
    x: number;
    y: number;
  }) => void;
  onContactPosition?: (position: Vec3) => void;
  onAnimationComplete?: () => void;
  onStepComplete?: (index: number) => void;
};
function RoomModel({ id }: {
  id: string;
}) { useModel(NATIVE_MODEL_SOURCES[id] ?? NATIVE_MODEL_SOURCES.room1); return null; }
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
function RoomObject({ object, world, catPosition, playingId, playContact, active, roomWidth, catRadius, onPosition, travel, activityKey, breezy }: {
  object: NativeRoomObject;
  world: DiscreteDynamicWorld;
  catPosition: ISharedValue<Vec3>;
  playingId?: string;
  playContact?: boolean;
  active: boolean;
  breezy: boolean;
  travel?: NativeTravel;
  activityKey?: string;
  roomWidth: number;
  catRadius: number;
  onPosition?: (id: string, point: {
    x: number;
    y: number;
  }) => void;
}) {
  'use no memo';
  const { transformManager } = useFilamentContext();
  const model = useModel(NATIVE_MODEL_SOURCES[object.modelId], { shouldReleaseSourceData: false });
  const entity = model.state === 'loaded' ? model.rootEntity : undefined;
  const animator = useAnimator(model.state === 'loaded' ? model.asset : undefined);
  const halfSize = useMemo(() => object.max.map((v, i) => Math.max(.01, (v - object.min[i]) / 2)) as Float3, [object]);
  const center = useMemo(() => object.max.map((v, i) => (v + object.min[i]) / 2) as Float3, [object]);
  const radius = Math.max(halfSize[0], halfSize[2]);
  const box = useBoxShape(...halfSize);
  const sphere = useSphereShape(radius);
  const body = useRigidBody({ id: object.instanceId + (playingId === object.instanceId ? ':play' : ':rest'), mass: object.movable ? .22 : 0,
    shape: object.movable ? sphere : box, origin: center, world: object.movable || (object.collidable ?? object.solid) && !object.collisionBoxes ? world : undefined,
    friction: .5, damping: [.35, .45] });
  const clock = useSharedValue({ time: 0, contact: false, nextTap: .65, reset: false, report: 0, screenX: Infinity, screenY: Infinity });
  const callback = useRef(onPosition);
  useEffect(() => { callback.current = onPosition; }, [onPosition]);
  const receive = useCallback((id: string, x: number, y: number) => callback.current?.(id, { x, y }), []);
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
  useEffect(() => { chaseTime.value = 0; body?.setKinematic(!!chase); }, [activityKey, body, chase, chaseTime]);
  useEffect(() => { clock.value = { time: 0, contact: false, nextTap: .65, reset: true, report: 0, screenX: Infinity, screenY: Infinity }; }, [body, clock, object]);
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
      if (!chase && distance < radius + catRadius + .08 && (playingId === object.instanceId && playContact && s.time > s.nextTap || !s.contact)) {
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
          notify(object.instanceId, point.x, point.y);
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
  }, [active, animator, body, breezy, catPosition, catRadius, center, chase, chaseTime, clock, entity, initialTransform, notify, object, playContact, playingId, radius, roomWidth, transformManager, travel]);
  RenderCallbackContext.useRenderCallback(render, [render]);
  return null;
}
function Scene(props: Props) {
  'use no memo';
  const { camera, view } = useFilamentContext();
  const [ready, setReady] = useState(false);
  useStartupVisualReady(ready);
  const { active, reduceMotion } = useAnimationActivity();
  const world = useWorld(0, -9.81, 0);
  const floorShape = useStaticPlaneShape(0, 1, 0, 0);
  useRigidBody({ id: 'floor', mass: 0, shape: floorShape, origin: [0, FLOOR_Y, 0], world, friction: .7 });
  const catPosition = useSharedValue<Vec3>(props.world.home);
  const catShape = useBoxShape(props.world.radius, .40 * props.world.catScale, props.world.radius);
  const catBody = useRigidBody({ id: 'cat', mass: 0, shape: catShape, origin: props.world.home, world });
  useEffect(() => { catBody?.setKinematic(true); }, [catBody]);
  const breezy = props.world.objects.some(o => isAirConditionerDecorationId(o.modelId) && o.poweredOn);
  const visible = active && !props.paused;
  return <FilamentView style={StyleSheet.flatten(StyleSheet.absoluteFill)} enableTransparentRendering renderCallback={({ timeSinceLastFrame }) => {
      'worklet';
      const aspect = Math.max(.1, view.getAspectRatio());
      camera.setOrthographicProjection(-ROOM_SPAN / 2, ROOM_SPAN / 2, -ROOM_SPAN / 2 / aspect, ROOM_SPAN / 2 / aspect, .1, 50);
      camera.lookAt([8, 7, 8], [0, .9, 0], [0, 1, 0]);
      if (visible && !reduceMotion && catBody) {
        const position = catPosition.value;
        catBody.setPosition(position[0], position[1] + .40 * props.world.catScale, position[2]);
        world.stepSimulation(Math.min(1 / 15, Math.max(0, timeSinceLastFrame)), 4, 1 / 60);
      }
    }}>
  <DefaultLight />
  <RoomModel id={props.roomId ?? 'room1'}/>
  {([-1, 1] as const).flatMap(side => [
      <BoxCollider key={'x' + side} id={'wall-x' + side} world={world} size={[.05, 1.5, 2.5]} position={[side * 2.45, 1.5, 0]}/>,
      <BoxCollider key={'z' + side} id={'wall-z' + side} world={world} size={[2.5, 1.5, .05]} position={[0, 1.5, side * 2.45]}/>,
    ])}
  {props.world.objects.flatMap(object => (object.collisionBoxes ?? []).map((box, index) =>
    <BoxCollider key={object.instanceId + ':part:' + index} id={object.instanceId + ':part:' + index} world={world}
      size={box.max.map((v, i) => Math.max(.01, (v - box.min[i]) / 2)) as Float3}
      position={box.max.map((v, i) => (v + box.min[i]) / 2) as Float3}/>))}
  {props.world.objects.map(object => <RoomObject key={object.instanceId + ':' + object.modelId} object={object} world={world} catPosition={catPosition} playingId={props.playingId} playContact={props.playContact} active={visible && !reduceMotion} breezy={breezy} travel={props.travel} activityKey={props.activityKey} roomWidth={props.world.width} catRadius={props.world.radius} onPosition={props.onObjectPosition}/>)}
  {props.world.objects.filter(o => isAirConditionerDecorationId(o.modelId) && o.poweredOn).map(o => <NativeAirflow key={o.instanceId} object={o} active={visible && !reduceMotion}/>)}
  <NativeCatActor skinId={props.skinId} playback={props.playback} world={props.world} travel={props.travel} activityKey={props.activityKey} active={visible} reduceMotion={reduceMotion} positionValue={catPosition} onReady={() => setReady(true)} onPosition={props.onPosition} onContactPosition={props.onContactPosition} onAnimationComplete={props.onAnimationComplete} onStepComplete={props.onStepComplete}/>
 </FilamentView>;
}
export const NativeRoomScene = memo(function NativeRoomScene(props: Props) {
  if (props.world.width <= 0)
    return <View style={styles.loading}><ActivityIndicator color={GameColors.primary}/></View>;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: GameColors.background }]}><FilamentScene ambientOcclusionOptions={{ enabled: true, radius: .3, intensity: 1 }}><Scene {...props}/></FilamentScene></View>;
});
const styles = StyleSheet.create({ loading: { ...StyleSheet.flatten(StyleSheet.absoluteFill), alignItems: 'center', justifyContent: 'center' } });
