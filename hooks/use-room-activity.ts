import type { CatCommandAttention } from '@/utils/native-cat-expression';
import type { CatTravelMotion } from '@/utils/native-cat-locomotion';
import type { WorldPeriod } from '@/utils/world-clock';
import type { HomeRoomId } from "@/constants/home-rooms";
import { FLOOR_Y, nativeRoomEdge, catFloorPoint, catScreenPoint, hasNativeArrived, mergeNativeRoomWorld, pathLength, prepareNativeStep, updateNativeObjectPosition, type Vec3 } from "@/utils/native-room-world";
import { useAnimationActivity } from "@/hooks/use-animation-activity";
import { getCatJumpMotion, getCatWalkMotion, isCatJump, isCatWalk } from "@/constants/cat-room-motion";
import {
  buildRoomActivity,
  buildRoomReturn,
  buildRoomExit,
  buildRoomEntry,
  continueFurnitureExploration,
  routeToSofa,
  roomOffsetToPoint,
  roomActivityStepKey,
  roomIdleDelay,
  type RoomActivityKind,
  type RoomActivityOptions,
  type RoomActivityPlan,
} from "@/utils/room-activities";
import { useCallback, useEffect, useRef, useState } from "react";
import { cancelAnimation, Easing, useSharedValue, withDelay, withSequence, withTiming, type SharedValue } from "react-native-reanimated";

type ActivityState = { plan: RoomActivityPlan; stepIndex: number; startedAt: number };
export type BlockedRoomActivity = { kind: RoomActivityPlan['kind']; instanceId?: string };
type ActivityRequest = { id: number; kind: RoomActivityKind | "returnHome" | "stop"; instanceId?: string; interactionAt?: number; ambientPeriod?: WorldPeriod };

