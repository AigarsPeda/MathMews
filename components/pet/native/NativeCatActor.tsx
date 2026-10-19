/* eslint-disable react-hooks/immutability */
/* Native asset requires are statically resolved by Metro. */
/* eslint-disable @typescript-eslint/no-require-imports */
import { rockingChairContact, type RockingMotion } from '@/utils/native-rocking-chair';
import { catJumpPoint, catJumpAim, catMotionSample, CAT_LANDING_WALK_PHASE, CAT_JUMP_TAKEOFF, CAT_JUMP_TOUCHDOWN, catPathFromPosition, catPathPoint, catTravelProgress, type CatMotionLeg } from '@/utils/native-cat-locomotion';
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
import { CAT_GAITS, catSpeedGait, catGaitContact, catGaitSwing, type CatGait } from '@/utils/native-cat-gaits';
import { catLaunchPaw, catLaunchSpine, catLaunchStep } from '@/utils/native-cat-walk-launch';
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
    position: (initialPosition ?? world?.home ?? [0, 0, 0]) as Vec3, home: (world?.home ?? [0, 0, 0]) as Vec3, routeStart: (world?.home ?? [0, 0, 0]) as Vec3, report: 0, ready: false, clip: -1, clipTime: 0, previous: -1, previousTime: 0, blend: 1, blendSeconds: .12,
    clipLoop: false, previousLoop: false, clipDuration: 1, previousDuration: 1,
    routePath: [] as Vec3[], routePaces: [] as number[], routeLegs: [] as CatMotionLeg[], routeDuration: 0, routeRamp: .18,
    sourcePath: [] as Vec3[], sourceDuration: 0, sourceJump: false, jumpPhase: 0, jumpOffset: 0, jumpDuration: 0, jumpArcHeight: 0, jumpFrom: [0, 0, 0] as Vec3,
    turnElapsed: 0, turnDuration: 0, turnFrom: 0, turnAngle: 0,
    turnFeet: [] as Vec3[], turnNeutral: [] as Vec3[], turnLeg: -1,
    turnSoles: [] as number[][], turnHead: 0, turnSpineHeight: 0, turnCrouch: 0,
    turnInitialSoles: [] as number[][],
    turnOverlap: 0, launchStarted: false, launchFeet: [] as Vec3[], launchSoles: [] as number[][],
    landingPending: false, launchFromLanding: false, launchDistance: 0, launchStride: .8, launchPhase: 0, launchHeight: 0, walkStride: .8, walkOffset: 0,
    gait: 'walk' as CatGait, gaitSpeed: 0, gaitContacts: [] as (Vec3 | null)[],
    gaitSwings: [] as ({ from: Vec3; elapsed: number } | null)[],
    supportLift: 0,
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
        frameState.landingPending = false;
        frameState.launchFromLanding = false;
        frameState.turnElapsed = 0;
        frameState.turnDuration = 0;
        frameState.turnFeet = [];
        frameState.turnNeutral = [];
        frameState.turnLeg = -1;
        frameState.turnOverlap = 0;
        frameState.launchStarted = false;
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
          frameState.turnOverlap = 0;
          frameState.launchStarted = false;
          frameState.launchFromLanding = false;
          if (journey.jump || !request.segments[0]?.name.startsWith('walk')) frameState.landingPending = false;
          const phase = frameState.distance / (frameState.walkStride * (request.world?.catScale ?? 1)) + frameState.walkOffset;
          frameState.walkStride = .8;
          frameState.walkOffset = phase - frameState.distance / (.8 * (request.world?.catScale ?? 1));
          const continuingJump = journey.jump && frameState.sourceJump && frameState.jumpPhase > CAT_JUMP_TAKEOFF && frameState.jumpPhase < 1
            && frameState.sourcePath.length > 1 && journey.path.length > 1
            && Math.hypot(...journey.path[journey.path.length-1].map((v,k)=>v-frameState.sourcePath[frameState.sourcePath.length-1][k])) < .001;
          frameState.jumpOffset = continuingJump ? frameState.jumpPhase : 0;
          if (journey.jump && !continuingJump) {
            frameState.jumpFrom = frameState.ready && !journey.elapsed ? frameState.position : journey.path[0];
            frameState.jumpDuration = journey.duration;
            frameState.jumpArcHeight = journey.arcHeight ?? .35*(request.world?.catScale ?? 1);
          }
          frameState.jumpPhase = frameState.jumpOffset;
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
          frameState.routeDuration = continuingJump ? Math.max(.08,(1-frameState.jumpOffset)*frameState.jumpDuration) : journey.duration;
          frameState.routeRamp = journey.ramp ?? .18;
          frameState.gaitContacts = [];
          frameState.gaitSwings = [];
          if (rebase && route.path.length > 1) {
            const ramp = floorLeg?.ramp ?? journey.ramp ?? .18;
            const duration = Math.max(.18, ((floorLeg?.duration ?? journey.duration) - ramp) * route.fraction + ramp);
            if (floorLeg) {
              const legs: CatMotionLeg[] = [{ ...floorLeg, path: route.path, paces: route.paces, duration }];
              for (let i = 1; i < journey.legs!.length; i++) legs.push(journey.legs![i]);
              frameState.routeLegs = legs;
              frameState.routeDuration += duration - floorLeg.duration;
            } else frameState.routeDuration = duration;
          }
          if (!frameState.ready || request.reduceMotion) frameState.position = [journey.path[0][0], journey.path[0][1], journey.path[0][2]];
          frameState.routeStart = frameState.position;
          if (request.reduceMotion && journey.heading !== undefined && journey.path.length === 1) frameState.heading = journey.heading;
          if (floorStart && !journey.elapsed && !request.reduceMotion) {
            let next: Vec3 | undefined = journey.jump ? route.path[route.path.length-1] : undefined;
            for (let i = 0; !journey.jump && i < route.path.length; i++) {
              const point = route.path[i];
              if (Math.hypot(point[0] - frameState.position[0], point[2] - frameState.position[2]) > .01) { next = point; break; }
            }
            const facing = next ? Math.atan2(next[0] - frameState.position[0], next[2] - frameState.position[2])
              : journey.heading;
            if (facing !== undefined) {
              const angle = Math.atan2(Math.sin(facing - frameState.heading), Math.cos(facing - frameState.heading));
              if (!frameState.ready) frameState.heading = facing;
              else if (Math.abs(angle) > .35) {
                frameState.landingPending = false;
                frameState.turnFrom = frameState.heading;
                frameState.turnAngle = angle;
                frameState.turnDuration = catTurnDuration(angle);
                if (next && !journey.bed && !journey.jump) {
                  frameState.turnOverlap = Math.min(.20, frameState.turnDuration * .14, (floorLeg?.duration ?? journey.duration) * .4);
                  let distance = 0;
                  for (let i = 1; i < route.path.length; i++) distance += Math.hypot(...route.path[i].map((v, k) => v - route.path[i - 1][k]));
                  // Small journeys use smaller first steps, rather than a
                  // full stride that would overshoot their destination.
                  frameState.walkStride = Math.min(.8, distance / ((request.world?.catScale ?? 1) * 1.1));
                }
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
    const turnRemaining = frameState.turnDuration - frameState.turnOverlap - frameState.turnElapsed;
    if (turning) {
      frameState.turnElapsed = Math.min(frameState.turnDuration, frameState.turnElapsed + deltaSeconds);
      const t = frameState.turnElapsed / frameState.turnDuration;
      frameState.heading = frameState.turnFrom + catTurnPose(frameState.turnAngle, t).heading;
    }
    frameState.elapsed += turning ? Math.min(deltaSeconds, Math.max(0, deltaSeconds - turnRemaining)) : deltaSeconds;
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
    let maximumGait = journey?.gait ?? 'walk';
    let hopPhase: number | undefined;
    let jumpHeading: number | undefined;
    let jumpLook = 0;
    let turnPhase: number | undefined;
    let routeAnimation: string | undefined;
    let lookAhead: Vec3 | undefined;
    if (journey?.path.length) {
      // Shared arrays do not expose slice in Filament's Worklets Core runtime.
      const path = frameState.routePath;
      if (turning && frameState.elapsed <= 0) {
        frameState.position = frameState.routeStart;
        turnPhase = frameState.turnElapsed / frameState.turnDuration;
      }
      else if (frameState.routeLegs.length && !request.reduceMotion) {
        const sample = catMotionSample(frameState.routeLegs, frameState.elapsed);
        frameState.position = sample.position;
        walking = sample.kind === 'walk' && !sample.animation && frameState.elapsed < frameState.routeDuration;
        hopPhase = sample.kind === 'hop' ? sample.progress : undefined;
        turnPhase = sample.kind === 'turn' ? sample.progress : undefined;
        routeAnimation = sample.kind === 'turn' ? 'turn' : sample.animation;
        if (sample.kind === 'hop') { jumpHeading = sample.heading; frameState.jumpDuration = sample.actionDuration; }
        lookAhead = sample.ahead;
        maximumGait = sample.gait ?? maximumGait;
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
        hopPhase = frameState.jumpOffset+(1-frameState.jumpOffset)*Math.max(0,Math.min(1,frameState.elapsed / frameState.routeDuration));
        frameState.jumpPhase = hopPhase;
        routeAnimation = segment.name;
        const t = Math.max(0, Math.min(1, (hopPhase - CAT_JUMP_TAKEOFF) / (CAT_JUMP_TOUCHDOWN - CAT_JUMP_TAKEOFF)));
        const first = frameState.jumpFrom, last = path[path.length - 1];
        const aim=catJumpAim(first,last,t,journey.landingHeading);
        jumpHeading = aim.heading;jumpLook=aim.headTurn;
        frameState.position = catJumpPoint(first, last, t, frameState.jumpArcHeight, true);
      }
      else if (path.length > 1) {
        walking = frameState.elapsed < frameState.routeDuration;
        const progress = catTravelProgress(frameState.elapsed, frameState.routeDuration, frameState.routeRamp);
        lookAhead = catPathPoint(path, catTravelProgress(frameState.elapsed + .10, frameState.routeDuration, frameState.routeRamp), frameState.routePaces);
        frameState.position = catPathPoint(path, progress, frameState.routePaces);
      }
      else
        frameState.position = [path[0][0], path[0][1], path[0][2]];
      if (turning) turnPhase = frameState.turnElapsed / frameState.turnDuration;
    }
    const moved = Math.hypot(frameState.position[0] - previousPosition[0], frameState.position[2] - previousPosition[2]);
    frameState.distance += moved;
    const aheadDistance = lookAhead ? Math.hypot(lookAhead[0] - frameState.position[0], lookAhead[2] - frameState.position[2]) : 0;
    // Flight and impact keep their launch heading. Resting orientation is a
    // separate, supported turn in the following activity step.
    const desiredHeading = jumpHeading ?? (lookAhead && aheadDistance > .015 * scale
      ? Math.atan2(lookAhead[0] - frameState.position[0], lookAhead[2] - frameState.position[2])
      : moved > .0001 ? Math.atan2(frameState.position[0] - previousPosition[0], frameState.position[2] - previousPosition[2]) : journey?.heading ?? frameState.heading);
    const turn = Math.atan2(Math.sin(desiredHeading - frameState.heading), Math.cos(desiredHeading - frameState.heading));
    const steppingTurn = turnPhase !== undefined && routeAnimation !== 'sit';
    if (!turning && jumpHeading !== undefined) frameState.heading = jumpHeading;
    else if (!turning && !steppingTurn) frameState.heading += Math.max(-deltaSeconds * 6, Math.min(deltaSeconds * 6, turn * (1 - Math.exp(-deltaSeconds * 14))));
    const perched = journey?.treePlay && !journey.jump && frameState.position[1] > FLOOR_Y + .1;
    const crawling = !!journey?.bed && journey.bed.phase !== 'covered';
    const arrivedWalk = !!journey && !journey.jump && frameState.routePath.length > 1
      && frameState.elapsed >= frameState.routeDuration && segment.name === 'walk';
    if (frameState.launchStarted && hopPhase !== undefined) {
      const phase = frameState.distance / (frameState.walkStride * scale) + frameState.walkOffset;
      frameState.walkStride = .8;
      frameState.walkOffset = phase - frameState.distance / (.8 * scale);
      frameState.launchStarted = false;
      frameState.turnOverlap = 0;
    }
    if (hopPhase !== undefined) frameState.landingPending = hopPhase >= CAT_JUMP_TOUCHDOWN;
    const landingCapture = walking && frameState.landingPending && !turning && !steppingTurn && !frameState.launchStarted && !request.reduceMotion;
    if (walking && (frameState.turnOverlap > 0 || landingCapture) && !frameState.launchStarted && turningRig) {
      if (landingCapture) {
        frameState.turnFrom = frameState.heading;
        frameState.turnAngle = 0;
        frameState.turnFeet = [];
        frameState.turnNeutral = [];
        const end = frameState.routePath[frameState.routePath.length-1];
        frameState.walkStride = Math.min(.8,Math.max(.05,Math.hypot(...end.map((v,k)=>v-frameState.position[k]))/(scale*1.1)));
      }
      frameState.launchFromLanding = landingCapture;
      frameState.landingPending = false;
      frameState.launchStarted = true;
      frameState.launchFeet = turningRig.legs.map(leg => {
        const p = transformManager.getWorldTransform(leg.paw).translation;
        return [p[0], p[1] - frameState.supportLift, p[2]] as Vec3;
      });
      frameState.launchSoles = turningRig.legs.map(leg => transformManager.getWorldTransform(leg.paw).data);
      frameState.launchHeight = (transformManager.getWorldTransform(turningRig.spine).translation[1] - frameState.supportLift - previousPosition[1]) / scale;
      frameState.launchDistance = frameState.distance - moved;
      frameState.launchStride = frameState.walkStride;
      // Continue the last turning hind-paw step into the first forward step.
      frameState.launchPhase = frameState.turnAngle > 0 ? .60 : .10;
      frameState.walkOffset = frameState.launchPhase - frameState.launchDistance / (frameState.walkStride * scale);
    }
    const launchProgress = (frameState.distance - frameState.launchDistance) / (frameState.launchStride * scale);
    const launching = frameState.launchStarted && walking && launchProgress < .90;
    const strideCorrection = frameState.launchStarted && frameState.walkStride < .8
      && (walking || arrivedWalk && frameState.elapsed - frameState.routeDuration < .12);
    const posingFeet = steppingTurn || launching || strideCorrection;
    const rawSpeed = walking && deltaSeconds > 0 ? moved / (deltaSeconds * scale) : 0;
    frameState.gaitSpeed += (rawSpeed - frameState.gaitSpeed) * (1 - Math.exp(-deltaSeconds * 12));
    const nextGait = walking && !crawling && !posingFeet && !request.reduceMotion
      ? catSpeedGait(frameState.gaitSpeed, frameState.gait, maximumGait) : 'walk';
    const gait = clips[nextGait] ? nextGait : 'walk';
    if (gait !== frameState.gait) {
      const phase = frameState.distance / (frameState.walkStride * scale) + frameState.walkOffset;
      frameState.walkStride = CAT_GAITS[gait].stride;
      frameState.walkOffset = phase - frameState.distance / (frameState.walkStride * scale);
      frameState.gait = gait;
    }
    const walkClip = crawling ? 'crawl' : frameState.gait;
    const clipName = arrivedWalk ? journey.bed ? 'crawl' : 'idle' : walking && frameState.launchStarted ? walkClip : routeAnimation ?? (turnPhase !== undefined ? 'turn' : hopPhase !== undefined ? 'hop' : walking ? walkClip : perched && segment.name === 'batToy' ? 'sit' : segment.name);
    const clip = clips[walking && frameState.launchStarted ? walkClip : steppingTurn ? 'idle' : clipName] ?? clips.idle;
    if (!clip)
      return;
    let time = walking ? ((frameState.distance / (frameState.walkStride * scale) + frameState.walkOffset) % 1 + 1) % 1 * clip.duration : turnPhase !== undefined ? turnPhase * clip.duration : hopPhase !== undefined ? hopPhase * clip.duration : routeAnimation === 'sit' ? frameState.elapsed % clip.duration
      : Math.min(segment.duration, segment.loop ? frameState.elapsed % segment.duration : frameState.elapsed) / segment.duration * clip.duration;
    // Retain the departure-ready contacts while JS dispatches the queued walk,
    // rather than standing up and stretching the planted hind legs first.
    if (journey?.jump && journey.walkAfterLanding && hopPhase !== undefined && hopPhase > CAT_LANDING_WALK_PHASE)
      time = CAT_LANDING_WALK_PHASE * clip.duration;
    if (arrivedWalk) time = journey.bed ? frameState.clipTime : (frameState.elapsed - frameState.routeDuration) % clip.duration;
    if (segment.reverse)
      time = clip.duration - time;
    if (request.reduceMotion)
      time = hopPhase !== undefined ? hopPhase >= CAT_JUMP_TOUCHDOWN ? clip.duration : 0 : clip.duration * .25;
    if (steppingTurn && !walking) time = 0;
    if (clip.index !== frameState.clip) {
      frameState.previous = frameState.clip;
      frameState.previousTime = frameState.clipTime;
      frameState.previousLoop = frameState.clipLoop && !arrivedWalk;
      frameState.previousDuration = frameState.clipDuration;
      frameState.clip = clip.index;
      frameState.blend = 0;
      frameState.blendSeconds = walking && [clips.walk?.index,clips.trot?.index,clips.run?.index].includes(frameState.previous) ? .22 : .12;
    }
    frameState.clipTime = time;
    frameState.clipLoop = (!steppingTurn || walking) && (arrivedWalk ? !journey.bed : walking || hopPhase === undefined && segment.loop);
    frameState.clipDuration = clip.duration;
    if (animationTimeValue)
      animationTimeValue.value = { name: clipName, time };
    frameState.blend = Math.min(1, frameState.blend + deltaSeconds / frameState.blendSeconds);
    if ((steppingTurn || landingCapture) && turningRig && !frameState.turnFeet.length) {
      // Retain the visible contacts, including an interrupted walk or turn.
      const head = transformManager.getWorldTransform(turningRig.head).data;
      const headYaw = Math.atan2(head[8], head[10]) - frameState.turnFrom;
      frameState.turnHead = Math.atan2(Math.sin(headYaw), Math.cos(headYaw));
      frameState.turnSpineHeight = (transformManager.getWorldTransform(turningRig.spine).translation[1] - frameState.supportLift - frameState.position[1]) / scale;
      frameState.turnInitialSoles = turningRig.legs.map(leg => {
        const m = transformManager.getWorldTransform(leg.paw).data;
        const c = Math.cos(frameState.turnFrom), s = Math.sin(frameState.turnFrom);
        return [0, 1, 2].flatMap(k => [m[k * 4] * c - m[k * 4 + 2] * s, m[k * 4 + 1], m[k * 4 + 2] * c + m[k * 4] * s]);
      });
      frameState.turnFeet = turningRig.legs.map(leg => {
        const p = transformManager.getWorldTransform(leg.paw).translation;
        const x = (p[0] - frameState.position[0]) / scale, z = (p[2] - frameState.position[2]) / scale;
        const c = Math.cos(frameState.turnFrom), s = Math.sin(frameState.turnFrom);
        return [x * c - z * s, (p[1] - frameState.supportLift - frameState.position[1]) / scale, z * c + x * s] as Vec3;
      });
    }
    // The turn starts from standing, then uses the distance-driven walk while
    // IK carries the actual foot contacts through the first forward steps.
    if (landingCapture && turningRig && clips.idle) {
      // First-step targets need the standing stance, not a sampled mid-stride
      // foot position. Otherwise a lifted paw overshoots and snaps at touchdown.
      animator.applyAnimation(clips.idle.index,0);
      const root = transformManager.getWorldTransform(entity).data;
      frameState.turnNeutral = turningRig.legs.map(leg => {
        const p = transformManager.getWorldTransform(leg.paw).translation;
        const delta = p.map((v,k)=>v-root[12+k]);
        return [0,1,2].map(axis => {
          const start = axis*4, squared = root[start]**2+root[start+1]**2+root[start+2]**2;
          return (delta[0]*root[start]+delta[1]*root[start+1]+delta[2]*root[start+2])/squared;
        }) as Vec3;
      });
      const c = Math.cos(frameState.turnFrom), s = Math.sin(frameState.turnFrom);
      frameState.turnSoles = turningRig.legs.map(leg => {
        const m = transformManager.getWorldTransform(leg.paw).data;
        return [0,1,2].flatMap(k=>[m[k*4]*c-m[k*4+2]*s,m[k*4+1],m[k*4+2]*c+m[k*4]*s]);
      });
      frameState.turnCrouch = 0;
    }
    animator.applyAnimation(clip.index, time);
    if ((!posingFeet || arrivedWalk || frameState.launchFromLanding && launching) && frameState.previous >= 0 && frameState.blend < 1) {
      // Keep the outgoing pose moving while blending instead of freezing a paw mid-stride.
      if (frameState.previousLoop) {
        const previousGait = frameState.previous === clips.run?.index ? 'run' : frameState.previous === clips.trot?.index ? 'trot' : frameState.previous === clips.walk?.index ? 'walk' : undefined;
        const advance = walking && previousGait ? moved/(CAT_GAITS[previousGait].stride*scale)*frameState.previousDuration : deltaSeconds;
        frameState.previousTime = (frameState.previousTime + advance) % frameState.previousDuration;
      }
      else if (frameState.launchFromLanding && launching) {
        frameState.previousTime = Math.min(frameState.previousDuration,frameState.previousTime+deltaSeconds*frameState.previousDuration/Math.max(.1,frameState.jumpDuration));
      }
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
    if (jumpLook && turningRig && !request.reduceMotion) {
      const local=transformManager.getTransform(turningRig.head),origin=local.translation;
      transformManager.setTransform(turningRig.head,local.translate(origin.map(v=>-v) as Vec3)
        .rotate(jumpLook,tailParentAxis([0,1,0],transformManager.getWorldTransform(turningRig.neck).data)).translate(origin));
    }
    // Small seats need the paws gathered beneath the body. Keep this same
    // stance in the support test and the rendered turn/push/landing poses.
    const phase = hopPhase ?? 0;
    const release = Math.max(0,Math.min(1,(phase-CAT_JUMP_TAKEOFF)/.15));
    const gather = Math.max(0,Math.min(1,(phase-(CAT_JUMP_TOUCHDOWN-.15))/.15));
    const stance = journey?.jump ? 1-(1-(journey.launchStance ?? 1))*(1-release*release*(3-2*release))
      -(1-(journey.stance ?? 1))*gather*gather*(3-2*gather) : journey?.stance ?? 1;
    const stanceWidth = journey?.jump ? 1-(1-(journey.launchStanceWidth ?? 1))*(1-release*release*(3-2*release))
      -(1-(journey.stanceWidth ?? 1))*gather*gather*(3-2*gather) : journey?.stanceWidth ?? 1;
    if ((stance < .999 || stanceWidth < .999) && turningRig) {
      const supportedPaws=turningRig.legs.map(leg=>{
        const paw=transformManager.getWorldTransform(leg.paw);
        return {translation:paw.translation,data:paw.data};
      });
      // Adducted legs need a little knee bend. Lower the torso while retaining
      // the original contact heights, instead of suspending the paw pads.
      const spine=transformManager.getTransform(turningRig.spine);
      transformManager.setTransform(turningRig.spine,spine.translate([0,-.06*(1-stance)-.08*(1-stanceWidth),0]));
      for(let i=0;i<turningRig.legs.length;i++) {
        const leg=turningRig.legs[i],paw=supportedPaws[i],sole=paw.data;
        const c=Math.cos(frameState.heading),s=Math.sin(frameState.heading);
        const forward=(paw.translation[0]-frameState.position[0])*s+(paw.translation[2]-frameState.position[2])*c;
        const sideways=(paw.translation[0]-frameState.position[0])*c-(paw.translation[2]-frameState.position[2])*s;
        const delta=forward*(stance-1);
        const lateral=sideways*(stanceWidth-1);
        const reach: Vec3=[paw.translation[0]+s*delta+c*lateral,paw.translation[1],paw.translation[2]+c*delta-s*lateral];
        const shoulder=transformManager.getWorldTransform(leg.upper).translation;
        const elbow=transformManager.getWorldTransform(leg.lower).translation;
        const currentPaw=transformManager.getWorldTransform(leg.paw).translation;
        const knee=reachingElbow(shoulder,elbow,currentPaw,reach,frameState.heading+(leg.rear?Math.PI:0));
        const aim=limbAim(elbow.map((v,k)=>v-shoulder[k]) as Vec3,knee.map((v,k)=>v-shoulder[k]) as Vec3);
        const upper=transformManager.getTransform(leg.upper),origin=upper.translation;
        transformManager.setTransform(leg.upper,upper.translate(origin.map(v=>-v) as Vec3)
          .rotate(aim.angle,tailParentAxis(aim.axis,transformManager.getWorldTransform(leg.parent).data)).translate(origin));
        const movedElbow=transformManager.getWorldTransform(leg.lower).translation,movedPaw=transformManager.getWorldTransform(leg.paw).translation;
        const lowerAim=limbAim(movedPaw.map((v,k)=>v-movedElbow[k]) as Vec3,reach.map((v,k)=>v-movedElbow[k]) as Vec3);
        const lower=transformManager.getTransform(leg.lower),lowerOrigin=lower.translation;
        transformManager.setTransform(leg.lower,lower.translate(lowerOrigin.map(v=>-v) as Vec3)
          .rotate(lowerAim.angle,tailParentAxis(lowerAim.axis,transformManager.getWorldTransform(leg.upper).data)).translate(lowerOrigin));
        for (const axis of [1,0]) {
          const now=transformManager.getWorldTransform(leg.paw).data,k=axis*4;
          const restore=limbAim([now[k],now[k+1],now[k+2]],[sole[k],sole[k+1],sole[k+2]]);
          const local=transformManager.getTransform(leg.paw),origin=local.translation;
          transformManager.setTransform(leg.paw,local.translate(origin.map(v=>-v) as Vec3)
            .rotate(restore.angle,tailParentAxis(restore.axis,transformManager.getWorldTransform(leg.lower).data)).translate(origin));
        }
      }
    }
    if (posingFeet && turningRig && !request.reduceMotion) {
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
      const walkPaws = turningRig.legs.map((leg, i) => {
        const p = transformManager.getWorldTransform(leg.paw).translation;
        if (!strideCorrection) return p;
        const c = Math.cos(frameState.heading), s = Math.sin(frameState.heading);
        const forward = ((p[0] - frameState.position[0]) * s + (p[2] - frameState.position[2]) * c) / scale;
        const delta = (forward - frameState.turnNeutral[i][2]) * (frameState.walkStride / .8 - 1) * scale;
        return [p[0] + s * delta, p[1], p[2] + c * delta] as Vec3;
      });
      const walkSoles = turningRig.legs.map(leg => transformManager.getWorldTransform(leg.paw).data);
      const turnPose = catTurnPose(frameState.turnAngle, turnPhase ?? 1, frameState.turnHead, frameState.turnCrouch);
      const spineLocal = transformManager.getTransform(turningRig.spine);
      const walkHeight = (transformManager.getWorldTransform(turningRig.spine).translation[1] - frameState.position[1]) / scale;
      const spineShift = launching ? catLaunchSpine(frameState.launchHeight, walkHeight, launchProgress, frameState.walkStride, frameState.launchFromLanding)
        : walking ? 0 : -turnPose.crouch;
      transformManager.setTransform(turningRig.spine, spineLocal.translate([0, spineShift, 0]));
      if(launching && frameState.launchFromLanding) {
        // Keep recovering shoulders/hips within reach of feet that have not
        // lifted yet. A tiny contact correction avoids pulling those pads
        // along the floor as the independent impact poses blend into a walk.
        let drop=0;
        for(let i=0;i<turningRig.legs.length;i++) {
          if(catLaunchStep(frameState.launchPhase,launchProgress,i).progress>0)continue;
          const leg=turningRig.legs[i],a=transformManager.getWorldTransform(leg.upper).translation;
          const b=transformManager.getWorldTransform(leg.lower).translation,p=transformManager.getWorldTransform(leg.paw).translation;
          const target=frameState.launchFeet[i],length=Math.hypot(...a.map((v,k)=>v-b[k]))+Math.hypot(...b.map((v,k)=>v-p[k]))-.001;
          const vertical=Math.sqrt(Math.max(0,length*length-(a[0]-target[0])**2-(a[2]-target[2])**2));
          drop=Math.max(drop,a[1]-target[1]-vertical);
        }
        if(drop>0)transformManager.setTransform(turningRig.spine,transformManager.getTransform(turningRig.spine).translate([0,-Math.min(.01,drop/scale),0]));
      }
      const headAngle = turnPose.head;
      const headLocal = transformManager.getTransform(turningRig.head), headOrigin = headLocal.translation;
      transformManager.setTransform(turningRig.head, headLocal.translate(headOrigin.map(v => -v) as Vec3)
        .rotate(headAngle, tailParentAxis([0, 1, 0], transformManager.getWorldTransform(turningRig.neck).data)).translate(headOrigin));
      for (let i = 0; i < turningRig.legs.length; i++) {
        const leg = turningRig.legs[i];
        const target = catTurnPaw(frameState.turnNeutral[i], frameState.turnFeet[i], frameState.turnAngle, turnPhase ?? 1, i);
        const c = Math.cos(frameState.turnFrom), s = Math.sin(frameState.turnFrom);
        const reach: Vec3 = launching ? catLaunchPaw(frameState.launchFeet[i], frameState.turnNeutral[i], walkPaws[i], frameState.position,
          frameState.heading, scale, frameState.walkStride, frameState.launchPhase, launchProgress, i) : walking || strideCorrection ? walkPaws[i]
          : [frameState.position[0] + (target[0] * c + target[2] * s) * scale,
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
        const orientation = catTurnPawOrientation(frameState.turnAngle, turnPhase ?? 1, i);
        const soleHeading = frameState.turnFrom + orientation.heading;
        const sc = Math.cos(soleHeading), ss = Math.sin(soleHeading), sole = frameState.turnSoles[i];
        for (const axis of [1, 0]) {
          const m = transformManager.getWorldTransform(leg.paw).data;
          const start = axis * 3, column = axis * 4;
          const desired: Vec3 = walking || strideCorrection ? [walkSoles[i][column], walkSoles[i][column + 1], walkSoles[i][column + 2]]
            : [sole[start] * sc + sole[start + 2] * ss, sole[start + 1], sole[start + 2] * sc - sole[start] * ss];
          const initial = frameState.turnInitialSoles[i];
          const original: Vec3 = [initial[start] * c + initial[start + 2] * s, initial[start + 1], initial[start + 2] * c - initial[start] * s];
          const neutral: Vec3 = [sole[start] * c + sole[start + 2] * s, sole[start + 1], sole[start + 2] * c - sole[start] * s];
          if (walking && launching) {
            const step = catLaunchStep(frameState.launchPhase, launchProgress, i), initial = frameState.launchSoles[i];
            for (let k = 0; k < 3; k++) desired[k] = initial[column + k] + (desired[k] - initial[column + k]) * step.progress;
          }
          else if (!walking && !strideCorrection) for (let k = 0; k < 3; k++) desired[k] += (original[k] - neutral[k]) * (1 - orientation.settled);
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
    if (walking && !posingFeet && !crawling && turningRig && !request.reduceMotion && journey?.gait) {
      for (let i = 0; i < turningRig.legs.length; i++) {
        const leg = turningRig.legs[i], animated = transformManager.getWorldTransform(leg.paw).translation;
        // Original skeleton toe centers are 0.10 above their supporting surface.
        const ground = frameState.position[1] + .10 * scale;
        const shoulder = transformManager.getWorldTransform(leg.upper).translation;
        const elbow = transformManager.getWorldTransform(leg.lower).translation;
        const maximum = Math.hypot(...elbow.map((v,k)=>v-shoulder[k])) + Math.hypot(...animated.map((v,k)=>v-elbow[k]));
        const previousAnchor = frameState.gaitContacts[i] ?? undefined;
        let anchor = catGaitContact(animated, previousAnchor, ground, scale);
        let swing = frameState.gaitSwings[i];
        if (!swing && previousAnchor && (Math.hypot(...previousAnchor.map((v,k)=>v-shoulder[k])) > maximum-.022*scale
          || !anchor && Math.hypot(...animated.map((v,k)=>v-previousAnchor[k])) > .045*scale)) {
          swing = { from: previousAnchor, elapsed: 0 };
        }
        let reach = anchor;
        if (swing) {
          swing.elapsed += deltaSeconds;
          reach = catGaitSwing(swing.from,animated,swing.elapsed,scale);
          anchor = undefined;
          if (swing.elapsed >= .14) swing = null;
        }
        frameState.gaitSwings[i] = swing ?? null;
        frameState.gaitContacts[i] = anchor ?? null;
        if (!reach) continue;
        const sole = transformManager.getWorldTransform(leg.paw).data;
        const knee = reachingElbow(shoulder, elbow, animated, reach, frameState.heading + (leg.rear ? Math.PI : 0));
        const aim = limbAim(elbow.map((v,k)=>v-shoulder[k]) as Vec3, knee.map((v,k)=>v-shoulder[k]) as Vec3);
        const local = transformManager.getTransform(leg.upper), origin = local.translation;
        transformManager.setTransform(leg.upper,local.translate(origin.map(v=>-v) as Vec3)
          .rotate(aim.angle,tailParentAxis(aim.axis,transformManager.getWorldTransform(leg.parent).data)).translate(origin));
        const movedElbow = transformManager.getWorldTransform(leg.lower).translation;
        const movedPaw = transformManager.getWorldTransform(leg.paw).translation;
        const lowerAim = limbAim(movedPaw.map((v,k)=>v-movedElbow[k]) as Vec3,reach.map((v,k)=>v-movedElbow[k]) as Vec3);
        const lower = transformManager.getTransform(leg.lower), lowerOrigin = lower.translation;
        transformManager.setTransform(leg.lower,lower.translate(lowerOrigin.map(v=>-v) as Vec3)
          .rotate(lowerAim.angle,tailParentAxis(lowerAim.axis,transformManager.getWorldTransform(leg.upper).data)).translate(lowerOrigin));
        for (const column of [4, 0]) {
          const m = transformManager.getWorldTransform(leg.paw).data;
          const desired: Vec3 = [sole[column],sole[column+1],sole[column+2]];
          const level = limbAim([m[column],m[column+1],m[column+2]],desired);
          const paw = transformManager.getTransform(leg.paw), pivot = paw.translation;
          transformManager.setTransform(leg.paw,paw.translate(pivot.map(v=>-v) as Vec3)
            .rotate(level.angle,tailParentAxis(level.axis,transformManager.getWorldTransform(leg.lower).data)).translate(pivot));
        }
      }
    } else { frameState.gaitContacts = []; frameState.gaitSwings = []; }
    let renderedPosition = frameState.position;
    frameState.supportLift = 0;
    if (request.rugSurfaces?.length && supportingPaws.length) {
      const paws = supportingPaws.map(paw => transformManager.getWorldTransform(paw).translation);
      const lift = rugSupportLift(frameState.position, paws, request.rugSurfaces, scale);
      if (lift > 0) {
        frameState.supportLift = lift;
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
      && (frameState.elapsed >= (request.reduceMotion ? .6 : frameState.routeDuration)
        || !request.reduceMotion && request.travel.jump && request.travel.walkAfterLanding && frameState.jumpPhase >= CAT_LANDING_WALK_PHASE)
      && hasNativeArrived(frameState.position, request.travel.path[request.travel.path.length - 1])) {
      frameState.roomComplete = true;
      notify('roomComplete', { key: request.activityKey, position: [frameState.position[0], frameState.position[1], frameState.position[2]] });
    }
    state.value = frameState;
  }, [animationTimeValue, animator, clips, command, eatingProps, entity, frontLegs, hangingBall, initialPosition, notify, pawPositions, plantLeaf, positionValue, rockingMotion, state, supportingPaws, tail, transformManager, turningRig]);
  RenderCallbackContext.useRenderCallback(render, [render]);
  return null;
}
