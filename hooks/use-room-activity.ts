import type { HomeRoomId } from "@/constants/home-rooms";
import { FLOOR_Y, catFloorPoint, catScreenPoint, hasNativeArrived, mergeNativeRoomWorld, pathLength, prepareNativeStep, updateNativeObjectPosition, type Vec3 } from "@/utils/native-room-world";
import { useAnimationActivity } from "@/hooks/use-animation-activity";
import { getCatJumpMotion, getCatWalkMotion, isCatJump, isCatWalk } from "@/constants/cat-room-motion";
import {
  buildRoomActivity,
  buildRoomReturn,
  buildRoomExit,
  buildRoomEntry,
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
type ActivityRequest = { id: number; kind: RoomActivityKind | "returnHome" | "stop"; instanceId?: string; interactionAt?: number };

/** One scheduler owns idle choices, commands, and the visible journey home. */
export function useRoomActivity(
  options: RoomActivityOptions,
  enabled: boolean,
  lastInteractionAt: number | undefined,
  petX: SharedValue<number>,
  petY: SharedValue<number>,
  onDoorArrival?: (instanceId: string) => void,
  onFeed?: () => void,
  onRoomArrival?: (roomId: HomeRoomId) => void,
  roomVisible = true,
  preservePositionWhenDisabled = false,
  onStopped?: () => void,
) {
  const { active: screenActive, reduceMotion } = useAnimationActivity();
  const active = screenActive && roomVisible;
  const wasRoomVisible = useRef(roomVisible);
  const roomHiddenAt = useRef<number | null>(null);
  const scale = useSharedValue(1);
  const facing = useSharedValue(1);
  const objectX = useSharedValue(0);
  const objectY = useSharedValue(0);
  const objectRotation = useSharedValue(0);
  const turn = useRef(0);
  const nativeHeight = useRef(FLOOR_Y);
  const nativePosition = useRef<Vec3 | undefined>(undefined);
  const nativeElapsed = useRef(0);
  const updateNativeHeight = useCallback((position: readonly number[], elapsed?: number) => {
    nativeHeight.current = position[1];
    nativePosition.current = [position[0], position[1], position[2]];
    if (elapsed !== undefined) nativeElapsed.current = elapsed;
  }, []);
  const nativeAdvance = useRef<((key: string, position: Vec3) => void) | null>(null);
  const completeNativeStep = useCallback((key: string, position: Vec3) => nativeAdvance.current?.(key, position), []);
  const running = useRef<ActivityState | null>(null);
  const latestOptions = useRef(options);
  const liveWorld = useRef(options.nativeWorld);
  const [navigationVersion, setNavigationVersion] = useState(0);
  const wasActive = useRef(active);
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
  const pendingCommand = useRef<Omit<ActivityRequest, "id"> | null>(null);
  const doorArrival = useRef(onDoorArrival);
  const stopComplete = useRef(onStopped);
  const feedComplete = useRef(onFeed);
  const roomArrival = useRef(onRoomArrival);
  useEffect(() => {
    doorArrival.current = onDoorArrival;
    stopComplete.current = onStopped;
    feedComplete.current = onFeed;
    roomArrival.current = onRoomArrival;
  }, [onDoorArrival, onStopped, onFeed, onRoomArrival]);
  const previousInteraction = useRef(lastInteractionAt);
  const handledRequest = useRef(0);
  const handledEntry = useRef<number | null>(null);
  const [request, setRequest] = useState<ActivityRequest | null>(null);
  const [state, setState] = useState<ActivityState | null>(null);
  // Covered screens keep the visible pose; only their clock is paused.
  const activity = enabled ? state : null;
  const requestActivity = useCallback((kind: ActivityRequest["kind"], instanceId?: string, interactionAt?: number) => {
    const current = running.current;
    if (current && isCatJump(current.plan.steps[current.stepIndex].animation)) {
      pendingCommand.current = { kind, instanceId, interactionAt };
      return;
    }
    setRequest(current => ({ id: (current?.id ?? 0) + 1, kind, instanceId, interactionAt }));
  }, []);
  const startActivity = useCallback((kind: RoomActivityKind, instanceId?: string, interactionAt?: number) => requestActivity(kind, instanceId, interactionAt), [requestActivity]);
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
    // Context state can publish the command's interaction after its request has
    // already started. Match the timestamp so that delayed render cannot cancel it.
    if (lastInteractionAt === request?.interactionAt || lastInteractionAt === pendingCommand.current?.interactionAt) return;
    // Menu taps also record an interaction. Keep their explicit command,
    // including one queued during a jump, instead of replacing it with home.
    if ((request && request.id !== handledRequest.current) || pendingCommand.current) return;
    requestActivity("returnHome");
  }, [lastInteractionAt, request, requestActivity]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const resumingRoom = !wasRoomVisible.current && roomVisible;
    wasRoomVisible.current = roomVisible;
    if (!roomVisible && roomHiddenAt.current === null) roomHiddenAt.current = Date.now();
    if (resumingRoom && roomHiddenAt.current !== null) {
      if (running.current) running.current.startedAt += Date.now() - roomHiddenAt.current;
      roomHiddenAt.current = null;
    }
    const continuing = wasActive.current && active;
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
          doorArrival.current?.(plan.targetInstanceId);
          return;
        }
        if (plan.kind === "roomTravel" && plan.destination && !completed?.plan.steps.some(step => step.native?.blocked)) {
          roomArrival.current?.(plan.destination);
          return;
        }
        if (plan.kind === "bowlEat" && !completed?.plan.steps.some(step => step.native?.blocked)) feedComplete.current?.();
        timer = setTimeout(startIdle, roomIdleDelay(latestOptions.current) + (turn.current % 5) * 700);
        return;
      }
      const room = latestOptions.current;
      if (liveWorld.current) {
        step = step.native?.blocked || elapsed && isCatJump(step.animation) && step.native ? { ...step } :
          prepareNativeStep(plan, step, room.nativeStepCompletion && nativePosition.current
            ? catScreenPoint(nativePosition.current, liveWorld.current) : { x: petX.get(), y: petY.get() }, liveWorld.current, nativeHeight.current, { x: objectX.get(), y: objectY.get() });
        step.native = { ...step.native!, elapsed, replanned, awaitCompletion: room.nativeStepCompletion && !step.hold };
        nativeElapsed.current = elapsed;
        if (step.native?.blocked) {
          plan = { ...plan, steps: plan.steps.slice(0, stepIndex + 1) };
          // A failed interaction cannot hold a sleep/use pose at the floor.
          const position = room.nativeStepCompletion && nativePosition.current ? nativePosition.current : step.native.path[0];
          step = { ...step, position: catScreenPoint(position, liveWorld.current), animation: "idle", mood: "idle", hold: false,
            sofaApproach: undefined, bathroomPhase: undefined, durationMs: 200, moveMs: 0,
            native: { ...step.native, path: [position], distance: 0, duration: .2, jump: false, awaitCompletion: room.nativeStepCompletion } };
        }
        if (reduceMotion) step.native = { ...step.native!, path: [step.native!.path.at(-1)!], distance: 0, jump: false };
      }
      const duration = reduceMotion ? 0 : step.moveMs ?? 0;
      let visibleStep = step;
      if (!reduceMotion && isCatWalk(step.animation)) {
        const motion = getCatWalkMotion({ x: petX.get(), y: petY.get() }, step.position, room.petSize);
        facing.set(motion.facing);
        visibleStep = { ...step, animation: motion.animation, animationFps: Math.max(12, Math.min(60, 24 * motion.cycles / Math.max(.1, duration / 1000))) };
      }
      const timing = { duration, easing: isCatWalk(step.animation) ? Easing.linear : Easing.inOut(Easing.quad) };
      if (liveWorld.current && room.nativeStepCompletion !== false) {
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
        if (room.nativeStepCompletion === false && step.native) {
          nativeHeight.current = step.native.path.at(-1)![1];
          petX.set(step.position.x); petY.set(step.position.y);
        }
        const kind = pendingCommand.current;
        if (kind) {
          pendingCommand.current = null;
          // The flight is complete. Route from the landed pose so a queued
          // touch after jump-down does not start a second jump off the sofa.
          const landedStep = { ...step, animation: undefined,
            bathroomPhase: step.animation === "jumpOff" ? undefined : step.bathroomPhase,
            sofaApproach: step.animation === "jumpOff" ? undefined : step.sofaApproach };
          running.current = { plan: { ...next.plan, steps: next.plan.steps.map((item, index) => index === stepIndex ? landedStep : item) }, stepIndex, startedAt: Date.now() };
          setRequest(current => ({ id: (current?.id ?? 0) + 1, ...kind }));
        } else runStep(next.plan, stepIndex + 1);
      };
      nativeAdvance.current = step.native?.awaitCompletion ? (key, position) => {
        if (stopped || !running.current || roomActivityStepKey(running.current) !== key) return;
        if (!hasNativeArrived(position, step.native!.path.at(-1)!)) return;
        // Use the exact rendered arrival, rather than the last throttled UI anchor.
        const point = catScreenPoint(position, liveWorld.current!);
        petX.set(point.x); petY.set(point.y); nativeHeight.current = position[1];
        // Reanimated writes from JS reach the UI thread asynchronously. Keep the
        // rendered arrival synchronously so the next step cannot read the old home.
        nativePosition.current = position;
        nativeAdvance.current = null;
        advanceStep();
      } : null;
      if (!step.hold && !step.native?.awaitCompletion)
        timer = setTimeout(advanceStep, reduceMotion ? 600 : Math.max(0, step.durationMs - elapsed * 1000));
    };
    const startPlan = (plan: RoomActivityPlan) => {
      if (plan.objectStart) {
        objectX.set(plan.objectStart.x);
        objectY.set(plan.objectStart.y);
        objectRotation.set(0);
      }
      runStep(plan, 0);
    };
    const startIdle = () => {
      if (reduceMotion) return;
      const plan = buildRoomActivity(latestOptions.current, turn.current++);
      if (plan) startPlan(plan);
      else timer = setTimeout(startIdle, roomIdleDelay(latestOptions.current) + (turn.current % 5) * 700);
    };
    const current = running.current;
    if (!active) {
      // Cleanup stops travel and timers. Preserve the current pose so focus
      // can resume with a visible journey home, including getting off a sofa.
      return;
    }
    if (!enabled) {
      running.current = null;
      pendingCommand.current = null;
      if (!preservePositionWhenDisabled) { petX.set(home.x); petY.set(home.y); }
      scale.set(1); facing.set(1);
      if (request) handledRequest.current = request.id;
      timer = setTimeout(() => setState(null), 0);
    } else {
      const entry = options.entry && handledEntry.current !== options.entry.id ? buildRoomEntry(options) : null;
      if (entry) {
        handledEntry.current = options.entry!.id;
        startPlan(entry);
        return () => { stopped = true; nativeAdvance.current = null; clearTimeout(timer); };
      }
      const newRequest = request && request.id !== handledRequest.current ? request : null;
      if (newRequest) handledRequest.current = newRequest.id;
      const position = options.nativeStepCompletion && nativePosition.current && liveWorld.current
        ? catScreenPoint(nativePosition.current, liveWorld.current) : { x: petX.get(), y: petY.get() };
      const returning = current ? buildRoomReturn(options, current.plan, current.stepIndex, position) : null;
      const sofaCommand = newRequest?.kind === "sofaSit" || newRequest?.kind === "sofaSleep";
      const commandOptions = liveWorld.current ? { ...options, nativeWorld: { ...liveWorld.current,
        home: catFloorPoint(position, liveWorld.current, FLOOR_Y) } } : options;
      const next = newRequest && newRequest.kind !== "returnHome" && newRequest.kind !== "stop"
        ? buildRoomActivity(commandOptions, turn.current++, newRequest.kind, newRequest.instanceId ?? (sofaCommand ? current?.plan.targetInstanceId : undefined)) : null;
      if (current && !newRequest && liveWorld.current && (continuing || resumingRoom)) {
        const step = current.plan.steps[current.stepIndex];
        const target = liveWorld.current.objects.find(o => o.instanceId === current.plan.targetInstanceId);
        if (!target && current.plan.targetInstanceId && current.plan.kind !== 'returnHome' && returning) {
          timer = setTimeout(() => runStep(returning, 0), 0);
        } else if (step.animation === 'eating' && target && step.native?.targetPosition
          && pathLength([target.position, step.native.targetPosition]) > .05) {
          const meal = buildRoomActivity(options, turn.current++, 'bowlEat', target.instanceId);
          if (meal) timer = setTimeout(() => startPlan(meal), 0);
        } else {
          const elapsed = isCatWalk(step.animation) ? 0 : options.nativeStepCompletion ? nativeElapsed.current : Math.max(0, (Date.now() - current.startedAt) / 1000);
          runStep(current.plan, current.stepIndex, elapsed, Boolean(isCatWalk(step.animation)));
        }
      } else if (newRequest?.kind === "stop") {
        const exit = current ? buildRoomExit(options, current.plan, current.stepIndex, position) : { kind: "returnHome" as const, steps: [] };
        timer = setTimeout(() => startPlan({ ...exit, stopForEditing: true }), 0);
      } else if (next) {
        const plan = next.kind === "sofaSit" || next.kind === "sofaSleep"
          ? routeToSofa(options, next, position, current)
          : current ? { ...next, steps: [...buildRoomExit(options, current.plan, current.stepIndex, position).steps, ...next.steps] } : next;
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
  }, [active, enabled, facing, navigationVersion, objectRotation, objectX, objectY, options, petX, petY, preservePositionWhenDisabled, reduceMotion, request, roomVisible, scale]);
  return { activity, scale, facing, objectX, objectY, objectRotation, startActivity, returnHome, stopActivity, updateNativeHeight, updateObjectPosition, completeNativeStep };
}
