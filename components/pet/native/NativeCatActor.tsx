/* eslint-disable react-hooks/immutability */
/* Native asset requires are statically resolved by Metro. */
/* eslint-disable @typescript-eslint/no-require-imports */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { RenderCallbackContext, useAnimator, useFilamentContext, useModel } from 'react-native-filament';
import { useSharedValue, Worklets, type ISharedValue } from 'react-native-worklets-core';
import { resolveCatSkinId } from '@/constants/cat-skins';
import { FLOOR_Y, catScreenPoint, type NativeRoomWorld, type NativeTravel, type Vec3 } from '@/utils/native-room-world';
import type { PetPlaybackState } from '@/pet-display/types';
import { CAT_ANIMATION_CLIPS } from '@/constants/cat-animation-clips';
import { resolveTailContact, tailParentAxis, type TailContact } from '@/utils/native-cat-contact';
import { limbAim, reachingElbow } from '@/utils/native-hanging-toy';
const SOURCES = {
  orange: require('@/assets/3d/native/cat-orange.glb'),
  grey: require('@/assets/3d/native/cat-grey.glb'),
  white: require('@/assets/3d/native/cat-white.glb'),
};
const CLIPS: Record<string, number[]> = CAT_ANIMATION_CLIPS;
type Props = {
  skinId?: string;
  playback: PetPlaybackState;
  world?: NativeRoomWorld;
  travel?: NativeTravel;
  activityKey?: string;
  loop?: boolean;
  active: boolean;
  reduceMotion?: boolean;
  onReady?: () => void;
  onPosition?: (position: {
    x: number;
    y: number;
  }) => void;
  onAnimationComplete?: () => void;
  onStepComplete?: (index: number) => void;
  positionValue?: ISharedValue<Vec3>;
  animationTimeValue?: ISharedValue<{ name: string; time: number }>;
  hangingBall?: ISharedValue<Vec3>;
  plantLeaf?: ISharedValue<Vec3 | undefined>;
  pawPositions?: ISharedValue<Vec3[]>;
  onContactPosition?: (position: Vec3, elapsed?: number) => void;
  onRoomStepComplete?: (key: string, position: Vec3) => void;
  initialPosition?: Vec3;
};
export function NativeCatActor({ skinId, playback, world, travel, activityKey, loop, active, onPosition, onAnimationComplete, onStepComplete, onContactPosition, onRoomStepComplete, onReady, positionValue, animationTimeValue, hangingBall, plantLeaf, pawPositions, initialPosition, reduceMotion = false }: Props) {
  'use no memo';
  const { transformManager } = useFilamentContext();
  const model = useModel(SOURCES[resolveCatSkinId(skinId)], { shouldReleaseSourceData: false });
  const asset = model.state === 'loaded' ? model.asset : undefined;
  const entity = model.state === 'loaded' ? model.rootEntity : undefined;
  const animator = useAnimator(asset);
  const frontLegs = useMemo(() => {
    if (!asset) return [];
    const parent = asset.getFirstEntityByName('chest');
    return ['L', 'R'].flatMap(side => {
      const upper = asset.getFirstEntityByName(`${side}.forelegjoint0`);
      const lower = asset.getFirstEntityByName(`${side}.forelegjoint1`);
      const paw = asset.getFirstEntityByName(`${side}.front.paw`);
      return parent && upper && lower && paw ? [{ parent, upper, lower, paw }] : [];
    });
  }, [asset]);
  const tail = useMemo(() => {
    if (!asset) return undefined;
    const joints = ['tailjoint0', 'tailjoint1', 'tailjoint2', 'tailjoint3', 'tailTip'].map(name => asset.getFirstEntityByName(name));
    const parent = asset.getFirstEntityByName('spine');
    return joints.every(joint => joint !== undefined) && parent ? { joints: joints.map(joint => joint!), parent } : undefined;
  }, [asset]);
  const eatingProps = useMemo(() => {
    if (!asset) return [];
    const names = ['Bowl base', 'Bowl rim', 'Food', ...Array.from({ length: 14 }, (_, i) =>
      `Bowl kibble${i ? `.${String(i).padStart(3, '0')}` : ''}`),
      ...Array.from({ length: 8 }, (_, i) => `Spilled kibble ${i + 1}`)];
    return names.flatMap(name => {
      const prop = asset.getFirstEntityByName(`${name} Game prop`);
      return prop ? [{ entity: prop, transform: transformManager.getTransform(prop) }] : [];
    });
  }, [asset, transformManager]);
  const callbacks = useRef({ onPosition, onAnimationComplete, onStepComplete, onContactPosition, onRoomStepComplete, onReady });
  useEffect(() => { callbacks.current = { onPosition, onAnimationComplete, onStepComplete, onContactPosition, onRoomStepComplete, onReady }; }, [onPosition, onAnimationComplete, onStepComplete, onContactPosition, onRoomStepComplete, onReady]);
  const receive = useCallback((kind: 'position' | 'complete' | 'step' | 'ready' | 'roomComplete', data: number[] | number | { key: string; position: Vec3 }) => {
    if (kind === 'position' && Array.isArray(data)) {
      callbacks.current.onPosition?.({ x: data[0], y: data[1] });
      callbacks.current.onContactPosition?.([data[2], data[3], data[4]], data[5]);
    }
    else if (kind === 'roomComplete' && typeof data === 'object' && 'key' in data)
      callbacks.current.onRoomStepComplete?.(data.key, data.position);
    else if (kind === 'step')
      callbacks.current.onStepComplete?.(data as number);
    else if (kind === 'complete')
      callbacks.current.onAnimationComplete?.();
    else if (kind === 'ready')
      callbacks.current.onReady?.();
  }, []);
  // This registers a deferred RN callback; createRunOnJS never executes it during render.
  // eslint-disable-next-line react-hooks/refs
  const notify = useMemo(() => Worklets.createRunOnJS(receive), [receive]);
  const segments = useMemo(() => (playback.kind === 'scenario' ? playback.steps : [playback.segment]).map(segment => {
    const meta = CLIPS[segment.assetKey] ?? CLIPS.idle;
    return { name: segment.assetKey.startsWith('walk') ? 'walk' : segment.assetKey,
      duration: segment.model ? segment.model.duration / segment.model.rate : meta[0] / meta[1], reverse: segment.reverse ?? false,
      loop: segment.loop ?? loop ?? false };
  }), [loop, playback]);
  const command = useSharedValue({ id: 0, activityKey, segments, travel, world, active, reduceMotion });
  const state = useSharedValue({ id: -1, elapsed: 0, index: 0, complete: false, roomComplete: false, heading: world ? Math.PI / 4 : 0, distance: 0,
    position: (initialPosition ?? world?.home ?? [0, 0, 0]) as Vec3, home: (world?.home ?? [0, 0, 0]) as Vec3, routeStart: (world?.home ?? [0, 0, 0]) as Vec3, report: 0, ready: false, clip: -1, clipTime: 0, previous: -1, previousTime: 0, blend: 1,
    tailContact: { angle: 0, axis: [0, 1, 0], blocked: false } as TailContact });
  useEffect(() => {
    const previous = command.value.world;
    const movedHome = !command.value.travel && previous && world && previous.home.some((v, i) => v !== world.home[i]);
    command.value = { ...command.value, world, id: movedHome ? command.value.id + 1 : command.value.id };
  }, [command, world]);
  useEffect(() => {
    command.value = { ...command.value, id: command.value.id + 1, activityKey, segments, travel };
  }, [activityKey, command, segments, travel]);
  useEffect(() => { command.value = { ...command.value, active, reduceMotion }; }, [active, reduceMotion, command]);
  const clips = useMemo(() => {
    if (!animator)
      return {};
    const result: Record<string, {
      index: number;
      duration: number;
    }> = {};
    for (let i = 0; i < animator.getAnimationCount(); i++)
      result[animator.getAnimationName(i)] = { index: i, duration: animator.getAnimationDuration(i) };
    return result;
  }, [animator]);
  const render = useCallback(({ timeSinceLastFrame }: {
    timeSinceLastFrame: number;
  }) => {
    'worklet';
    if (!entity || !animator)
      return;
    const request = command.value;
    if (!request.active && state.value.ready)
      return;
    const frameState = { ...state.value };
    if (frameState.id !== request.id) {
      frameState.id = request.id;
      frameState.elapsed = request.travel?.elapsed ?? 0;
      frameState.index = 0;
      frameState.complete = false;
      frameState.roomComplete = false;
      if (request.travel?.path.length) {
        if (!request.travel.replanned || !frameState.ready) frameState.position = [request.travel.path[0][0], request.travel.path[0][1], request.travel.path[0][2]];
        frameState.routeStart = frameState.position;
      }
      else if (request.world && (!frameState.ready || frameState.home.some((v, i) => v !== request.world!.home[i])))
        frameState.position = !frameState.ready && initialPosition ? initialPosition : request.world.home;
      if (request.world) frameState.home = request.world.home;
    }
    const deltaSeconds = request.active ? Math.min(1 / 15, Math.max(0, timeSinceLastFrame)) : 0;
    frameState.elapsed += deltaSeconds;
    let segment = request.segments[frameState.index];
    if (!segment)
      return;
    if (!segment.loop && !frameState.complete && frameState.elapsed >= (request.reduceMotion ? .6 : segment.duration)) {
      notify('step', frameState.index);
      if (frameState.index < request.segments.length - 1) {
        frameState.elapsed -= request.reduceMotion ? .6 : segment.duration;
        frameState.index++;
        segment = request.segments[frameState.index];
      }
      else {
        frameState.complete = true;
        notify('complete', 0);
      }
    }
    const scale = request.world?.catScale ?? 1;
    const previousPosition = frameState.position;
    const journey = request.travel;
    let walking = false;
    if (journey?.path.length) {
      // Shared arrays do not expose slice in Filament's Worklets Core runtime.
      const path = journey.replanned ? [frameState.routeStart] : journey.path;
      if (journey.replanned) {
        for (let i = 1; i < journey.path.length; i++) path.push(journey.path[i]);
      }
      if (journey.jump) {
        const t = Math.max(0, Math.min(1, (frameState.elapsed / journey.duration - .20) / .50));
        const first = path[0], last = path[path.length - 1];
        frameState.position = [first[0] + (last[0] - first[0]) * t, first[1] + (last[1] - first[1]) * t + Math.sin(Math.PI * t) * .35 * scale, first[2] + (last[2] - first[2]) * t];
      }
      else if (path.length > 1) {
        walking = frameState.elapsed < journey.duration;
        let routeDistance = journey.distance;
        if (journey.replanned) {
          routeDistance = 0;
          for (let i = 1; i < path.length; i++) routeDistance += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]);
        }
        let remaining = Math.min(routeDistance, frameState.elapsed / journey.duration * routeDistance);
        const end = path[path.length - 1];
        frameState.position = [end[0], end[1], end[2]];
        for (let i = 1; i < path.length; i++) {
          const a = path[i - 1], b = path[i], length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
          if (remaining <= length && length > 0) {
            const t = remaining / length;
            frameState.position = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
            break;
          }
          remaining -= length;
        }
      }
      else
        frameState.position = [path[0][0], path[0][1], path[0][2]];
    }
    const moved = Math.hypot(frameState.position[0] - previousPosition[0], frameState.position[2] - previousPosition[2]);
    frameState.distance += moved;
    const desiredHeading = moved > .0001 ? Math.atan2(frameState.position[0] - previousPosition[0], frameState.position[2] - previousPosition[2]) : journey?.heading ?? frameState.heading;
    const turn = Math.atan2(Math.sin(desiredHeading - frameState.heading), Math.cos(desiredHeading - frameState.heading));
    frameState.heading += turn * Math.min(1, deltaSeconds * 12);
    const perched = journey?.treePlay && !journey.jump && frameState.position[1] > FLOOR_Y + .1;
    const clip = clips[walking ? 'walk' : perched && segment.name === 'batToy' ? 'sit' : segment.name] ?? clips.idle;
    if (!clip)
      return;
    let time = walking ? (frameState.distance / (.8 * scale) % 1) * clip.duration
      : Math.min(segment.duration, segment.loop ? frameState.elapsed % segment.duration : frameState.elapsed) / segment.duration * clip.duration;
    if (segment.reverse)
      time = clip.duration - time;
    if (request.reduceMotion)
      time = clip.duration * .25;
    if (clip.index !== frameState.clip) {
      frameState.previous = frameState.clip;
      frameState.previousTime = frameState.clipTime;
      frameState.clip = clip.index;
      frameState.blend = 0;
    }
    frameState.clipTime = time;
    if (animationTimeValue)
      animationTimeValue.value = { name: walking ? 'walk' : segment.name, time };
    frameState.blend = Math.min(1, frameState.blend + deltaSeconds / .12);
    animator.applyAnimation(clip.index, time);
    if (frameState.previous >= 0 && frameState.blend < 1)
      animator.applyCrossFade(frameState.previous, frameState.previousTime, frameState.blend);
    const transform = transformManager.createIdentityMatrix().scaling([scale, scale, scale]).rotate(frameState.heading, [0, 1, 0]).translate(frameState.position);
    transformManager.setTransform(entity, transform);
    const pawTarget = request.travel?.plantPlay ? plantLeaf?.value : request.travel?.treePlay ? hangingBall?.value : undefined;
    if (segment.name === 'batToy' && pawTarget && !request.reduceMotion) {
      const target = pawTarget;
      const phase = time / clip.duration;
      for (let i = 0; i < frontLegs.length; i++) {
        const leg = frontLegs[i];
        const swat = Math.max(0, 1 - Math.abs(phase - (i === 0 ? .34 : .61)) / .12);
        if (swat <= 0) continue;
        const shoulder = transformManager.getWorldTransform(leg.upper).translation;
        const elbow = transformManager.getWorldTransform(leg.lower).translation;
        const paw = transformManager.getWorldTransform(leg.paw).translation;
        const reach = paw.map((v, k) => v + (target[k] - v) * swat) as Vec3;
        const desiredElbow = reachingElbow(shoulder, elbow, paw, reach, frameState.heading);
        const upperAim = limbAim(elbow.map((v, k) => v - shoulder[k]) as Vec3, desiredElbow.map((v, k) => v - shoulder[k]) as Vec3);
        const upperLocal = transformManager.getTransform(leg.upper), origin = upperLocal.translation;
        transformManager.setTransform(leg.upper, upperLocal.translate(origin.map(v => -v) as Vec3)
          .rotate(upperAim.angle, tailParentAxis(upperAim.axis, transformManager.getWorldTransform(leg.parent).data)).translate(origin));
        const movedElbow = transformManager.getWorldTransform(leg.lower).translation;
        const movedPaw = transformManager.getWorldTransform(leg.paw).translation;
        const lowerAim = limbAim(movedPaw.map((v, k) => v - movedElbow[k]) as Vec3, reach.map((v, k) => v - movedElbow[k]) as Vec3);
        const lowerLocal = transformManager.getTransform(leg.lower), lowerOrigin = lowerLocal.translation;
        transformManager.setTransform(leg.lower, lowerLocal.translate(lowerOrigin.map(v => -v) as Vec3)
          .rotate(lowerAim.angle, tailParentAxis(lowerAim.axis, transformManager.getWorldTransform(leg.upper).data)).translate(lowerOrigin));
      }
    }
    if (pawPositions) pawPositions.value = !request.reduceMotion
      ? frontLegs.map(leg => transformManager.getWorldTransform(leg.paw).translation) : [];
    if (tail && request.world) {
      const points = tail.joints.map(joint => transformManager.getWorldTransform(joint).translation);
      frameState.tailContact = resolveTailContact(points, request.world, frameState.tailContact, deltaSeconds);
      if (frameState.tailContact.angle > .001) {
        const joint = tail.joints[0];
        const local = transformManager.getTransform(joint);
        const origin = local.translation;
        const axis = tailParentAxis(frameState.tailContact.axis, transformManager.getWorldTransform(tail.parent).data);
        transformManager.setTransform(joint, local.translate(origin.map(v => -v) as Vec3)
          .rotate(frameState.tailContact.angle, axis).translate(origin));
      }
    }
    for (const prop of eatingProps) transformManager.setTransform(prop.entity,
      request.travel?.hideEatingProps ? transformManager.createIdentityMatrix().scaling([0, 0, 0]) : prop.transform);
    animator.updateBoneMatrices();
    frameState.report += deltaSeconds;
    if (request.world && frameState.report >= .05) {
      frameState.report = 0;
      const point = catScreenPoint(frameState.position, request.world);
      notify('position', [point.x, point.y, ...frameState.position, frameState.elapsed]);
    }
    if (positionValue)
      positionValue.value = frameState.position;
    if (!frameState.ready) {
      frameState.ready = true;
      notify('ready', 0);
    }
    if (request.activityKey && request.travel?.awaitCompletion && !frameState.roomComplete
      && frameState.elapsed >= (request.reduceMotion ? .6 : request.travel.duration)) {
      frameState.roomComplete = true;
      notify('roomComplete', { key: request.activityKey, position: [frameState.position[0], frameState.position[1], frameState.position[2]] });
    }
    state.value = frameState;
  }, [animationTimeValue, animator, clips, command, eatingProps, entity, frontLegs, hangingBall, initialPosition, notify, pawPositions, plantLeaf, positionValue, state, tail, transformManager]);
  RenderCallbackContext.useRenderCallback(render, [render]);
  return null;
}
