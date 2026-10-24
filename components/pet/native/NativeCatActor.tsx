/* eslint-disable react-hooks/immutability */
/* Native asset requires are statically resolved by Metro. */
/* eslint-disable @typescript-eslint/no-require-imports */
import { rockingChairContact, type RockingMotion } from '@/utils/native-rocking-chair';
import { catJumpPoint, catJumpAim, catJumpEffort, CAT_JUMP_PREPARE, catMotionSample, CAT_LANDING_WALK_PHASE, CAT_JUMP_TAKEOFF, CAT_JUMP_TOUCHDOWN, catPathFromPosition, catPathPoint, catTravelProgress, catWalkExitRate, type CatTravelMotion, type CatMotionLeg } from '@/utils/native-cat-locomotion';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { RenderCallbackContext, useAnimator, useFilamentContext, useModel, type FilamentModel } from 'react-native-filament';
import { useSharedValue, Worklets, type ISharedValue } from 'react-native-worklets-core';
import { resolveCatSkinId } from '@/constants/cat-skins';
import { FLOOR_Y, movingCatRoute, catScreenPoint, hasNativeArrived, type NativeRoomWorld, type NativeTravel, type Vec3 } from '@/utils/native-room-world';
import type { PetPlaybackState } from '@/pet-display/types';
import { CAT_ANIMATION_CLIPS } from '@/constants/cat-animation-clips';
import { resolveTailContact, tailParentAxis, type TailContact } from '@/utils/native-cat-contact';
import { pawReachWeight, pawSurfaceTarget, type PawObjectTarget } from '@/utils/native-paw-contact';
import { limbAim, reachingElbow } from '@/utils/native-hanging-toy';
import { buildRugSurfaces, rugSupportLift } from '@/utils/native-ground-support';
import { catTurnDuration, catTurnPaw, catTurnPawOrientation, catTurnPose } from '@/utils/native-cat-turn';
import { CAT_GAITS, catSpeedGait, catGaitContact, catGaitSwing, type CatGait } from '@/utils/native-cat-gaits';
import { catLaunchPaw, catLaunchSpine, catLaunchStep } from '@/utils/native-cat-walk-launch';
import { catCommandResponse, type CatCommandAttention, catEarReaction, catJumpExpression, catRestExpression, catTravelTail, catTravelGaze } from '@/utils/native-cat-expression';
import { catSpinePose } from '@/utils/native-cat-spine';
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
  model: FilamentModel;
  registerPickEntities?: (id: string, entities: { id: number }[]) => () => void;
  skinId?: string;
  playback: PetPlaybackState;
  world?: NativeRoomWorld;
  travel?: NativeTravel;
  activityKey?: string;
  commandAttention?: CatCommandAttention;
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
  floorToy?: ISharedValue<PawObjectTarget | undefined>;
  plantLeaf?: ISharedValue<Vec3 | undefined>;
  pawPositions?: ISharedValue<Vec3[]>;
  onContactPosition?: (position: Vec3, elapsed?: number) => void;
  onRoomStepComplete?: (key: string, position: Vec3, motion?: CatTravelMotion) => void;
  initialPosition?: Vec3;
};
/** Keep a room's asset prepared while its cat is elsewhere, outside the scene. */
export function useCatModel(skinId?: string, present = true) {
  return useModel(SOURCES[resolveCatSkinId(skinId)], { shouldReleaseSourceData: false, addToScene: present });
}
export function NativeCatActor({ model, playback, world, travel, activityKey, commandAttention, loop, active, onPosition, onAnimationComplete, onStepComplete, onContactPosition, onRoomStepComplete, onReady, positionValue, rockingMotion, animationTimeValue, hangingBall, floorToy, plantLeaf, pawPositions, initialPosition, registerPickEntities, reduceMotion = false }: Props) {
  'use no memo';
  const { transformManager } = useFilamentContext();
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
  const ears = useMemo(() => asset ? ['ear.L','ear.R'].flatMap(name => {
    const joint=asset.getFirstEntityByName(name);return joint?[joint]:[];
  }) : [], [asset]);
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
  const receive = useCallback((kind: 'position' | 'complete' | 'step' | 'ready' | 'roomComplete', data: number[] | number | { key: string; position: Vec3; motion?: CatTravelMotion }) => {
    if (kind === 'position' && Array.isArray(data)) {
      callbacks.current.onPosition?.({ x: data[0], y: data[1] });
      callbacks.current.onContactPosition?.([data[2], data[3], data[4]], data[5]);
    }
    else if (kind === 'roomComplete' && typeof data === 'object' && 'key' in data) {
      callbacks.current.onRoomStepComplete?.(data.key, data.position, data.motion);
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
  const command = useSharedValue({ id: 0, activityKey, commandAttention, segments, travel, world, active, reduceMotion, rugSurfaces, steering: undefined as ReturnType<typeof movingCatRoute> });
  const commandRevision = useRef<{ id: number; activityKey?: string; segments?: typeof segments; travel?: NativeTravel; home?: Vec3 }>({ id: 0 });
  const state = useSharedValue({ id: -1, elapsed: 0, index: 0, complete: false, roomComplete: false, heading: world ? Math.PI / 4 : 0, distance: 0,
    position: (initialPosition ?? world?.home ?? [0, 0, 0]) as Vec3, home: (world?.home ?? [0, 0, 0]) as Vec3, routeStart: (world?.home ?? [0, 0, 0]) as Vec3, report: 0, ready: false, clip: -1, clipTime: 0, previous: -1, previousTime: 0, blend: 1, blendSeconds: .12,
    clipLoop: false, previousLoop: false, clipDuration: 1, previousDuration: 1,
    routePath: [] as Vec3[], routePaces: [] as number[], routeLegs: [] as CatMotionLeg[], routeDuration: 0, routeRamp: .18, routeStartRate: 0, routeEndRate: 0, routeCost: 0, entryMotionApplied: false,
    sourcePath: [] as Vec3[], sourceDuration: 0, sourceJump: false, jumpPhase: 0, jumpOffset: 0, jumpDuration: 0, jumpArcHeight: 0, jumpFrom: [0, 0, 0] as Vec3,
    preparation: 0, prepareTarget: undefined as Vec3 | undefined, preparedJump: false,
    noticeId: undefined as number | undefined, noticeTime: 2,
    playTargets: [null,null] as (Vec3 | null)[], playTime: 0, playId: -1,
    turnElapsed: 0, turnDuration: 0, turnFrom: 0, turnAngle: 0,
    turnFeet: [] as Vec3[], turnNeutral: [] as Vec3[], turnLeg: -1,
    turnSoles: [] as number[][], turnHead: 0, turnSpineHeight: 0, turnCrouch: 0,
    turnInitialSoles: [] as number[][],
    turnOverlap: 0, launchStarted: false, launchFeet: [] as Vec3[], launchSoles: [] as number[][],
    landingPending: false, launchFromLanding: false, standingPending: false, launchFromStanding: false, launchDistance: 0, launchStride: .8, launchPhase: 0, launchHeight: 0, walkStride: .8, walkOffset: 0,
    gait: 'walk' as CatGait, gaitSpeed: 0, gaitContacts: [] as (Vec3 | null)[],
    gaitSwings: [] as ({ from: Vec3; elapsed: number } | null)[],
    spinePose: catSpinePose(0,0,0), restExpressionWeight: 0,
    tailYaw: [0,0,0,0], tailPitch: [0,0,0,0], travelHead: 0, tailTurnRate: 0, earYaw: 0, earPitch: [0,0], supportLift: 0, expressionTime: 0, lookCycle: -1, lookTarget: undefined as Vec3 | undefined, attentionYaw: 0, attentionPitch: 0,
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
    const frame=state.value;
    const moving=changed && frame.ready && !frame.sourceJump && !frame.routeLegs.length
      && frame.elapsed<frame.routeDuration && frame.turnElapsed>=frame.turnDuration;
    const previousClip=previous.segments?.[frame.index]?.name;
    const departing=changed && frame.ready && !frame.sourceJump && !frame.routeLegs.length
      && frame.turnElapsed>=frame.turnDuration && (previousClip==='idle' || previousClip==='walk'&&frame.elapsed>=frame.routeDuration);
    const landed=changed && frame.ready && frame.sourceJump && frame.landingPending && frame.jumpPhase>=CAT_LANDING_WALK_PHASE;
    const steering=(moving||departing||landed)&&!reduceMotion ? movingCatRoute(travel,frame.position,frame.heading,frame.gaitSpeed*(world?.catScale??1),world,departing||landed,landed) : undefined;
    command.value = { id, activityKey, commandAttention, segments, travel, world, active, reduceMotion, rugSurfaces, steering };
  }, [activityKey, active, command, commandAttention, reduceMotion, rugSurfaces, segments, state, travel, world]);
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
    // Re-solving contact IK without advancing time can change its bend plane.
    // A resumed, unchanged command should retain the exact displayed pose.
    if (state.value.ready && state.value.id === request.id && timeSinceLastFrame <= 0 && !request.reduceMotion)
      return;
    const frameState = { ...state.value };
    // Fast Refresh may retain drawing-thread state from before these fields
    // existed. Initialize it before any expression reaches a native matrix.
    if(!Number.isFinite(frameState.expressionTime)) {
      frameState.expressionTime=0;frameState.lookCycle=-1;frameState.lookTarget=undefined;
      frameState.attentionYaw=0;frameState.attentionPitch=0;
    }
    if(!Number.isFinite(frameState.travelHead)) {frameState.travelHead=0;frameState.tailTurnRate=0;frameState.tailYaw=[0,0,0,0];frameState.tailPitch=[0,0,0,0];}
    if(!Number.isFinite(frameState.earYaw)) {frameState.earYaw=0;frameState.earPitch=[0,0];frameState.travelHead=0;frameState.tailTurnRate=0;frameState.tailYaw=[0,0,0,0];frameState.tailPitch=[0,0,0,0];}
    if(!frameState.spinePose)frameState.spinePose=catSpinePose(0,0,0);
    frameState.restExpressionWeight ??= 0;
    frameState.standingPending ??= false;frameState.launchFromStanding ??= false;
    frameState.spinePose.chestLift ??= 0;frameState.spinePose.hipLift ??= 0;
    frameState.spinePose.chestRoll ??= 0;frameState.spinePose.hipRoll ??= 0;frameState.spinePose.scapula ??= 0;
    for(const key of ['headPitch','headYaw','headRoll','tailFollowYaw','tailFollowPitch','tailTipYaw','tailTipPitch'] as const)frameState.spinePose[key] ??= 0;
    if (frameState.id !== request.id) {
      const renderedElapsed = frameState.elapsed;
      frameState.id = request.id;
      frameState.lookCycle=-1;
      frameState.elapsed = request.travel?.elapsed ?? 0;
      frameState.index = 0;
      frameState.complete = false;
      frameState.roomComplete = false;
      if (!request.travel?.path.length) {
        frameState.landingPending = false;
        frameState.standingPending = false;frameState.launchFromStanding = false;
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
          // A stale RN resume snapshot with no drawing time must retain the
          // exact displayed pose. Re-solving bent contact legs at dt=0 can
          // otherwise accumulate tiny rotations without any actual movement.
          if(!request.reduceMotion && timeSinceLastFrame<=0 && frameState.elapsed===renderedElapsed) {
            state.value=frameState;
            return;
          }
        } else {
          frameState.turnElapsed = 0;
          frameState.turnDuration = 0;
          frameState.turnFeet = [];
          frameState.turnNeutral = [];
          frameState.turnLeg = -1;
          frameState.turnOverlap = 0;
          frameState.launchStarted = false;
          frameState.launchFromLanding = false;
          frameState.standingPending = false;frameState.launchFromStanding = false;
          if (journey.jump || !request.segments[0]?.name.startsWith('walk')) frameState.landingPending = false;
          const phase = frameState.distance / (frameState.walkStride * (request.world?.catScale ?? 1)) + frameState.walkOffset;
          frameState.walkStride = .8;
          frameState.walkOffset = phase - frameState.distance / (.8 * (request.world?.catScale ?? 1));
          const continuingJump = journey.jump && frameState.sourceJump && frameState.jumpPhase > CAT_JUMP_TAKEOFF && frameState.jumpPhase < 1
            && frameState.sourcePath.length > 1 && journey.path.length > 1
            && Math.hypot(...journey.path[journey.path.length-1].map((v,k)=>v-frameState.sourcePath[frameState.sourcePath.length-1][k])) < .001;
          const jumpEnd=journey.path[journey.path.length-1];
          const launchHeading=Math.atan2(jumpEnd[0]-frameState.position[0],jumpEnd[2]-frameState.position[2]);
          const prepared=journey.jump && !journey.elapsed && !request.reduceMotion && frameState.preparation>.999
            && frameState.prepareTarget && Math.hypot(...jumpEnd.map((v,k)=>v-frameState.prepareTarget![k]))<.001
            && Math.abs(Math.atan2(Math.sin(launchHeading-frameState.heading),Math.cos(launchHeading-frameState.heading)))<.25;
          frameState.preparedJump=continuingJump ? frameState.preparedJump : !!prepared;
          frameState.jumpOffset = continuingJump ? frameState.jumpPhase : prepared ? CAT_JUMP_PREPARE : 0;
          frameState.preparation=0;frameState.prepareTarget=undefined;
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
          const route = request.steering ? catPathFromPosition(request.steering.path,frameState.position,request.steering.paces) : rebase ? catPathFromPosition(sourcePath, frameState.position, sourcePaces) : { path: sourcePath, paces: sourcePaces ?? [], fraction: 1 };
          frameState.routePath = journey.legs?.length ? journey.path : route.path;
          frameState.routePaces = route.paces;
          frameState.routeLegs = journey.legs ?? [];
          frameState.routeDuration = continuingJump || frameState.preparedJump ? Math.max(.08,(1-frameState.jumpOffset)*frameState.jumpDuration) : request.steering?.duration ?? journey.duration;
          frameState.routeRamp = request.steering?.ramp ?? journey.ramp ?? .18;
          // Curve planning ran on JS. Trim any samples passed by the drawing
          // thread before publication, retaining the actual rendered position.
          if(request.steering)frameState.routeDuration=Math.max(.18,(request.steering.duration-frameState.routeRamp)*route.fraction+frameState.routeRamp);
          let cost=0;
          for(let i=1;i<route.path.length;i++)cost+=Math.hypot(...route.path[i].map((v,k)=>v-route.path[i-1][k]))*((route.paces[i-1]??1)+(route.paces[i]??1))/2;
          frameState.routeStartRate=request.steering&&cost>1e-5?request.steering.startSpeed*(route.paces[0]??1)/cost:0;
          if(!request.steering){frameState.gaitContacts = [];frameState.gaitSwings = [];}
          if (rebase && !request.steering && route.path.length > 1) {
            const ramp = floorLeg?.ramp ?? journey.ramp ?? .18;
            const duration = Math.max(.18, ((floorLeg?.duration ?? journey.duration) - ramp) * route.fraction + ramp);
            if (floorLeg) {
              const legs: CatMotionLeg[] = [{ ...floorLeg, path: route.path, paces: route.paces, duration }];
              for (let i = 1; i < journey.legs!.length; i++) legs.push(journey.legs![i]);
              frameState.routeLegs = legs;
              frameState.routeDuration += duration - floorLeg.duration;
            } else frameState.routeDuration = duration;
          }
          const incoming=journey.entryMotion && !frameState.entryMotionApplied && !request.reduceMotion ? journey.entryMotion : undefined;
          if(incoming) {
            frameState.entryMotionApplied=true;
            frameState.gait=incoming.gait;frameState.gaitSpeed=incoming.speed;
            frameState.walkStride=CAT_GAITS[incoming.gait].stride;
            frameState.walkOffset=incoming.phase-frameState.distance/(frameState.walkStride*(request.world?.catScale??1));
            frameState.tailYaw=incoming.tailYaw.map(v=>v);frameState.tailPitch=incoming.tailPitch.map(v=>v);
            if(incoming.spinePose)frameState.spinePose={...catSpinePose(0,0,0),...incoming.spinePose};
            frameState.routeStartRate=cost>1e-5?incoming.speed*(request.world?.catScale??1)*(route.paces[0]??1)/cost:0;
            if(floorLeg)frameState.routeLegs=frameState.routeLegs.map((leg,index)=>index?leg:{...leg,initialRate:frameState.routeStartRate});
          }
          frameState.standingPending=rebase && !journey.legs?.length && !incoming && !frameState.landingPending
            && !journey.bed && !journey.bathroom && frameState.gaitSpeed<.15
            && request.segments[0]?.name==='walk';
          frameState.routeCost=cost;
          frameState.routeEndRate=journey.through?catWalkExitRate(frameState.routeDuration,frameState.routeRamp,frameState.routeStartRate):0;
          if(journey.through && frameState.routeLegs.length) {
            const last=frameState.routeLegs.length-1;
            frameState.routeLegs=frameState.routeLegs.map((leg,index)=>index===last&&leg.kind==='walk'?{...leg,through:true}:leg);
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
              if (!frameState.ready || incoming) frameState.heading = facing;
              else if (Math.abs(angle) > .35 && !request.steering) {
                frameState.landingPending = false;frameState.standingPending = false;
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
    frameState.expressionTime+=deltaSeconds;
    if(!Number.isFinite(frameState.noticeTime))frameState.noticeTime=2;
    if(frameState.noticeId!==request.commandAttention?.id) {
      frameState.noticeId=request.commandAttention?.id;
      frameState.noticeTime=request.commandAttention?Math.max(0,(Date.now()-request.commandAttention.issuedAt)/1000):2;
    }
    frameState.noticeTime=Math.min(2,frameState.noticeTime+deltaSeconds);
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
    let expressionFrom=frameState.jumpFrom,expressionTo:Vec3|undefined;
    let jumpHeading: number | undefined;
    let jumpLook = 0;
    let turnPhase: number | undefined;
    let routeAnimation: string | undefined;
    let lookAhead: Vec3 | undefined;
    let gazeAhead: Vec3 | undefined;
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
        walking = sample.kind === 'walk' && (!sample.animation || sample.animation === 'crawl') && frameState.elapsed < frameState.routeDuration;
        hopPhase = sample.kind === 'hop' ? sample.progress : undefined;
        turnPhase = sample.kind === 'turn' ? sample.progress : undefined;
        routeAnimation = sample.kind === 'turn' ? 'turn' : sample.animation;
        if (sample.kind === 'hop') {
          jumpHeading = sample.heading; frameState.jumpDuration = sample.actionDuration;
          const leg=frameState.routeLegs[sample.index];expressionFrom=leg.path[0];expressionTo=leg.path[leg.path.length-1];
        }
        lookAhead = sample.ahead;
        gazeAhead = sample.gaze;
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
        expressionTo=last;
        const aim=catJumpAim(first,last,t,journey.landingHeading);
        jumpHeading = aim.heading;jumpLook=aim.headTurn;
        frameState.position = catJumpPoint(first, last, t, frameState.jumpArcHeight, true);
      }
      else if (path.length > 1) {
        walking = frameState.elapsed < frameState.routeDuration;
        const progress = catTravelProgress(frameState.elapsed, frameState.routeDuration, frameState.routeRamp, frameState.routeStartRate??0, frameState.routeEndRate??0);
        lookAhead = catPathPoint(path, catTravelProgress(frameState.elapsed + .10, frameState.routeDuration, frameState.routeRamp, frameState.routeStartRate??0, frameState.routeEndRate??0), frameState.routePaces);
        gazeAhead = catPathPoint(path, catTravelProgress(frameState.elapsed + .35, frameState.routeDuration, frameState.routeRamp, frameState.routeStartRate??0, frameState.routeEndRate??0), frameState.routePaces);
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
    const previousHeading=frameState.heading;
    const turn = Math.atan2(Math.sin(desiredHeading - frameState.heading), Math.cos(desiredHeading - frameState.heading));
    const steppingTurn = turnPhase !== undefined && routeAnimation !== 'sit';
    if (!turning && jumpHeading !== undefined) frameState.heading = jumpHeading;
    else if (!turning && !steppingTurn) frameState.heading += Math.max(-deltaSeconds * 6, Math.min(deltaSeconds * 6, turn * (1 - Math.exp(-deltaSeconds * 14))));
    const perched = journey?.treePlay && !journey.jump && frameState.position[1] > FLOOR_Y + .1;
    const crawling = routeAnimation === 'crawl' || !!journey?.bed && journey.bed.phase !== 'covered';
    const arrivedWalk = !!journey && !journey.jump && frameState.routePath.length > 1
      && frameState.elapsed >= frameState.routeDuration && segment.name === 'walk';
    if(!journey?.jump) {
      const end=frameState.routePath[frameState.routePath.length-1],target=journey?.prepareJump?.target;
      const aim=end&&target ? Math.atan2(target[0]-end[0],target[2]-end[2])-frameState.heading : Math.PI;
      const ready=target && !turning && !frameState.routeLegs.length && (walking||arrivedWalk) && !request.reduceMotion
        && Math.abs(Math.atan2(Math.sin(aim),Math.cos(aim)))<.25;
      const u=ready ? Math.max(0,Math.min(1,(frameState.elapsed-frameState.routeDuration+.18)/.18)) : 0;
      frameState.preparation=u*u*(3-2*u);frameState.prepareTarget=ready?target:undefined;
      // Finish the launch alignment during the supported final step. Otherwise
      // the jump's fixed heading would rotate the planted paws at the handoff.
      if(ready)frameState.heading+=Math.atan2(Math.sin(aim),Math.cos(aim))*frameState.preparation;
    }
    if(hopPhase!==undefined && journey?.landingLook && !request.reduceMotion) {
      const u=Math.max(0,Math.min(1,(hopPhase-.62)/.26));
      jumpLook+=catTravelGaze(frameState.position,frameState.heading,journey.landingLook,scale)*u*u*(3-2*u);
    }
    if (frameState.launchStarted && hopPhase !== undefined) {
      const phase = frameState.distance / (frameState.walkStride * scale) + frameState.walkOffset;
      frameState.walkStride = .8;
      frameState.walkOffset = phase - frameState.distance / (.8 * scale);
      frameState.launchStarted = false;
      frameState.turnOverlap = 0;
    }
    if (hopPhase !== undefined) frameState.landingPending = hopPhase >= CAT_JUMP_TOUCHDOWN;
    const landingCapture = walking && frameState.landingPending && !turning && !steppingTurn && !frameState.launchStarted && !request.reduceMotion;
    const standingCapture=walking && frameState.standingPending && !crawling && !turning && !steppingTurn && !frameState.launchStarted && !request.reduceMotion;
    const supportCapture=landingCapture || standingCapture;
    if (walking && (frameState.turnOverlap > 0 || supportCapture) && !frameState.launchStarted && turningRig) {
      if (supportCapture) {
        frameState.turnFrom = frameState.heading;
        frameState.turnAngle = 0;
        frameState.turnFeet = [];
        frameState.turnNeutral = [];
        const end = frameState.routePath[frameState.routePath.length-1];
        frameState.walkStride = Math.min(.8,Math.max(.05,Math.hypot(...end.map((v,k)=>v-frameState.position[k]))/(scale*1.1)));
      }
      frameState.launchFromLanding = landingCapture;
      frameState.launchFromStanding = standingCapture;frameState.standingPending = false;
      frameState.landingPending = false;
      frameState.launchStarted = true;
      frameState.launchFeet = turningRig.legs.map(leg => {
        const p = transformManager.getWorldTransform(leg.paw).translation;
        return [p[0], p[1] - frameState.supportLift, p[2]] as Vec3;
      });
      frameState.launchSoles = turningRig.legs.map(leg => transformManager.getWorldTransform(leg.paw).data);
      frameState.launchHeight = (transformManager.getWorldTransform(turningRig.spine).translation[1] - frameState.supportLift - previousPosition[1]) / scale - frameState.spinePose.arch;
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
    const rawSpeed = (walking || arrivedWalk && journey.through) && deltaSeconds > 0 ? moved / (deltaSeconds * scale) : 0;
    frameState.gaitSpeed += (rawSpeed - frameState.gaitSpeed) * (1 - Math.exp(-deltaSeconds * 12));
    const nextGait = arrivedWalk && journey.through ? frameState.gait : walking && !crawling && !posingFeet && !request.reduceMotion
      ? catSpeedGait(frameState.gaitSpeed, frameState.gait, maximumGait) : 'walk';
    const gait = clips[nextGait] ? nextGait : 'walk';
    if (gait !== frameState.gait) {
      const phase = frameState.distance / (frameState.walkStride * scale) + frameState.walkOffset;
      frameState.walkStride = CAT_GAITS[gait].stride;
      frameState.walkOffset = phase - frameState.distance / (frameState.walkStride * scale);
      frameState.gait = gait;
    }
    const brushStart=journey?.path[0],brushEnd=journey?.path[journey.path.length-1];
    const brushing=walking && !crawling && journey?.brushSide !== undefined && brushStart && brushEnd
      && Math.hypot(frameState.position[0]-brushStart[0],frameState.position[2]-brushStart[2])>scale
      && Math.hypot(frameState.position[0]-brushEnd[0],frameState.position[2]-brushEnd[2])>scale;
    const brushBlend=brushing ? Math.max(0,Math.min(1,
      (Math.hypot(frameState.position[0]-brushStart[0],frameState.position[2]-brushStart[2])/scale-1)/.35,
      (Math.hypot(frameState.position[0]-brushEnd[0],frameState.position[2]-brushEnd[2])/scale-1)/.35)) : 0;
    const walkClip = crawling ? 'crawl' : brushing ? journey.brushSide! > 0 ? 'rubLeft' : 'rubRight' : frameState.gait;
    const clipName = arrivedWalk ? journey.through ? frameState.gait : journey.bed ? 'crawl' : 'idle' : walking && frameState.launchStarted ? walkClip : routeAnimation ?? (turnPhase !== undefined ? 'turn' : hopPhase !== undefined ? 'hop' : walking ? walkClip : perched && segment.name === 'batToy' ? 'sit' : segment.name);
    const lightJump=journey?.jump && hopPhase!==undefined && catJumpEffort(frameState.jumpFrom,journey.path[journey.path.length-1],scale,frameState.jumpArcHeight)<.8;
    const selectedClip=walking && frameState.launchStarted ? walkClip : steppingTurn ? 'idle' : clipName;
    const clip = clips[lightJump && (selectedClip==='jumpOn'||selectedClip==='jumpOff') ? selectedClip+'Light' : selectedClip] ?? clips[selectedClip] ?? clips.idle;
    if (!clip)
      return;
    let time = walking ? ((frameState.distance / (frameState.walkStride * scale) + frameState.walkOffset) % 1 + 1) % 1 * clip.duration : turnPhase !== undefined ? turnPhase * clip.duration : hopPhase !== undefined ? hopPhase * clip.duration : routeAnimation === 'sit' ? frameState.elapsed % clip.duration
      : Math.min(segment.duration, segment.loop ? frameState.elapsed % segment.duration : frameState.elapsed) / segment.duration * clip.duration;
    // Retain the departure-ready contacts while JS dispatches the queued walk,
    // rather than standing up and stretching the planted hind legs first.
    if (journey?.jump && journey.walkAfterLanding && hopPhase !== undefined && hopPhase > CAT_LANDING_WALK_PHASE)
      time = CAT_LANDING_WALK_PHASE * clip.duration;
    if (arrivedWalk) time = journey.through ? ((frameState.distance/(frameState.walkStride*scale)+frameState.walkOffset)%1+1)%1*clip.duration : journey.bed ? frameState.clipTime : (frameState.elapsed - frameState.routeDuration) % clip.duration;
    const resting=hopPhase===undefined && !walking && !posingFeet && !journey?.bed && !journey?.bathroom
      && !journey?.treePlay && ['idle','idle2','blinkIdle','blinkSit','sit','waiting'].includes(segment.name);
    const settling=resting || arrivedWalk && !journey.through && !journey.bed && !journey.bathroom;
    // Held commands retain their scheduler semantics while the awake cat
    // continues breathing, blinking and shifting its gaze after the clip ends.
    if(resting)time=frameState.elapsed%clip.duration;
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
      frameState.blend = frameState.preparedJump && hopPhase!==undefined ? 1 : 0;
      frameState.blendSeconds = launching && frameState.launchFromStanding ? .22 : frameState.previous === clips.wakeStretch?.index ? .22 : walking && [clips.walk?.index,clips.trot?.index,clips.run?.index].includes(frameState.previous) ? .22 : .12;
    }
    frameState.clipTime = time;
    frameState.clipLoop = (!steppingTurn || walking) && (arrivedWalk ? !journey.bed : walking || hopPhase === undefined && segment.loop);
    frameState.clipDuration = clip.duration;
    if (animationTimeValue)
      animationTimeValue.value = { name: clipName, time };
    frameState.blend = Math.min(1, frameState.blend + deltaSeconds / frameState.blendSeconds);
    if ((steppingTurn || supportCapture) && turningRig && !frameState.turnFeet.length) {
      // Retain the visible contacts, including an interrupted walk or turn.
      const head = transformManager.getWorldTransform(turningRig.head).data;
      const headYaw = Math.atan2(head[8], head[10]) - frameState.turnFrom;
      frameState.turnHead = Math.atan2(Math.sin(headYaw), Math.cos(headYaw));
      frameState.turnSpineHeight = (transformManager.getWorldTransform(turningRig.spine).translation[1] - frameState.supportLift - frameState.position[1]) / scale - frameState.spinePose.arch;
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
    if (supportCapture && turningRig && clips.idle) {
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
    // The waking bow must blend out even while first-step IK places the paws.
    if ((!posingFeet || arrivedWalk || launching && (frameState.launchFromLanding || frameState.launchFromStanding) || frameState.previous === clips.wakeStretch?.index) && frameState.previous >= 0 && frameState.blend < 1) {
      // Keep the outgoing pose moving while blending instead of freezing a paw mid-stride.
      if (frameState.previousLoop) {
        const previousGait = frameState.previous === clips.run?.index ? 'run' : frameState.previous === clips.trot?.index ? 'trot' : frameState.previous === clips.walk?.index ? 'walk' : undefined;
        const advance = walking && previousGait ? moved/(CAT_GAITS[previousGait].stride*scale)*frameState.previousDuration : deltaSeconds;
        frameState.previousTime = (frameState.previousTime + advance) % frameState.previousDuration;
      }
      else if (frameState.launchFromLanding && launching) {
        frameState.previousTime = Math.min(frameState.previousDuration,frameState.previousTime+deltaSeconds*frameState.previousDuration/Math.max(.1,frameState.jumpDuration));
      }
      const blend=launching && frameState.launchFromStanding?frameState.blend*frameState.blend*(3-2*frameState.blend):frameState.blend;
      animator.applyCrossFade(frameState.previous, frameState.previousTime, blend);
    }
    if(frameState.preparation>0 && journey?.prepareJump && !request.reduceMotion) {
      const preparationClip=clips[journey.prepareJump.light?'jumpOnLight':'jumpOn']??clips.jumpOn;
      if(preparationClip)animator.applyCrossFade(preparationClip.index,CAT_JUMP_PREPARE*preparationClip.duration,1-frameState.preparation);
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
    if (brushBlend>0 && turningRig && !request.reduceMotion) {
      const amount=brushBlend*brushBlend*(3-2*brushBlend)*journey!.brushSide!;
      const local=transformManager.getTransform(turningRig.head),origin=local.translation;
      const parent=transformManager.getWorldTransform(turningRig.neck).data;
      const forward:Vec3=[Math.sin(frameState.heading),0,Math.cos(frameState.heading)];
      transformManager.setTransform(turningRig.head,local.translate(origin.map(v=>-v) as Vec3)
        .rotate(.18*amount,tailParentAxis([0,1,0],parent))
        .rotate(-.08*amount,tailParentAxis(forward,parent)).translate(origin));
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
      const spineShift = launching ? catLaunchSpine(frameState.launchHeight, walkHeight, launchProgress, frameState.walkStride, frameState.launchFromLanding || frameState.launchFromStanding)
        : walking ? 0 : -turnPose.crouch;
      transformManager.setTransform(turningRig.spine, spineLocal.translate([0, spineShift, 0]));
      if(launching && (frameState.launchFromLanding || frameState.launchFromStanding)) {
        // Keep the shoulders and hips within reach of the first-step feet.
        // For a standing start, follow the lifting targets too so the
        // support adjustment releases smoothly through lift-off.
        let drop=0;
        for(let i=0;i<turningRig.legs.length;i++) {
          const step=catLaunchStep(frameState.launchPhase,launchProgress,i);
          if(frameState.launchFromStanding?step.done:step.progress>0)continue;
          const leg=turningRig.legs[i],a=transformManager.getWorldTransform(leg.upper).translation;
          const b=transformManager.getWorldTransform(leg.lower).translation,p=transformManager.getWorldTransform(leg.paw).translation;
          const target=frameState.launchFromStanding
            ? catLaunchPaw(frameState.launchFeet[i],frameState.turnNeutral[i],walkPaws[i],frameState.position,frameState.heading,scale,frameState.walkStride,frameState.launchPhase,launchProgress,i)
            : frameState.launchFeet[i];
          const length=Math.hypot(...a.map((v,k)=>v-b[k]))+Math.hypot(...b.map((v,k)=>v-p[k]))-.001;
          const vertical=Math.sqrt(Math.max(0,length*length-(a[0]-target[0])**2-(a[2]-target[2])**2));
          drop=Math.max(drop,a[1]-target[1]-vertical);
        }
        if(drop>0)transformManager.setTransform(turningRig.spine,transformManager.getTransform(turningRig.spine).translate([0,-Math.min(frameState.launchFromStanding?.10:.01,drop/scale),0]));
      }
      const headRecovery=Math.max(0,Math.min(1,launchProgress/.55));
      const headAngle = launching && (frameState.launchFromLanding || frameState.launchFromStanding)
        ? frameState.turnHead*(1-headRecovery*headRecovery*(3-2*headRecovery)) : turnPose.head;
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
    if (turningRig && request.world) {
      const enabled=!request.reduceMotion && !crawling && !journey?.bed && !journey?.bathroom;
      const bend=enabled ? steppingTurn ? catTurnPose(frameState.turnAngle,turnPhase??1).head : walking ? turn : 0 : 0;
      const target=catSpinePose(frameState.distance/(frameState.walkStride*scale)+frameState.walkOffset,
        enabled && walking ? frameState.gaitSpeed : 0,bend,enabled ? hopPhase : undefined,
        enabled && segment.name==='batToy' && !posingFeet && turnPhase===undefined ? time/clip.duration : undefined);
      // The landing already supplies compression. Let it recover through the
      // first supported stride before allowing the gait's downward back flex.
      if(launching && frameState.launchFromLanding)target.arch=Math.max(0,target.arch);
      for(const key of ['arch','side','chestPitch','hipPitch','chestYaw','hipYaw','chestLift','hipLift','chestRoll','hipRoll','scapula'] as const) {
        // The hips follow the chest through a turn; changing commands must
        // not yank the middle back to the opposite side in a single frame.
        const rate=settling?8:key==='side'?8:key==='chestYaw'?10:key==='hipYaw'?7:22;
        const blend=request.reduceMotion?1:1-Math.exp(-deltaSeconds*rate);
        frameState.spinePose[key]+=(target[key]-frameState.spinePose[key])*blend;
      }
      const flex=frameState.spinePose;
      const firstStep=launching && !frameState.launchFromLanding;
      const follow=enabled && (walking || settling) && (!posingFeet || firstStep) && !frameState.preparation;
      const start=Math.max(0,Math.min(1,launchProgress/.6));
      const followWeight=firstStep?start*start*(3-2*start):1;
      // A restrained neck response follows chest loading. The tail base
      // follows the hips, then passes that response down to the tip.
      // Keep that chain connected while the torso releases after the last step.
      for(const [key,value,rate] of [
        ['headPitch',follow?flex.chestPitch*.50*followWeight:0,settling?6:9],
        ['headYaw',follow?flex.chestYaw*.40*followWeight:0,settling?6:9],
        ['headRoll',follow?flex.chestRoll*.25*followWeight:0,settling?6:9],
        ['tailFollowYaw',follow?flex.hipYaw*1.4*followWeight:0,settling?6:8],
        ['tailFollowPitch',follow?(flex.hipPitch*1.1-flex.arch*.50)*followWeight:0,settling?6:8],
        ['tailTipYaw',follow?flex.tailFollowYaw:0,settling?4:6],
        ['tailTipPitch',follow?flex.tailFollowPitch:0,settling?4:6],
      ] as const) {
        const blend=enabled?1-Math.exp(-deltaSeconds*rate):1;
        flex[key]+=(value-flex[key])*blend;
      }
      if(Object.values(flex).some(value=>Math.abs(value)>1e-6)) {
        // Keep the authored paw trajectories and soles while the weighted
        // middle back, shoulders and hips bend independently above them.
        const neckTarget=transformManager.getWorldTransform(turningRig.neck).translation;
        const feet=turningRig.legs.map(leg=>transformManager.getWorldTransform(leg.paw).data);
        const side:Vec3=[Math.cos(frameState.heading),0,-Math.sin(frameState.heading)];
        const forward:Vec3=[Math.sin(frameState.heading),0,Math.cos(frameState.heading)];
        const spine=transformManager.getTransform(turningRig.spine);
        const shift:Vec3=[flex.side,flex.arch,0];
        transformManager.setTransform(turningRig.spine,spine.translate(shift));
        const parent=transformManager.getWorldTransform(turningRig.spine).data;
        // Anchor both ends of the curve; translating the root alone just bobs
        // a rigid cat. The middle skin rises between the anchored endpoints.
        const up=tailParentAxis([0,1,0],parent),lateral=tailParentAxis(side,parent),longitudinal=tailParentAxis(forward,parent);
        const counter=up.map((v,k)=>-v*flex.arch-lateral[k]*flex.side) as Vec3;
        for(const [joint,pitch,yaw,lift,roll] of [
          [turningRig.legs[0].parent,flex.chestPitch,flex.chestYaw,flex.chestLift,flex.chestRoll],
          [turningRig.legs[2].parent,flex.hipPitch,flex.hipYaw,flex.hipLift,flex.hipRoll],
        ] as const) {
          const local=transformManager.getTransform(joint),origin=local.translation;
          transformManager.setTransform(joint,local.translate(origin.map(v=>-v) as Vec3)
            .rotate(pitch,lateral).rotate(yaw,up).rotate(roll,longitudinal).translate(origin).translate(counter).translate(up.map(v=>v*lift) as Vec3));
        }
        if(tail) {
          const local=transformManager.getTransform(tail.joints[0]);
          transformManager.setTransform(tail.joints[0],local.translate(counter));
        }
        // Stabilize the gaze, then allow a small delayed response to the
        // chest. The neck still follows part of its translation.
        const neck=turningRig.neck,neckParent=transformManager.getWorldTransform(turningRig.legs[0].parent).data;
        const neckLocal=transformManager.getTransform(neck),neckOrigin=neckLocal.translation;
        const neckWorld=transformManager.getWorldTransform(neck).translation;
        const neckDelta=neckTarget.map((v,k)=>(v-neckWorld[k])*.65) as Vec3,neckDistance=Math.hypot(...neckDelta);
        const neckCorrection=neckDistance>1e-9?tailParentAxis(neckDelta,neckParent).map(v=>v*neckDistance/scale) as Vec3:[0,0,0] as Vec3;
        transformManager.setTransform(neck,neckLocal.translate(neckOrigin.map(v=>-v) as Vec3)
          .rotate(-flex.chestRoll,tailParentAxis(forward,neckParent))
          .rotate(-flex.chestYaw,tailParentAxis([0,1,0],neckParent))
          .rotate(-flex.chestPitch,tailParentAxis(side,neckParent))
          .rotate(flex.headPitch,tailParentAxis(side,neckParent))
          .rotate(flex.headYaw,tailParentAxis([0,1,0],neckParent))
          .rotate(flex.headRoll,tailParentAxis(forward,neckParent)).translate(neckOrigin).translate(neckCorrection));
        for(let i=0;i<turningRig.legs.length;i++) {
          const leg=turningRig.legs[i],sole=feet[i],reach=sole.slice(12,15) as Vec3;
          if(!leg.rear) {
            const parent=transformManager.getWorldTransform(leg.parent).data;
            const slide=flex.scapula*(i===0?1:-1);
            transformManager.setTransform(leg.upper,transformManager.getTransform(leg.upper)
              .translate(tailParentAxis(forward,parent).map(v=>v*slide) as Vec3));
          }
          let shoulder=transformManager.getWorldTransform(leg.upper).translation;
          const elbow=transformManager.getWorldTransform(leg.lower).translation,paw=transformManager.getWorldTransform(leg.paw).translation;
          const length=Math.hypot(...elbow.map((v,k)=>v-shoulder[k]))+Math.hypot(...paw.map((v,k)=>v-elbow[k]));
          const distance=Math.hypot(...reach.map((v,k)=>v-shoulder[k]));
          // At full extension, give back only the unreachable shoulder offset.
          if(distance>length-.002*scale) {
            const correction=reach.map((v,k)=>(v-shoulder[k])/distance*(distance-length+.002*scale)) as Vec3;
            const local=transformManager.getTransform(leg.upper),parent=transformManager.getWorldTransform(leg.parent).data;
            const magnitude=Math.hypot(...correction);
            transformManager.setTransform(leg.upper,local.translate(tailParentAxis(correction,parent).map(v=>v*magnitude/scale) as Vec3));
            shoulder=transformManager.getWorldTransform(leg.upper).translation;
          }
          const currentElbow=transformManager.getWorldTransform(leg.lower).translation,currentPaw=transformManager.getWorldTransform(leg.paw).translation;
          const knee=reachingElbow(shoulder,currentElbow,currentPaw,reach,frameState.heading+(leg.rear?Math.PI:0));
          const aim=limbAim(currentElbow.map((v,k)=>v-shoulder[k]) as Vec3,knee.map((v,k)=>v-shoulder[k]) as Vec3);
          const local=transformManager.getTransform(leg.upper),origin=local.translation;
          transformManager.setTransform(leg.upper,local.translate(origin.map(v=>-v) as Vec3)
            .rotate(aim.angle,tailParentAxis(aim.axis,transformManager.getWorldTransform(leg.parent).data)).translate(origin));
          const movedElbow=transformManager.getWorldTransform(leg.lower).translation,movedPaw=transformManager.getWorldTransform(leg.paw).translation;
          const lowerAim=limbAim(movedPaw.map((v,k)=>v-movedElbow[k]) as Vec3,reach.map((v,k)=>v-movedElbow[k]) as Vec3);
          const lower=transformManager.getTransform(leg.lower),pivot=lower.translation;
          transformManager.setTransform(leg.lower,lower.translate(pivot.map(v=>-v) as Vec3)
            .rotate(lowerAim.angle,tailParentAxis(lowerAim.axis,transformManager.getWorldTransform(leg.upper).data)).translate(pivot));
          for(const column of [4,0]) {
            const current=transformManager.getWorldTransform(leg.paw).data;
            const padAim=limbAim([current[column],current[column+1],current[column+2]],[sole[column],sole[column+1],sole[column+2]]);
            const pad=transformManager.getTransform(leg.paw),padOrigin=pad.translation;
            transformManager.setTransform(leg.paw,pad.translate(padOrigin.map(v=>-v) as Vec3)
              .rotate(padAim.angle,tailParentAxis(padAim.axis,transformManager.getWorldTransform(leg.lower).data)).translate(padOrigin));
          }
        }
      }
    }
    const looseToy=floorToy?.value;
    const floorTarget=looseToy?.instanceId===request.travel?.playTargetId?looseToy:undefined;
    const pawTarget = request.travel?.plantPlay ? plantLeaf?.value : request.travel?.treePlay ? hangingBall?.value : floorTarget?.position;
    const targetRadius=floorTarget?.radius ?? request.travel?.pawTargetRadius ?? 0;
    if(frameState.playId!==request.id || time<frameState.playTime || segment.name!=='batToy')frameState.playTargets=[null,null];
    frameState.playId=request.id;frameState.playTime=time;
    if (segment.name === 'batToy' && !posingFeet && turnPhase===undefined && !request.reduceMotion) {
      const phase = time / clip.duration;
      for (let i = 0; i < frontLegs.length; i++) {
        const leg = frontLegs[i];
        const swat=pawReachWeight(phase,i);
        if(swat<=0){frameState.playTargets[i]=null;continue;}
        if(!pawTarget && !frameState.playTargets[i])continue;
        const shoulder = transformManager.getWorldTransform(leg.upper).translation;
        const elbow = transformManager.getWorldTransform(leg.lower).translation;
        const paw = transformManager.getWorldTransform(leg.paw).translation;
        // Commit each swat to a surface point. A moving toy can escape the
        // paw; the arm must not chase it during recovery.
        const contact=frameState.playTargets[i] ?? pawSurfaceTarget(shoulder,elbow,paw,pawTarget!,targetRadius,scale);
        frameState.playTargets[i]=contact;
        const reach = paw.map((v, k) => v + (contact[k] - v) * swat) as Vec3;
        const sole=transformManager.getWorldTransform(leg.paw).data;
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
        // Keep the authored wrist curl as the arm reaches, instead of letting
        // the two IK rotations roll the pad sideways through the object.
        for(const column of [4,0]) {
          const current=transformManager.getWorldTransform(leg.paw).data;
          const aim=limbAim([current[column],current[column+1],current[column+2]],[sole[column],sole[column+1],sole[column+2]]);
          const local=transformManager.getTransform(leg.paw),pivot=local.translation;
          transformManager.setTransform(leg.paw,local.translate(pivot.map(v=>-v) as Vec3)
            .rotate(aim.angle,tailParentAxis(aim.axis,transformManager.getWorldTransform(leg.lower).data)).translate(pivot));
        }
      }
    }
    if (pawPositions) pawPositions.value = !request.reduceMotion
      ? frontLegs.map(leg => transformManager.getWorldTransform(leg.paw).translation) : [];
    if(request.reduceMotion){frameState.restExpressionWeight=0;frameState.attentionYaw=0;frameState.attentionPitch=0;frameState.earYaw=0;frameState.earPitch=[0,0];frameState.travelHead=0;frameState.tailTurnRate=0;frameState.tailYaw=[0,0,0,0];frameState.tailPitch=[0,0,0,0];}
    if(!request.reduceMotion && turningRig) {
      const travelBlend=1-Math.exp(-deltaSeconds*10);
      const travelGaze=walking&&!posingFeet&&!crawling&&gazeAhead
        ? catTravelGaze(frameState.position,frameState.heading,gazeAhead,scale) : 0;
      frameState.travelHead+=(travelGaze-frameState.travelHead)*travelBlend;
      const headingRate=deltaSeconds>0?Math.atan2(Math.sin(frameState.heading-previousHeading),Math.cos(frameState.heading-previousHeading))/deltaSeconds:frameState.tailTurnRate;
      frameState.tailTurnRate+=(Math.max(-4,Math.min(4,headingRate))-frameState.tailTurnRate)*travelBlend;
      // Let the final stride settle before idle gestures take over.
      frameState.restExpressionWeight+=((resting?1:0)-frameState.restExpressionWeight)*(1-Math.exp(-deltaSeconds*6));
      const rest=catRestExpression(frameState.expressionTime,frameState.elapsed);
      const idleExpressionWeight=resting||walking&&(!posingFeet||launching&&!frameState.launchFromLanding)&&!crawling?frameState.restExpressionWeight:0;
      const cycle=Math.floor(frameState.expressionTime/7.3);
      if(resting && cycle!==frameState.lookCycle) {
        frameState.lookCycle=cycle;
        const choices:Vec3[]=[];
        for(const object of request.world?.objects ?? []) {
          if(!object.movable && !/plant|window|yarn|ball|toy-/i.test(object.modelId))continue;
          const dx=object.position[0]-frameState.position[0],dz=object.position[2]-frameState.position[2];
          const angle=Math.atan2(Math.sin(Math.atan2(dx,dz)-frameState.heading),Math.cos(Math.atan2(dx,dz)-frameState.heading));
          if(Math.hypot(dx,dz)<.4*scale || Math.abs(angle)>.7)continue;
          choices.push([object.position[0],Math.min(object.max[1],object.position[1]+.7*scale),object.position[2]]);
        }
        frameState.lookTarget=choices.length?choices[cycle%choices.length]:undefined;
      }
      const target=frameState.lookTarget,head=transformManager.getWorldTransform(turningRig.head);
      const angle=target?Math.atan2(target[0]-head.translation[0],target[2]-head.translation[2])-frameState.heading:0;
      const noticeTarget=request.commandAttention?.target;
      const noticeAngle=noticeTarget?Math.atan2(noticeTarget[0]-head.translation[0],noticeTarget[2]-head.translation[2])-frameState.heading:0;
      const noticePitch=noticeTarget?-Math.atan2(noticeTarget[1]-head.translation[1],Math.max(.1*scale,Math.hypot(noticeTarget[0]-head.translation[0],noticeTarget[2]-head.translation[2]))):0;
      const notice=catCommandResponse(frameState.noticeTime,Math.atan2(Math.sin(noticeAngle),Math.cos(noticeAngle)),noticePitch);
      // Airborne balance, contact performances and supported turns own the
      // head. Ears can acknowledge a queued tap without disturbing those poses.
      const noticeHead=!posingFeet && !crawling && (resting || walking || hopPhase!==undefined && hopPhase>=CAT_LANDING_WALK_PHASE);
      const yaw=noticeHead&&notice.look>0?notice.yaw:resting?Math.max(-.16,Math.min(.16,Math.atan2(Math.sin(angle),Math.cos(angle))))*rest.look:0;
      const pitch=noticeHead&&notice.look>0?notice.pitch:resting&&target?Math.max(-.07,Math.min(.07,-Math.atan2(target[1]-head.translation[1],Math.hypot(target[0]-head.translation[0],target[2]-head.translation[2]))))*rest.look:0;
      const blend=1-Math.exp(-deltaSeconds*(noticeHead&&frameState.noticeTime<1.6?8:resting?7:35));
      frameState.attentionYaw+=(yaw-frameState.attentionYaw)*blend;
      frameState.attentionPitch+=(pitch-frameState.attentionPitch)*blend;
      const jump=hopPhase!==undefined&&expressionTo?catJumpExpression(hopPhase,expressionFrom,expressionTo,scale):undefined;
      const side:Vec3=[Math.cos(frameState.heading),0,-Math.sin(frameState.heading)];
      // Supported turns already capture the rendered head's initial yaw.
      // Applying the attention yaw again would double that first pose.
      for(const [angle,axis]of [[posingFeet?0:frameState.attentionYaw+frameState.travelHead,[0,1,0]],
        [frameState.attentionPitch+(jump?.headPitch??0),side],
        [rest.tilt*idleExpressionWeight,[Math.sin(frameState.heading),0,Math.cos(frameState.heading)]]] as [number,Vec3][]) {
        if(Math.abs(angle)<1e-5)continue;
        const local=transformManager.getTransform(turningRig.head),origin=local.translation;
        transformManager.setTransform(turningRig.head,local.translate(origin.map(v=>-v) as Vec3)
          .rotate(angle,tailParentAxis(axis,transformManager.getWorldTransform(turningRig.neck).data)).translate(origin));
      }
      const reaction=catEarReaction(frameState.expressionTime,target?Math.atan2(Math.sin(angle),Math.cos(angle)):0,
        steppingTurn?Math.max(-.22,Math.min(.22,frameState.turnAngle))*(1-(turnPhase??1)):0,
        walking?frameState.gaitSpeed:0,resting);
      const earBlend=1-Math.exp(-deltaSeconds*14);
      frameState.earYaw+=(Math.max(-.35,Math.min(.35,reaction.yaw+notice.earYaw))-frameState.earYaw)*earBlend;
      for(let i=0;i<ears.length;i++) {
        frameState.earPitch[i]+=((i?reaction.right:reaction.left)-notice.earLift-frameState.earPitch[i])*earBlend;
        const joint=ears[i];
        for(const [angle,axis]of [[frameState.earYaw,[0,1,0]],[frameState.earPitch[i],side]] as [number,Vec3][]) {
          if(Math.abs(angle)<1e-5)continue;
          const local=transformManager.getTransform(joint),origin=local.translation;
          transformManager.setTransform(joint,local.translate(origin.map(v=>-v) as Vec3)
            .rotate(angle,tailParentAxis(axis,transformManager.getWorldTransform(turningRig.head).data)).translate(origin));
        }
      }
      const tailMotion=catTravelTail(frameState.distance/(frameState.walkStride*scale)+frameState.walkOffset,
        walking&&!crawling?frameState.gaitSpeed:0,walking?frameState.tailTurnRate:0);
      for(let i=0;i<4;i++) {
        const tailBlend=1-Math.exp(-deltaSeconds*(settling?6-i:10));
        frameState.tailYaw[i]+=(tailMotion.yaw[i]-frameState.tailYaw[i])*tailBlend;
        frameState.tailPitch[i]+=(tailMotion.pitch[i]-frameState.tailPitch[i])*tailBlend;
      }
      if(tail)for(const [index,angle,axis]of [
        ...frameState.tailYaw.map((angle,index)=>[index,angle,[0,1,0]]),
        ...frameState.tailPitch.map((angle,index)=>[index,angle,side]),
        [0,frameState.spinePose.tailFollowYaw,[0,1,0]],
        [0,frameState.spinePose.tailFollowPitch,side],
        [2,frameState.spinePose.tailTipYaw*.65,[0,1,0]],
        [3,frameState.spinePose.tailTipYaw*.35,[0,1,0]],
        [2,frameState.spinePose.tailTipPitch*.65,side],
        [3,frameState.spinePose.tailTipPitch*.35,side],
        [0,jump?.tailBase??0,side],[2,jump?.tailTip??(rest.tailTip*idleExpressionWeight),jump?side:[0,1,0]],
        [3,jump?.tailCurl??0,side],
      ] as [number,number,Vec3][]) {
        if(Math.abs(angle)<1e-5)continue;
        const joint=tail.joints[index],parent=index?tail.joints[index-1]:tail.parent;
        const local=transformManager.getTransform(joint),origin=local.translation;
        transformManager.setTransform(joint,local.translate(origin.map(v=>-v) as Vec3)
          .rotate(angle,tailParentAxis(axis,transformManager.getWorldTransform(parent).data)).translate(origin));
      }
    }
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
      notify('roomComplete', { key: request.activityKey, position: [frameState.position[0], frameState.position[1], frameState.position[2]],
        motion:request.travel.through&&!request.reduceMotion ? {
          speed:!frameState.routeLegs.length && frameState.routeCost>0 ? frameState.routeEndRate*frameState.routeCost/((frameState.routePaces[frameState.routePaces.length-1]??1)*scale) : frameState.gaitSpeed,phase:frameState.distance/(frameState.walkStride*scale)+frameState.walkOffset,
          gait:frameState.gait,tailYaw:frameState.tailYaw.map(v=>v),tailPitch:frameState.tailPitch.map(v=>v),
          spinePose:{...frameState.spinePose},
        } : undefined });
    }
    state.value = frameState;
  }, [animationTimeValue, animator, clips, command, ears, eatingProps, entity, frontLegs, hangingBall, floorToy, initialPosition, notify, pawPositions, plantLeaf, positionValue, rockingMotion, state, supportingPaws, tail, transformManager, turningRig]);
  RenderCallbackContext.useRenderCallback(render, [render]);
  return null;
}