/** One scheduler owns idle choices, commands, and the visible journey home. */
export function useRoomActivity(
  options: RoomActivityOptions,
  enabled: boolean,
  lastInteractionAt: number | undefined,
  petX: SharedValue<number>,
  petY: SharedValue<number>,
  onDoorArrival?: (instanceId: string, motion?: CatTravelMotion) => void,
  onFeed?: () => void,
  onRoomArrival?: (roomId: HomeRoomId, ambientPeriod?: WorldPeriod, motion?: CatTravelMotion) => void,
  roomVisible = true,
  preservePositionWhenDisabled = false,
  onStopped?: () => void,
  onCompleted?: (kind: RoomActivityKind, instanceId?: string) => void,
  onBlocked?: (failure: BlockedRoomActivity) => void,
) {
  const { active: screenActive, reduceMotion } = useAnimationActivity();
  const wasRoomVisible = useRef(roomVisible);
  const hiddenActivity = useRef(false);
  const scale = useSharedValue(1);
  const facing = useSharedValue(1);
  const objectX = useSharedValue(0);
  const objectY = useSharedValue(0);
  const objectRotation = useSharedValue(0);
  const turn = useRef(0);
  const napTurn = useRef(0);
  const nativeHeight = useRef(FLOOR_Y);
  const nativePosition = useRef<Vec3 | undefined>(undefined);
  const nativeElapsed = useRef(0);
  const running = useRef<ActivityState | null>(null);
  const updateNativeHeight = useCallback((position: readonly number[], elapsed?: number, activityKey?: string) => {
    // A new step can start before React publishes it to the drawing thread.
    // Reports still arriving from the old step cannot set its resume clock.
    if (activityKey && (!running.current || roomActivityStepKey(running.current) !== activityKey)) return;
    nativeHeight.current = position[1];
    nativePosition.current = [position[0], position[1], position[2]];
    if (elapsed !== undefined) nativeElapsed.current = elapsed;
  }, []);
  const exitMotion = useRef<CatTravelMotion | undefined>(undefined);
  const nativeAdvance = useRef<((key: string, position: Vec3, motion?: CatTravelMotion) => void) | null>(null);
  const completeNativeStep = useCallback((key: string, position: Vec3, motion?: CatTravelMotion) => nativeAdvance.current?.(key, position, motion), []);
  const queuedPlan = useRef<RoomActivityPlan | null>(null);
  const latestOptions = useRef(options);
  const liveWorld = useRef(options.nativeWorld);
  const [navigationVersion, setNavigationVersion] = useState(0);
  const wasActive = useRef(screenActive && roomVisible);
  useEffect(() => {
    const previousWorld = latestOptions.current.nativeWorld;
    latestOptions.current = options;
    if (previousWorld !== options.nativeWorld) liveWorld.current = options.nativeWorld && previousWorld && liveWorld.current
      ? mergeNativeRoomWorld(options.nativeWorld, previousWorld, liveWorld.current) : options.nativeWorld;
  }, [options]);
  const updateObjectPosition = useCallback((id: string, center: Vec3) => {
    const world = liveWorld.current;
    if (!world) return;
    const updated = updateNativeObjectPosition(world, id, center);
    if (updated === world) return;
    liveWorld.current = updated;
    const current = running.current;
    if (current && isCatWalk(current.plan.steps[current.stepIndex].animation)
      && (current.plan.targetInstanceId === id || updated.objects.find(o => o.instanceId === id)?.solid))
      setNavigationVersion(value => value + 1);
  }, []);
  const [commandAttention, setCommandAttention] = useState<CatCommandAttention | undefined>(undefined);
  const attentionSequence = useRef(0);
  const pendingCommand = useRef<Omit<ActivityRequest, "id"> | null>(null);
  const doorArrival = useRef(onDoorArrival);
  const stopComplete = useRef(onStopped);
  const feedComplete = useRef(onFeed);
  const activityComplete = useRef(onCompleted);
  const activityBlocked = useRef(onBlocked);
  const roomArrival = useRef(onRoomArrival);
  useEffect(() => {
    doorArrival.current = onDoorArrival;
    stopComplete.current = onStopped;
    feedComplete.current = onFeed;
    activityComplete.current = onCompleted;
    activityBlocked.current = onBlocked;
    roomArrival.current = onRoomArrival;
  }, [onDoorArrival, onStopped, onFeed, onRoomArrival, onCompleted, onBlocked]);
  const previousInteraction = useRef(lastInteractionAt);
  const handledRequest = useRef(0);
  const handledEntry = useRef<number | null>(null);
  const [request, setRequest] = useState<ActivityRequest | null>(null);
  const [state, setState] = useState<ActivityState | null>(null);
  const [blockedActivity, setBlockedActivity] = useState<BlockedRoomActivity | null>(null);
  const failureReported = useRef(false);
  const clearBlockedActivity = useCallback(() => setBlockedActivity(null), []);
  // Game activities continue while browsing. Only rendering is paused.
  const activity = enabled ? state : null;
  const requestActivity = useCallback((kind: ActivityRequest["kind"], instanceId?: string, interactionAt?: number, ambientPeriod?: WorldPeriod) => {
    setBlockedActivity(null);
    const target=instanceId && liveWorld.current?.objects.find(object=>object.instanceId===instanceId);
    if(target && !ambientPeriod && roomVisible && enabled && screenActive && !reduceMotion && kind!=='stop' && kind!=='returnHome') {
      setCommandAttention({id:++attentionSequence.current,target:[...(target.seat??target.position)],issuedAt:Date.now()});
    } else setCommandAttention(undefined);
    const current = running.current;
    if (current && (isCatJump(current.plan.steps[current.stepIndex].animation)
      || current.plan.steps[current.stepIndex].native?.legs?.some(leg => leg.kind === 'hop' || leg.animation === 'crawl')
      || current.plan.steps[current.stepIndex].native?.brushSide !== undefined
      || current.plan.steps[current.stepIndex].enteringRoom && (reduceMotion || latestOptions.current.nativeStepCompletion===false))) {
      pendingCommand.current = { kind, instanceId, interactionAt, ambientPeriod };
      return;
    }
    setRequest(current => ({ id: (current?.id ?? 0) + 1, kind, instanceId, interactionAt, ambientPeriod }));
  }, [enabled, reduceMotion, roomVisible, screenActive]);
  const startActivity = useCallback((kind: RoomActivityKind, instanceId?: string, interactionAt?: number, ambientPeriod?: WorldPeriod) => requestActivity(kind, instanceId, interactionAt, ambientPeriod), [requestActivity]);
  const stopActivity = useCallback(() => requestActivity("stop"), [requestActivity]);
  useEffect(() => {
    if (options.period === undefined || options.period === 'night' || running.current?.plan.ambientPeriod !== 'night') return;
    if (pendingCommand.current || request && request.id !== handledRequest.current) return;
    // Normal command routing stands up and jumps down; an airborne cat lands first.
    requestActivity('returnHome');
  }, [options.period, request, requestActivity]);
  const returnHome = useCallback(() => {
    if (!activity || activity.plan.kind === "returnHome") return;
    requestActivity("returnHome");
  }, [activity, requestActivity]);

  useEffect(() => {
    if (previousInteraction.current === lastInteractionAt) return;
    previousInteraction.current = lastInteractionAt;
    // Taps in another room do not interrupt the cat's activity here.
    if (!roomVisible) return;
    // Saving a room arrival records an interaction. Let its entry finish.
    if ((options.entry && options.entry.id !== handledEntry.current)
      || running.current?.plan.steps[running.current.stepIndex].enteringRoom) return;
    // Context state can publish the command's interaction after its request has
    // already started. Match the timestamp so that delayed render cannot cancel it.
    if (lastInteractionAt === request?.interactionAt || lastInteractionAt === pendingCommand.current?.interactionAt) return;
    // Menu taps also record an interaction. Keep their explicit command,
    // including one queued during a jump, instead of replacing it with home.
    if ((request && request.id !== handledRequest.current) || pendingCommand.current) return;
    requestActivity("returnHome");
  }, [lastInteractionAt, options.entry, request, requestActivity, roomVisible]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    // Scheduler refs are read after commit. They must not determine render
    // output or dependency arrays, which React Compiler cannot track.
    const pendingEntry = !reduceMotion && options.nativeStepCompletion !== false
      && options.entry && options.entry.id !== handledEntry.current;
    const continueActivity = enabled && (pendingEntry || running.current !== null || queuedPlan.current !== null
      || request !== null && request.id !== handledRequest.current);
    const backgroundActivity = !roomVisible && continueActivity;
    const active = screenActive && (roomVisible || continueActivity);
    const resumingRoom = !wasRoomVisible.current && roomVisible;
    const wasHiddenActivity = hiddenActivity.current;
    hiddenActivity.current = backgroundActivity;
    wasRoomVisible.current = roomVisible;
    const continuing = wasActive.current && active;
    const resumingActivity = !wasActive.current && active;
    wasActive.current = active;
    const home = roomOffsetToPoint(options.homeOffset, options.width, options.height, options.petSize);
    const runStep = (plan: RoomActivityPlan, stepIndex: number, elapsed = 0, replanned = false) => {
      if (stopped) return;
      let step = plan.steps[stepIndex];
      if (!step) {
        const completed = running.current;
        running.current = null;
        facing.set(1);
        setState(null);
        if (plan.stopForEditing) { stopComplete.current?.(); return; }
        if (plan.kind === "doorTravel" && plan.targetInstanceId && !completed?.plan.steps.at(-1)?.native?.blocked) {
          doorArrival.current?.(plan.targetInstanceId,exitMotion.current);
          return;
        }
        if (plan.kind === "roomTravel" && plan.destination && !completed?.plan.steps.some(step => step.native?.blocked)) {
          if (plan.ambientPeriod !== 'night' || latestOptions.current.period === 'night')
            roomArrival.current?.(plan.destination, plan.ambientPeriod,exitMotion.current);
          return;
        }
        if (plan.kind === "bowlEat" && !completed?.plan.steps.some(step => step.native?.blocked)) feedComplete.current?.();
        if (completed && plan.kind !== "returnHome" && !completed.plan.steps.some(step => step.native?.blocked)) activityComplete.current?.(plan.kind, plan.targetInstanceId);
        if (roomVisible) timer = setTimeout(startIdle, roomIdleDelay(latestOptions.current) + (turn.current % 5) * 700);
        return;
      }
      const room = latestOptions.current;
      if (liveWorld.current) {
        step = step.native?.blocked || step.native && (reduceMotion || elapsed && (isCatJump(step.animation) || step.native.legs?.length || step.native.brushSide !== undefined)) ? { ...step } :
          prepareNativeStep(plan, step, room.nativeStepCompletion && nativePosition.current
            ? catScreenPoint(nativePosition.current, liveWorld.current) : { x: petX.get(), y: petY.get() }, liveWorld.current, nativeHeight.current, { x: objectX.get(), y: objectY.get() });
        step.native = { ...step.native!, elapsed, replanned, walkAfterLanding: !!step.native?.jump && isCatWalk(plan.steps[stepIndex+1]?.animation), awaitCompletion: roomVisible && room.nativeStepCompletion && !step.hold };
        const nextStep=plan.steps[stepIndex+1];
        if(step.native.walkAfterLanding && nextStep && !reduceMotion) {
          const landing=step.native.path[step.native.path.length-1];
          const next=prepareNativeStep(plan,nextStep,catScreenPoint(landing,liveWorld.current),liveWorld.current,landing[1]);
          if(!next.native.blocked)step.native.landingLook=next.native.path.find(point=>
            Math.hypot(point[0]-landing[0],point[2]-landing[2])>.25*liveWorld.current!.catScale);
        }
        nativeElapsed.current = elapsed;
        if(step.enteringRoom && !step.entryFromCurrent && !elapsed && !reduceMotion) {
          nativePosition.current=step.native.path[0];nativeHeight.current=nativePosition.current[1];
          const edge=catScreenPoint(nativePosition.current,liveWorld.current);petX.set(edge.x);petY.set(edge.y);
        }
        if (step.native?.blocked) {
          if (plan.userRequested && !failureReported.current && !pendingCommand.current) {
            failureReported.current = true;
            const failure = { kind: plan.kind, instanceId: plan.targetInstanceId };
            setBlockedActivity(failure);
            activityBlocked.current?.(failure);
          }
          plan = { ...plan, steps: plan.steps.slice(0, stepIndex + 1) };
          // A failed interaction cannot hold a sleep/use pose at the floor.
          const position = room.nativeStepCompletion && nativePosition.current ? nativePosition.current : step.native.path[0];
          step = { ...step, position: catScreenPoint(position, liveWorld.current), animation: "idle", mood: "idle", hold: false,
            sofaApproach: undefined, bedPhase: undefined, bathroomPhase: undefined, durationMs: 200, moveMs: 0,
            native: { ...step.native, path: [position], distance: 0, duration: .2, jump: false, awaitCompletion: roomVisible && room.nativeStepCompletion } };
        }
        if (reduceMotion) step.native = { ...step.native!, path: [step.native!.path.at(-1)!], legs: undefined, distance: 0, jump: false };
      }
      const duration = reduceMotion ? 0 : step.moveMs ?? 0;
      let visibleStep = step;
      if (!reduceMotion && isCatWalk(step.animation)) {
        const motion = getCatWalkMotion({ x: petX.get(), y: petY.get() }, step.position, room.petSize);
        facing.set(motion.facing);
        visibleStep = { ...step, animation: motion.animation, animationFps: Math.max(12, Math.min(60, 24 * motion.cycles / Math.max(.1, duration / 1000))) };
      }
      const timing = { duration, easing: isCatWalk(step.animation) ? Easing.linear : Easing.inOut(Easing.quad) };
      if (!roomVisible) {
        // Hidden activities use step deadlines, with no drawing-thread movement.
      } else if (liveWorld.current && room.nativeStepCompletion !== false) {
        // Filament owns the visible motion; these values are only native UI anchors.
      } else if (!reduceMotion && isCatJump(step.animation)) {
        facing.set(1);
        const jump = getCatJumpMotion(petY.get(), step.position.y, room.petSize, duration);
        // Keep the paws planted during the crouch, then rise and fall onto
        // the cushion/floor. Landing recovery happens before walking/resting.
        petX.set(withDelay(jump.prepareMs, withTiming(step.position.x, { duration: jump.flightMs, easing: Easing.linear })));
        petY.set(withDelay(jump.prepareMs, withSequence(
          withTiming(jump.apexY, { duration: jump.riseMs, easing: Easing.out(Easing.quad) }),
          withTiming(step.position.y, { duration: jump.fallMs, easing: Easing.in(Easing.quad) }),
        )));
      } else {
        petX.set(withTiming(step.position.x, timing));
        petY.set(withTiming(step.position.y, timing));
      }
      if (step.objectPosition && (!liveWorld.current || room.nativeStepCompletion === false)) {
        // The mouse gets a head start; balls/yarn roll just after a paw contact.
        const objectDuration = step.objectMoveMs ?? (plan.kind === "mouseChase" ? duration * 0.6 : Math.min(duration, 700));
        const delay = step.objectDelayMs ?? 0;
        objectX.set(withDelay(delay, withTiming(step.objectPosition.x, { duration: objectDuration })));
        objectY.set(withDelay(delay, withTiming(step.objectPosition.y, { duration: objectDuration })));
        objectRotation.set(withDelay(delay, withTiming(step.objectRotation ?? 0, { duration: objectDuration })));
      }
      if (reduceMotion) {
        petX.set(step.position.x); petY.set(step.position.y); scale.set(1);
        if (step.objectPosition) { objectX.set(step.objectPosition.x); objectY.set(step.objectPosition.y); }
        visibleStep = { ...step, animation: undefined };
      }
      const next = { plan: { ...plan, steps: plan.steps.map((item, index) => index === stepIndex ? visibleStep : item) }, stepIndex, startedAt: Date.now() - elapsed * 1000 };
      running.current = next;
      setState(next);
      const advanceStep = () => {
        if ((!roomVisible || room.nativeStepCompletion === false) && step.native) {
          nativePosition.current = step.native.path.at(-1)!;
          nativeHeight.current = nativePosition.current[1];
          petX.set(step.position.x); petY.set(step.position.y);
        }
        const kind = pendingCommand.current;
        if (kind) {
          pendingCommand.current = null;
          // Continue from the landed or entered pose. A queued touch after
          // jump-down must not start a second jump off the sofa.
          const landedStep = { ...step, animation: undefined,
            bathroomPhase: step.animation === "jumpOff" ? undefined : step.bathroomPhase,
            sofaApproach: step.animation === "jumpOff" && !step.jumpFromInstanceId ? undefined : step.sofaApproach };
          running.current = { plan: { ...next.plan, steps: next.plan.steps.map((item, index) => index === stepIndex ? landedStep : item) }, stepIndex, startedAt: Date.now() };
          setRequest(current => ({ id: (current?.id ?? 0) + 1, ...kind }));
        } else {
          const exploration = !reduceMotion && roomVisible && nativePosition.current
            ? continueFurnitureExploration({ ...latestOptions.current, nativeWorld: liveWorld.current }, next,
              nativePosition.current, turn.current) : null;
          if (exploration) { turn.current++; startPlan(exploration); }
          else runStep(next.plan, stepIndex + 1);
        }
      };
      nativeAdvance.current = step.native?.awaitCompletion ? (key, position, motion) => {
        if (stopped || !running.current || roomActivityStepKey(running.current) !== key) return;
        if (!hasNativeArrived(position, step.native!.path.at(-1)!)) return;
        // Use the exact rendered arrival, rather than the last throttled UI anchor.
        const point = catScreenPoint(position, liveWorld.current!);
        petX.set(point.x); petY.set(point.y); nativeHeight.current = position[1];
        // Reanimated writes from JS reach the UI thread asynchronously. Keep the
        // rendered arrival synchronously so the next step cannot read the old home.
        nativePosition.current = position;
        exitMotion.current=motion;
        nativeAdvance.current = null;
        advanceStep();
      } : null;
      if (!step.hold && !step.native?.awaitCompletion)
        timer = setTimeout(advanceStep, reduceMotion ? 600 : Math.max(0, step.durationMs - elapsed * 1000));
    };
    const startPlan = (plan: RoomActivityPlan) => {
      queuedPlan.current = null;
      exitMotion.current=undefined;
      if (plan.ambientPeriod && plan.ambientPeriod !== latestOptions.current.period) {
        const current = running.current;
        if (current) runStep(buildRoomReturn(latestOptions.current, current.plan, current.stepIndex,
          { x: petX.get(), y: petY.get() }), 0);
        else { running.current = null; setState(null); }
        return;
      }
      if (plan.objectStart) {
        objectX.set(plan.objectStart.x);
        objectY.set(plan.objectStart.y);
        objectRotation.set(0);
      }
      runStep(plan, 0);
    };
    const planActivity = (room: RoomActivityOptions, kind?: RoomActivityKind, instanceId?: string) => {
      const plan = buildRoomActivity({ ...room, napTurn: napTurn.current }, turn.current++, kind, instanceId);
      if (plan?.steps.some(step => step.animation === 'curlSleep')) {
        const current = running.current, step = current?.plan.steps[current.stepIndex];
        const repeating = current?.plan.kind === plan.kind && current.plan.targetInstanceId === plan.targetInstanceId
          && (step?.animation === 'curlSleep' || step?.animation === 'curlUp' && !step.reverse);
        if (!repeating) napTurn.current++;
      }
      return plan;
    };
    const startIdle = () => {
      if (reduceMotion || !roomVisible) return;
      const plan = planActivity(latestOptions.current);
      if (plan) startPlan(plan);
      else timer = setTimeout(startIdle, roomIdleDelay(latestOptions.current) + (turn.current % 5) * 700);
    };
    const current = running.current;
    if (!active || !roomVisible && !pendingEntry && !current && !queuedPlan.current
      && !(request && request.id !== handledRequest.current)) {
      // Cleanup stops travel and timers. Preserve the current pose so focus
      // can resume with a visible journey home, including getting off a sofa.
      return;
    }
    if (!enabled) {
      running.current = null;
      queuedPlan.current = null;
      pendingCommand.current = null;
      if (!preservePositionWhenDisabled) { petX.set(home.x); petY.set(home.y); }
      scale.set(1); facing.set(1);
      if (request) handledRequest.current = request.id;
      timer = setTimeout(() => { setState(null); setBlockedActivity(null); }, 0);
    } else {
      const entry = options.entry && handledEntry.current !== options.entry.id ? buildRoomEntry(options) : null;
      if (entry) {
        setBlockedActivity(null);
        handledEntry.current = options.entry!.id;
        if (request && request.id !== handledRequest.current && !reduceMotion && options.nativeStepCompletion!==false
          && request.kind!=='returnHome' && request.kind!=='stop') {
          const edgeOptions=liveWorld.current ? {...options,nativeWorld:{...liveWorld.current,
            home:nativeRoomEdge(liveWorld.current,options.entry!.direction===1?-1:1)}} : options;
          const task=planActivity(edgeOptions,request.kind,request.instanceId);
          if(task && isCatWalk(task.steps[0]?.animation)) {
            handledRequest.current=request.id;pendingCommand.current=null;
            startPlan({...task,userRequested:!request.ambientPeriod,ambientPeriod:request.ambientPeriod,
              steps:task.steps.map((step,index)=>index?step:{...step,enteringRoom:true,
                travelDirection:options.entry!.direction,entryMotion:options.entry!.motion})});
            return () => {stopped=true;nativeAdvance.current=null;clearTimeout(timer);};
          }
        }
        if (request && request.id !== handledRequest.current) {
          handledRequest.current = request.id;
          pendingCommand.current = { kind: request.kind, instanceId: request.instanceId, interactionAt: request.interactionAt, ambientPeriod: request.ambientPeriod };
        }
        startPlan(entry);
        return () => { stopped = true; nativeAdvance.current = null; clearTimeout(timer); };
      }
      const newRequest = request && request.id !== handledRequest.current ? request : null;
      if (newRequest) handledRequest.current = newRequest.id;
      if (newRequest) { queuedPlan.current = null; failureReported.current = false; }
      const position = options.nativeStepCompletion && nativePosition.current && liveWorld.current
        ? catScreenPoint(nativePosition.current, liveWorld.current) : { x: petX.get(), y: petY.get() };
      const returning = current ? buildRoomReturn(options, current.plan, current.stepIndex, position) : null;
      const sofaCommand = newRequest?.kind === "sofaSit" || newRequest?.kind === "sofaSleep";
      const commandOptions = liveWorld.current ? { ...options, nativeWorld: { ...liveWorld.current,
        home: catFloorPoint(position, liveWorld.current, FLOOR_Y) } } : options;
      let next = newRequest && (!newRequest.ambientPeriod || newRequest.ambientPeriod === options.period)
        && newRequest.kind !== "returnHome" && newRequest.kind !== "stop"
        ? planActivity(commandOptions, newRequest.kind, newRequest.instanceId ?? (sofaCommand ? current?.plan.targetInstanceId : undefined)) : null;
      if (next) next = { ...next, userRequested: !newRequest?.ambientPeriod };
      // A cupboard/chair exit can land inside its coarse floor bounds. Keep
      // the detailed collision geometry for the next journey in this room.
      if (next && current?.plan.steps[current.stepIndex].kitchenNavigation)
        next = { ...next, steps: next.steps.map(step => ({ ...step, kitchenNavigation: true })) };
      if (next && newRequest?.ambientPeriod) next = { ...next, ambientPeriod: newRequest.ambientPeriod };
      // A refresh can cancel the start timer after a command was accepted.
      // Start that queued plan before considering the previous activity.
      if (!newRequest && queuedPlan.current) {
        const queued = queuedPlan.current;
        timer = setTimeout(() => startPlan(queued), 0);
      } else if (current && !newRequest && liveWorld.current && (continuing || resumingRoom || resumingActivity)) {
        const step = current.plan.steps[current.stepIndex];
        const target = liveWorld.current.objects.find(o => o.instanceId === current.plan.targetInstanceId);
        if ((!target && current.plan.targetInstanceId && current.plan.kind !== 'returnHome'
          || current.plan.kind === 'fridgeInvestigate' && !target?.fridgeOpen
          || (current.plan.kind === 'drawerHide' || current.plan.kind === 'cupboardHide') && !target?.opened) && returning) {
          timer = setTimeout(() => runStep(returning, 0), 0);
        } else if (step.animation === 'eating' && target && step.native?.targetPosition
          && pathLength([target.position, step.native.targetPosition]) > .05) {
          const meal = planActivity(options, 'bowlEat', target.instanceId);
          if (meal) timer = setTimeout(() => startPlan(meal), 0);
        } else {
          const replanWalk = isCatWalk(step.animation) && !step.native?.legs?.length && step.native?.brushSide === undefined;
          const elapsed = wasHiddenActivity ? Math.max(0, (Date.now() - current.startedAt) / 1000)
            : replanWalk ? 0 : options.nativeStepCompletion ? nativeElapsed.current : Math.max(0, (Date.now() - current.startedAt) / 1000);
          runStep(current.plan, current.stepIndex, elapsed, Boolean(replanWalk));
        }
      } else if (newRequest?.kind === "stop") {
        const exit = current ? buildRoomExit(options, current.plan, current.stepIndex, position) : { kind: "returnHome" as const, steps: [] };
        timer = setTimeout(() => startPlan({ ...exit, stopForEditing: true }), 0);
      } else if (next) {
        const entering=current?.plan.steps[current.stepIndex];
        if(entering?.enteringRoom && !reduceMotion && options.nativeStepCompletion!==false && isCatWalk(next.steps[0]?.animation)) {
          next={...next,steps:next.steps.map((step,index)=>index?step:{...step,enteringRoom:true,
            entryFromCurrent:true,travelDirection:entering.travelDirection,entryMotion:options.entry?.motion})};
        }
        const plan = next.sofaApproach && next.steps[1]?.animation === 'jumpOn'
          ? routeToSofa({ ...options,nativeWorld:liveWorld.current ?? undefined }, next, position, current,nativePosition.current ?? undefined)
          : current ? { ...next, steps: [...buildRoomExit(options, current.plan, current.stepIndex, position).steps, ...next.steps] } : next;
        queuedPlan.current = plan;
        timer = setTimeout(() => startPlan(plan), 0);
      } else if (returning) {
        timer = setTimeout(() => runStep(returning, 0), 0);
      } else {
        petX.set(home.x); petY.set(home.y); scale.set(1); facing.set(1);
        timer = setTimeout(startIdle, roomIdleDelay(options) + (turn.current % 5) * 700);
      }
    }
    return () => {
      stopped = true;
      nativeAdvance.current = null;
      clearTimeout(timer);
      for (const value of [petX, petY, scale, objectX, objectY, objectRotation]) cancelAnimation(value);
    };
  }, [screenActive, enabled, facing, navigationVersion, objectRotation, objectX, objectY, options, petX, petY, preservePositionWhenDisabled, reduceMotion, request, roomVisible, scale]);
  return { activity, commandAttention, blockedActivity, clearBlockedActivity, scale, facing, objectX, objectY, objectRotation, startActivity, returnHome, stopActivity, updateNativeHeight, updateObjectPosition, completeNativeStep };
}
