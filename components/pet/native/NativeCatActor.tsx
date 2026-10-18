/* eslint-disable react-hooks/immutability */
/* Native asset requires are statically resolved by Metro. */
/* eslint-disable @typescript-eslint/no-require-imports */
import { rockingChairContact, type RockingMotion } from '@/utils/native-rocking-chair';
import { catJumpPoint, catMotionSample, catPathFromPosition, catPathPoint, catTravelProgress, type CatMotionLeg } from '@/utils/native-cat-locomotion';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { RenderCallbackContext, useAnimator, useFilamentContext, useModel } from 'react-native-filament';
import { useSharedValue, Worklets, type ISharedValue } from 'react-native-worklets-core';
import { resolveCatSkinId } from '@/constants/cat-skins';
import { FLOOR_Y, catScreenPoint, hasNativeArrived, type NativeRoomWorld, type NativeTravel, type Vec3 } from '@/utils/native-room-world';
import type { PetPlaybackState } from '@/pet-display/types';
import { CAT_ANIMATION_CLIPS } from '@/constants/cat-animation-clips';
import { resolveTailContact, tailParentAxis, type TailContact } from '@/utils/native-cat-contact';
import { limbAim, reachingElbow } from '@/utils/native-hanging-toy';
import { buildRugSurfaces, rugSupportLift } from '@/utils/native-ground-support';
import { catTurnDuration, catTurnPaw, catTurnPawOrientation, catTurnPose } from '@/utils/native-cat-turn';
import { useModelShadows } from './use-model-shadows';
const SOURCES = {
  orange: require('@/assets/3d/native/cat-orange.glb'),
  grey: require('@/assets/3d/native/cat-grey.glb'),
  white: require('@/assets/3d/native/cat-white.glb'),
};
const CLIPS: Record<string, number[]> = CAT_ANIMATION_CLIPS;
// Fast Refresh can retain drawing-thread state while recreating React refs.
// Wall-clock initialization keeps new revisions above those retained commands.
let nextCommandRevision = Date.now();
type Props = {
  registerPickEntities?: (id: string, entities: { id: number }[]) => () => void;
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
  rockingMotion?: ISharedValue<RockingMotion>;
  animationTimeValue?: ISharedValue<{ name: string; time: number }>;
  hangingBall?: ISharedValue<Vec3>;
  plantLeaf?: ISharedValue<Vec3 | undefined>;
  pawPositions?: ISharedValue<Vec3[]>;
  onContactPosition?: (position: Vec3, elapsed?: number) => void;
  onRoomStepComplete?: (key: string, position: Vec3) => void;
  initialPosition?: Vec3;
};
export function NativeCatActor({ skinId, playback, world, travel, activityKey, loop, active, onPosition, onAnimationComplete, onStepComplete, onContactPosition, onRoomStepComplete, onReady, positionValue, rockingMotion, animationTimeValue, hangingBall, plantLeaf, pawPositions, initialPosition, registerPickEntities, reduceMotion = false }: Props) {
  'use no memo';
  const { transformManager } = useFilamentContext();
  const model = useModel(SOURCES[resolveCatSkinId(skinId)], { shouldReleaseSourceData: false });
  const asset = model.state === 'loaded' ? model.asset : undefined;
  useModelShadows(asset);
  useEffect(() => asset ? registerPickEntities?.('cat', asset.getRenderableEntities()) : undefined, [asset, registerPickEntities]);
  const entity = model.state === 'loaded' ? model.rootEntity : undefined;
  const animator = useAnimator(asset);
  const supportingPaws = useMemo(() => asset ? ['L.front.paw', 'R.front.paw', 'L.rear.paw', 'R.rear.paw']
    .flatMap(name => { const paw = asset.getFirstEntityByName(name); return paw ? [paw] : []; }) : [], [asset]);
  const rugSurfaces = useMemo(() => buildRugSurfaces(world), [world]);
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
  const turningRig = useMemo(() => {
    if (!asset) return undefined;
    const head = asset.getFirstEntityByName('head');
    const neck = asset.getFirstEntityByName('neck');
    const spine = asset.getFirstEntityByName('spine');
    const legs = ['L', 'R', 'L', 'R'].flatMap((side, i) => {
      const rear = i >= 2;
      const parent = asset.getFirstEntityByName(rear ? 'pelvis' : 'chest');
      const upper = asset.getFirstEntityByName(`${side}.${rear ? 'hindleg' : 'foreleg'}joint0`);
      const lower = asset.getFirstEntityByName(`${side}.${rear ? 'hindleg' : 'foreleg'}joint1`);
      const paw = asset.getFirstEntityByName(`${side}.${rear ? 'rear' : 'front'}.paw`);
      return parent && upper && lower && paw ? [{ parent, upper, lower, paw, rear }] : [];
    });
    return head && neck && spine && legs.length === 4 ? { head, neck, spine, legs } : undefined;
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
    else if (kind === 'roomComplete' && typeof data === 'object' && 'key' in data) {
      callbacks.current.onRoomStepComplete?.(data.key, data.position);
    }
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
  const command = useSharedValue({ id: 0, activityKey, segments, travel, world, active, reduceMotion, rugSurfaces });
  const commandRevision = useRef<{ id: number; activityKey?: string; segments?: typeof segments; travel?: NativeTravel; home?: Vec3 }>({ id: 0 });
  const state = useSharedValue({ id: -1, elapsed: 0, index: 0, complete: false, roomComplete: false, heading: world ? Math.PI / 4 : 0, distance: 0,
    position: (initialPosition ?? world?.home ?? [0, 0, 0]) as Vec3, home: (world?.home ?? [0, 0, 0]) as Vec3, routeStart: (world?.home ?? [0, 0, 0]) as Vec3, report: 0, ready: false, clip: -1, clipTime: 0, previous: -1, previousTime: 0, blend: 1,
    clipLoop: false, previousLoop: false, clipDuration: 1, previousDuration: 1,
    routePath: [] as Vec3[], routePaces: [] as number[], routeLegs: [] as CatMotionLeg[], routeDuration: 0,
    sourcePath: [] as Vec3[], sourceDuration: 0, sourceJump: false,
    turnElapsed: 0, turnDuration: 0, turnFrom: 0, turnAngle: 0,
    turnFeet: [] as Vec3[], turnNeutral: [] as Vec3[], turnLeg: -1,
    turnSoles: [] as number[][], turnHead: 0, turnSpineHeight: 0, turnCrouch: 0,
    turnInitialSoles: [] as number[][],
    tailContact: { angle: 0, axis: [0, 1, 0], blocked: false } as TailContact });
  useEffect(() => {
    // A replaced model needs its pose applied even when playback is paused.
    state.value = { ...state.value, ready: false, clip: -1, previous: -1, blend: 1 };
  }, [asset, state]);
  useEffect(() => {
    const previous = commandRevision.current;
    const movedHome = !travel && previous.home && world && previous.home.some((v, i) => v !== world.home[i]);
    const sameSegments = previous.segments?.length === segments.length && segments.every((segment, i) => {
      const old = previous.segments![i];
      return old.name === segment.name && old.duration === segment.duration && old.loop === segment.loop && old.reverse === segment.reverse;
    });
    const changed = previous.activityKey !== activityKey || !sameSegments || previous.travel !== travel || movedHome;
    const id = changed ? ++nextCommandRevision : previous.id;
    commandRevision.current = { id, activityKey, segments, travel, home: world?.home };
    // Publish one complete snapshot. Separate read/modify/write effects can
    // overwrite a new movement revision with an older drawing-thread snapshot.
    command.value = { id, activityKey, segments, travel, world, active, reduceMotion, rugSurfaces };
  }, [activityKey, active, command, reduceMotion, rugSurfaces, segments, travel, world]);
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
      const renderedElapsed = frameState.elapsed;
      frameState.id = request.id;
      frameState.elapsed = request.travel?.elapsed ?? 0;
      frameState.index = 0;
      frameState.complete = false;
      frameState.roomComplete = false;
      if (!request.travel?.path.length) {
        frameState.turnElapsed = 0;
        frameState.turnDuration = 0;
        frameState.turnFeet = [];
        frameState.turnNeutral = [];
        frameState.turnLeg = -1;
      }
      if (request.travel?.path.length) {
        const journey = request.travel;
        let resume = frameState.ready && !!journey.elapsed && frameState.sourceDuration === journey.duration
          && frameState.sourceJump === journey.jump && frameState.sourcePath?.length === journey.path.length;
        if (resume) for (let i = 0; i < journey.path.length; i++) {
          const before = frameState.sourcePath[i], after = journey.path[i];
          if (before[0] !== after[0] || before[1] !== after[1] || before[2] !== after[2]) { resume = false; break; }
        }
        if (resume) {
          // RN's throttled pose/clock can trail the drawing thread on resume.
          frameState.elapsed = Math.max(renderedElapsed, journey.elapsed!);
        } else {
          frameState.turnElapsed = 0;
          frameState.turnDuration = 0;
          frameState.turnFeet = [];
          frameState.turnNeutral = [];
          frameState.turnLeg = -1;
          frameState.sourcePath = journey.path;
          frameState.sourceDuration = journey.duration;
          frameState.sourceJump = journey.jump;
          const firstLeg = journey.legs?.[0];
          const floorLeg = firstLeg?.kind === 'walk' && !firstLeg.animation && !firstLeg.turnDuration ? firstLeg : undefined;
          const floorStart = !journey.legs?.length || !!floorLeg;
          const rebase = frameState.ready && !request.reduceMotion && !journey.jump && floorStart && !journey.elapsed;
          const sourcePath = floorLeg?.path ?? journey.path, sourcePaces = floorLeg?.paces ?? journey.paces;
          const route = rebase ? catPathFromPosition(sourcePath, frameState.position, sourcePaces) : { path: sourcePath, paces: sourcePaces ?? [], fraction: 1 };
          frameState.routePath = journey.legs?.length ? journey.path : route.path;
          frameState.routePaces = route.paces;
          frameState.routeLegs = journey.legs ?? [];
          frameState.routeDuration = journey.duration;
          if (rebase && route.path.length > 1) {
            const duration = Math.max(.18, ((floorLeg?.duration ?? journey.duration) - .18) * route.fraction + .18);
            if (floorLeg) {
              const legs: CatMotionLeg[] = [{ ...floorLeg, path: route.path, paces: route.paces, duration }];
              for (let i = 1; i < journey.legs!.length; i++) legs.push(journey.legs![i]);
              frameState.routeLegs = legs;
              frameState.routeDuration += duration - floorLeg.duration;
            } else frameState.routeDuration = duration;
          }
          if (!frameState.ready || request.reduceMotion) frameState.position = [journey.path[0][0], journey.path[0][1], journey.path[0][2]];
          frameState.routeStart = frameState.position;
          if (!journey.jump && floorStart && !journey.elapsed && !request.reduceMotion) {
            let next: Vec3 | undefined;
            for (let i = 0; i < route.path.length; i++) {
              const point = route.path[i];
              if (Math.hypot(point[0] - frameState.position[0], point[2] - frameState.position[2]) > .01) { next = point; break; }
            }
            const facing = next ? Math.atan2(next[0] - frameState.position[0], next[2] - frameState.position[2])
              : frameState.position[1] <= FLOOR_Y + .1 * (request.world?.catScale ?? 1) ? journey.heading : undefined;
            if (facing !== undefined) {
              const angle = Math.atan2(Math.sin(facing - frameState.heading), Math.cos(facing - frameState.heading));
              if (!frameState.ready) frameState.heading = facing;
              else if (Math.abs(angle) > .35) {
                frameState.turnFrom = frameState.heading;
                frameState.turnAngle = angle;
                frameState.turnDuration = catTurnDuration(angle);
              }
            }
          }
        }
      }
      else if (request.world && (!frameState.ready || frameState.home.some((v, i) => v !== request.world!.home[i])))
        frameState.position = !frameState.ready && initialPosition ? initialPosition : request.world.home;
      if (request.world) frameState.home = request.world.home;
    }
    const deltaSeconds = request.active ? Math.min(1 / 15, Math.max(0, timeSinceLastFrame)) : 0;
    const turning = frameState.turnElapsed < frameState.turnDuration;
    const turnRemaining = frameState.turnDuration - frameState.turnElapsed;
    if (turning) {
      frameState.turnElapsed = Math.min(frameState.turnDuration, frameState.turnElapsed + deltaSeconds);
      const t = frameState.turnElapsed / frameState.turnDuration;
      frameState.heading = frameState.turnFrom + catTurnPose(frameState.turnAngle, t).heading;
    }
    frameState.elapsed += turning ? Math.max(0, deltaSeconds - turnRemaining) : deltaSeconds;
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
    let hopPhase: number | undefined;
    let turnPhase: number | undefined;
    let routeAnimation: string | undefined;
    let lookAhead: Vec3 | undefined;
    if (journey?.path.length) {
      // Shared arrays do not expose slice in Filament's Worklets Core runtime.
      const path = frameState.routePath;
      if (turning) {
        frameState.position = frameState.routeStart;
        turnPhase = frameState.turnElapsed / frameState.turnDuration;
      }
      else if (frameState.routeLegs.length && !request.reduceMotion) {
        const sample = catMotionSample(frameState.routeLegs, frameState.elapsed);
        frameState.position = sample.position;
        walking = sample.kind === 'walk' && !sample.animation && frameState.elapsed < frameState.routeDuration;
        hopPhase = sample.kind === 'hop' ? sample.progress : undefined;
        turnPhase = sample.kind === 'turn' ? sample.progress : undefined;
        routeAnimation = sample.kind === 'turn' ? sample.animation === 'jumpOff' ? 'sit' : 'turn' : sample.animation;
        lookAhead = sample.ahead;
        if (sample.kind === 'turn' && routeAnimation !== 'sit') {
          if (frameState.turnLeg !== sample.index) {
            frameState.turnLeg = sample.index;
            frameState.turnFrom = frameState.heading;
            const facing = Math.atan2(sample.ahead[0] - sample.position[0], sample.ahead[2] - sample.position[2]);
            frameState.turnAngle = Math.atan2(Math.sin(facing - frameState.heading), Math.cos(facing - frameState.heading));
            frameState.turnFeet = [];
            frameState.turnNeutral = [];
          }
          frameState.heading = frameState.turnFrom + catTurnPose(frameState.turnAngle, sample.progress).heading;
        }
      }
      else if (journey.jump) {
        const t = Math.max(0, Math.min(1, (frameState.elapsed / journey.duration - .20) / .50));
        const first = path[0], last = path[path.length - 1];
        frameState.position = catJumpPoint(first, last, t, .35 * scale);
      }
      else if (path.length > 1) {
        walking = frameState.elapsed < frameState.routeDuration;
        const progress = catTravelProgress(frameState.elapsed, frameState.routeDuration);
        lookAhead = catPathPoint(path, catTravelProgress(frameState.elapsed + .10, frameState.routeDuration), frameState.routePaces);
        frameState.position = catPathPoint(path, progress, frameState.routePaces);
      }
      else
        frameState.position = [path[0][0], path[0][1], path[0][2]];
    }
    const moved = Math.hypot(frameState.position[0] - previousPosition[0], frameState.position[2] - previousPosition[2]);
    frameState.distance += moved;
    const aheadDistance = lookAhead ? Math.hypot(lookAhead[0] - frameState.position[0], lookAhead[2] - frameState.position[2]) : 0;
    const desiredHeading = lookAhead && aheadDistance > .015 * scale
      ? Math.atan2(lookAhead[0] - frameState.position[0], lookAhead[2] - frameState.position[2])
      : moved > .0001 ? Math.atan2(frameState.position[0] - previousPosition[0], frameState.position[2] - previousPosition[2]) : journey?.heading ?? frameState.heading;
    const turn = Math.atan2(Math.sin(desiredHeading - frameState.heading), Math.cos(desiredHeading - frameState.heading));
    const steppingTurn = turnPhase !== undefined && routeAnimation !== 'sit';
    if (!turning && !steppingTurn) frameState.heading += Math.max(-deltaSeconds * 6, Math.min(deltaSeconds * 6, turn * (1 - Math.exp(-deltaSeconds * 14))));
    const perched = journey?.treePlay && !journey.jump && frameState.position[1] > FLOOR_Y + .1;
    const walkClip = journey?.bed && journey.bed.phase !== 'covered' ? 'crawl' : 'walk';
    const arrivedWalk = !!journey && !journey.jump && frameState.routePath.length > 1
      && frameState.elapsed >= frameState.routeDuration && segment.name === 'walk';
    const clipName = arrivedWalk ? journey.bed ? 'crawl' : 'idle' : routeAnimation ?? (turnPhase !== undefined ? 'turn' : hopPhase !== undefined ? 'hop' : walking ? walkClip : perched && segment.name === 'batToy' ? 'sit' : segment.name);
    const clip = clips[steppingTurn ? 'idle' : clipName] ?? clips.idle;
    if (!clip)
      return;
    let time = turnPhase !== undefined ? turnPhase * clip.duration : hopPhase !== undefined ? hopPhase * clip.duration : routeAnimation === 'sit' ? frameState.elapsed % clip.duration : walking ? (frameState.distance / (.8 * scale) % 1) * clip.duration
      : Math.min(segment.duration, segment.loop ? frameState.elapsed % segment.duration : frameState.elapsed) / segment.duration * clip.duration;
    if (arrivedWalk) time = journey.bed ? frameState.clipTime : (frameState.elapsed - frameState.routeDuration) % clip.duration;
    if (segment.reverse)
      time = clip.duration - time;
    if (request.reduceMotion)
      time = clip.duration * .25;
    if (steppingTurn) time = 0;
    if (clip.index !== frameState.clip) {
      frameState.previous = frameState.clip;
      frameState.previousTime = frameState.clipTime;
      frameState.previousLoop = frameState.clipLoop && !arrivedWalk;
      frameState.previousDuration = frameState.clipDuration;
      frameState.clip = clip.index;
      frameState.blend = 0;
    }
    frameState.clipTime = time;
    frameState.clipLoop = !steppingTurn && (arrivedWalk ? !journey.bed : walking || hopPhase === undefined && segment.loop);
    frameState.clipDuration = clip.duration;
    if (animationTimeValue)
      animationTimeValue.value = { name: clipName, time };
    frameState.blend = Math.min(1, frameState.blend + deltaSeconds / .12);
    if (steppingTurn && turningRig && !frameState.turnFeet.length) {
      // Retain the visible contacts, including an interrupted walk or turn.
      const head = transformManager.getWorldTransform(turningRig.head).data;
      const headYaw = Math.atan2(head[8], head[10]) - frameState.turnFrom;
      frameState.turnHead = Math.atan2(Math.sin(headYaw), Math.cos(headYaw));
      frameState.turnSpineHeight = (transformManager.getWorldTransform(turningRig.spine).translation[1] - frameState.position[1]) / scale;
      frameState.turnInitialSoles = turningRig.legs.map(leg => {
        const m = transformManager.getWorldTransform(leg.paw).data;
        const c = Math.cos(frameState.turnFrom), s = Math.sin(frameState.turnFrom);
        return [0, 1, 2].flatMap(k => [m[k * 4] * c - m[k * 4 + 2] * s, m[k * 4 + 1], m[k * 4 + 2] * c + m[k * 4] * s]);
      });
      frameState.turnFeet = turningRig.legs.map(leg => {
        const p = transformManager.getWorldTransform(leg.paw).translation;
        const x = (p[0] - frameState.position[0]) / scale, z = (p[2] - frameState.position[2]) / scale;
        const c = Math.cos(frameState.turnFrom), s = Math.sin(frameState.turnFrom);
        return [x * c - z * s, (p[1] - frameState.position[1]) / scale, z * c + x * s] as Vec3;
      });
    }
    // A neutral standing pose supplies the bones; the signed IK turn below
    // controls every contact instead of replaying the same forward shuffle.
    animator.applyAnimation(clip.index, time);
    if (!steppingTurn && frameState.previous >= 0 && frameState.blend < 1) {
      // Keep the outgoing pose moving while blending instead of freezing a paw mid-stride.
      if (frameState.previousLoop) frameState.previousTime = (frameState.previousTime + deltaSeconds) % frameState.previousDuration;
      animator.applyCrossFade(frameState.previous, frameState.previousTime, frameState.blend);
    }
    let transform = transformManager.createIdentityMatrix().scaling([scale, scale, scale]).rotate(frameState.heading, [0, 1, 0]).translate(frameState.position);
    const motion = rockingMotion?.value;
    const contact = request.reduceMotion ? 0 : rockingChairContact(request.travel, frameState.elapsed);
    if (contact > 0 && motion?.chair && motion.chair.instanceId === request.travel?.rockingChair?.instanceId) {
      const chair = motion.chair;
      transform = transform.translate(chair.pivot.map(v => -v) as Vec3).rotate(motion.angle * contact, chair.axis)
        .translate([chair.pivot[0], chair.pivot[1] + motion.lift * contact, chair.pivot[2]]);
    }
    transformManager.setTransform(entity, transform);
    if (steppingTurn && turningRig && turnPhase !== undefined && !request.reduceMotion) {
      if (!frameState.turnNeutral.length) {
        const c = Math.cos(frameState.heading), s = Math.sin(frameState.heading);
        frameState.turnSoles = turningRig.legs.map(leg => {
          const m = transformManager.getWorldTransform(leg.paw).data;
          return [0, 1, 2].flatMap(k => [m[k * 4] * c - m[k * 4 + 2] * s, m[k * 4 + 1], m[k * 4 + 2] * c + m[k * 4] * s]);
        });
        frameState.turnNeutral = turningRig.legs.map(leg => {
          const p = transformManager.getWorldTransform(leg.paw).translation;
          const x = (p[0] - frameState.position[0]) / scale, z = (p[2] - frameState.position[2]) / scale;
          return [x * c - z * s, (p[1] - frameState.position[1]) / scale, z * c + x * s] as Vec3;
        });
        const neutralHeight = (transformManager.getWorldTransform(turningRig.spine).translation[1] - frameState.position[1]) / scale;
        frameState.turnCrouch = Math.max(0, Math.min(.3, neutralHeight - frameState.turnSpineHeight));
      }
      const turnPose = catTurnPose(frameState.turnAngle, turnPhase, frameState.turnHead, frameState.turnCrouch);
      const spineLocal = transformManager.getTransform(turningRig.spine);
      transformManager.setTransform(turningRig.spine, spineLocal.translate([0, -turnPose.crouch, 0]));
      const headAngle = turnPose.head;
      const headLocal = transformManager.getTransform(turningRig.head), headOrigin = headLocal.translation;
      transformManager.setTransform(turningRig.head, headLocal.translate(headOrigin.map(v => -v) as Vec3)
        .rotate(headAngle, tailParentAxis([0, 1, 0], transformManager.getWorldTransform(turningRig.neck).data)).translate(headOrigin));
      for (let i = 0; i < turningRig.legs.length; i++) {
        const leg = turningRig.legs[i];
        const target = catTurnPaw(frameState.turnNeutral[i], frameState.turnFeet[i], frameState.turnAngle, turnPhase, i);
        const c = Math.cos(frameState.turnFrom), s = Math.sin(frameState.turnFrom);
        const reach: Vec3 = [frameState.position[0] + (target[0] * c + target[2] * s) * scale,
          frameState.position[1] + target[1] * scale, frameState.position[2] + (target[2] * c - target[0] * s) * scale];
        const shoulder = transformManager.getWorldTransform(leg.upper).translation;
        const elbow = transformManager.getWorldTransform(leg.lower).translation;
        const paw = transformManager.getWorldTransform(leg.paw).translation;
        const knee = reachingElbow(shoulder, elbow, paw, reach, frameState.heading + (leg.rear ? Math.PI : 0));
        const aim = limbAim(elbow.map((v, k) => v - shoulder[k]) as Vec3, knee.map((v, k) => v - shoulder[k]) as Vec3);
        const local = transformManager.getTransform(leg.upper), origin = local.translation;
        transformManager.setTransform(leg.upper, local.translate(origin.map(v => -v) as Vec3)
          .rotate(aim.angle, tailParentAxis(aim.axis, transformManager.getWorldTransform(leg.parent).data)).translate(origin));
        const movedElbow = transformManager.getWorldTransform(leg.lower).translation;
        const movedPaw = transformManager.getWorldTransform(leg.paw).translation;
        const lowerAim = limbAim(movedPaw.map((v, k) => v - movedElbow[k]) as Vec3, reach.map((v, k) => v - movedElbow[k]) as Vec3);
        const lower = transformManager.getTransform(leg.lower), lowerOrigin = lower.translation;
        transformManager.setTransform(leg.lower, lower.translate(lowerOrigin.map(v => -v) as Vec3)
          .rotate(lowerAim.angle, tailParentAxis(lowerAim.axis, transformManager.getWorldTransform(leg.upper).data)).translate(lowerOrigin));
        // The ankle counter-rotates the shin: planted soles stay flat and
        // retain their heading until that paw lifts for its next placement.
        const orientation = catTurnPawOrientation(frameState.turnAngle, turnPhase, i);
        const soleHeading = frameState.turnFrom + orientation.heading;
        const sc = Math.cos(soleHeading), ss = Math.sin(soleHeading), sole = frameState.turnSoles[i];
        for (const axis of [1, 0]) {
          const m = transformManager.getWorldTransform(leg.paw).data;
          const start = axis * 3, column = axis * 4;
          const desired: Vec3 = [sole[start] * sc + sole[start + 2] * ss, sole[start + 1], sole[start + 2] * sc - sole[start] * ss];
          const initial = frameState.turnInitialSoles[i];
          const original: Vec3 = [initial[start] * c + initial[start + 2] * s, initial[start + 1], initial[start + 2] * c - initial[start] * s];
          const neutral: Vec3 = [sole[start] * c + sole[start + 2] * s, sole[start + 1], sole[start + 2] * c - sole[start] * s];
          for (let k = 0; k < 3; k++) desired[k] += (original[k] - neutral[k]) * (1 - orientation.settled);
          const aim = limbAim([m[column], m[column + 1], m[column + 2]], desired);
          const local = transformManager.getTransform(leg.paw), origin = local.translation;
          transformManager.setTransform(leg.paw, local.translate(origin.map(v => -v) as Vec3)
            .rotate(aim.angle, tailParentAxis(aim.axis, transformManager.getWorldTransform(leg.lower).data)).translate(origin));
        }
      }
    }
    else if (walking && turningRig && !request.reduceMotion) {
      // Lead a rounded walking corner with the gaze, rather than swivelling
      // the entire cat as a single rigid shape.
      const local = transformManager.getTransform(turningRig.head), origin = local.translation;
      const angle = Math.max(-.32, Math.min(.32, turn));
      transformManager.setTransform(turningRig.head, local.translate(origin.map(v => -v) as Vec3)
        .rotate(angle, tailParentAxis([0, 1, 0], transformManager.getWorldTransform(turningRig.neck).data)).translate(origin));
    }
    let renderedPosition = frameState.position;
    if (request.rugSurfaces?.length && supportingPaws.length) {
      const paws = supportingPaws.map(paw => transformManager.getWorldTransform(paw).translation);
      const lift = rugSupportLift(frameState.position, paws, request.rugSurfaces, scale);
      if (lift > 0) {
        transformManager.setTransform(entity, transform.translate([0, lift, 0]));
        renderedPosition = [frameState.position[0], frameState.position[1] + lift, frameState.position[2]];
      }
    }
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
      const bathroom = journey?.bathroom;
      const contactWorld = bathroom && ['enter', 'wash', 'use', 'exit'].includes(bathroom.phase)
        ? { ...request.world, objects: request.world.objects.filter(object => object.instanceId !== bathroom.instanceId) } : request.world;
      frameState.tailContact = resolveTailContact(points, contactWorld, frameState.tailContact, deltaSeconds);
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
      const point = catScreenPoint(renderedPosition, request.world);
      // Navigation and arrival use the logical route height, independently of
      // the small rendering correction for a rug's thickness.
      notify('position', [point.x, point.y, ...frameState.position, frameState.elapsed]);
    }
    if (positionValue)
      positionValue.value = renderedPosition;
    if (!frameState.ready) {
      frameState.ready = true;
      notify('ready', 0);
    }
    if (request.activityKey && request.travel?.awaitCompletion && !frameState.roomComplete
      && frameState.elapsed >= (request.reduceMotion ? .6 : frameState.routeDuration)
      && hasNativeArrived(frameState.position, request.travel.path[request.travel.path.length - 1])) {
      frameState.roomComplete = true;
      notify('roomComplete', { key: request.activityKey, position: [frameState.position[0], frameState.position[1], frameState.position[2]] });
    }
    state.value = frameState;
  }, [animationTimeValue, animator, clips, command, eatingProps, entity, frontLegs, hangingBall, initialPosition, notify, pawPositions, plantLeaf, positionValue, rockingMotion, state, supportingPaws, tail, transformManager, turningRig]);
  RenderCallbackContext.useRenderCallback(render, [render]);
  return null;
}
