import { FLOOR_Y, prepareNativeStep } from "@/utils/native-room-world";
import { useAnimationActivity } from "@/hooks/use-animation-activity";
import { getCatJumpMotion, getCatWalkMotion, isCatJump, isCatWalk } from "@/constants/cat-room-motion";
import {
  buildRoomActivity,
  buildRoomReturn,
  routeToSofa,
  roomOffsetToPoint,
  ROOM_IDLE_DELAY_MS,
  type RoomActivityKind,
  type RoomActivityOptions,
  type RoomActivityPlan,
} from "@/utils/room-activities";
import { useCallback, useEffect, useRef, useState } from "react";
import { cancelAnimation, Easing, useSharedValue, withDelay, withSequence, withTiming, type SharedValue } from "react-native-reanimated";

type ActivityState = { plan: RoomActivityPlan; stepIndex: number };
type ActivityRequest = { id: number; kind: RoomActivityKind | "returnHome"; instanceId?: string };

/** One scheduler owns idle choices, commands, and the visible journey home. */
export function useRoomActivity(
  options: RoomActivityOptions,
  enabled: boolean,
  lastInteractionAt: number | undefined,
  petX: SharedValue<number>,
  petY: SharedValue<number>,
  onDoorArrival?: (instanceId: string) => void,
  onFeed?: () => void,
) {
  const { active, reduceMotion } = useAnimationActivity();
  const scale = useSharedValue(1);
  const facing = useSharedValue(1);
  const objectX = useSharedValue(0);
  const objectY = useSharedValue(0);
  const objectRotation = useSharedValue(0);
  const turn = useRef(0);
  const nativeHeight = useRef(FLOOR_Y);
  const updateNativeHeight = useCallback((position: readonly number[]) => { nativeHeight.current = position[1]; }, []);
  const running = useRef<ActivityState | null>(null);
  const pendingCommand = useRef<Omit<ActivityRequest, "id"> | null>(null);
  const doorArrival = useRef(onDoorArrival);
  doorArrival.current = onDoorArrival;
  const feedComplete = useRef(onFeed);
  feedComplete.current = onFeed;
  const previousInteraction = useRef(lastInteractionAt);
  const handledRequest = useRef(0);
  const [request, setRequest] = useState<ActivityRequest | null>(null);
  const [state, setState] = useState<ActivityState | null>(null);
  // Covered screens keep the visible pose; only their clock is paused.
  const activity = enabled ? state : null;
  const requestActivity = useCallback((kind: ActivityRequest["kind"], instanceId?: string) => {
    const current = running.current;
    if (current && isCatJump(current.plan.steps[current.stepIndex].animation)) {
      pendingCommand.current = { kind, instanceId };
      return;
    }
    setRequest(current => ({ id: (current?.id ?? 0) + 1, kind, instanceId }));
  }, []);
  const startActivity = useCallback((kind: RoomActivityKind, instanceId?: string) => requestActivity(kind, instanceId), [requestActivity]);
  const returnHome = useCallback(() => {
    if (!activity || activity.plan.kind === "returnHome") return;
    requestActivity("returnHome");
  }, [activity, requestActivity]);

  useEffect(() => {
    if (previousInteraction.current === lastInteractionAt) return;
    previousInteraction.current = lastInteractionAt;
    // Menu taps also record an interaction. Keep their explicit command,
    // including one queued during a jump, instead of replacing it with home.
    if ((request && request.id !== handledRequest.current) || pendingCommand.current) return;
    requestActivity("returnHome");
  }, [lastInteractionAt, request, requestActivity]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const home = roomOffsetToPoint(options.homeOffset, options.width, options.height, options.petSize);
    const runStep = (plan: RoomActivityPlan, stepIndex: number) => {
      if (stopped) return;
      let step = plan.steps[stepIndex];
      if (!step) {
        const completed = running.current;
        running.current = null;
        facing.set(1);
        setState(null);
        if (plan.kind === "doorTravel" && plan.targetInstanceId && !completed?.plan.steps.at(-1)?.native?.blocked) {
          doorArrival.current?.(plan.targetInstanceId);
          return;
        }
        if (plan.kind === "bowlEat" && !completed?.plan.steps.some(step => step.native?.blocked)) feedComplete.current?.();
        timer = setTimeout(startIdle, ROOM_IDLE_DELAY_MS + (turn.current % 5) * 700);
        return;
      }
      if (options.nativeWorld) {
        step = prepareNativeStep(plan, step, { x: petX.get(), y: petY.get() }, options.nativeWorld, nativeHeight.current, { x: objectX.get(), y: objectY.get() });
        if (step.native?.blocked) plan = { ...plan, steps: plan.steps.slice(0, stepIndex + 1) };
        if (reduceMotion) step.native = { ...step.native!, path: [step.native!.path.at(-1)!], distance: 0, jump: false };
      }
      const duration = reduceMotion ? 0 : step.moveMs ?? 0;
      let visibleStep = step;
      if (!reduceMotion && isCatWalk(step.animation)) {
        const motion = getCatWalkMotion({ x: petX.get(), y: petY.get() }, step.position, options.petSize);
        facing.set(motion.facing);
        visibleStep = { ...step, animation: motion.animation, animationFps: Math.max(12, Math.min(60, 24 * motion.cycles / Math.max(.1, duration / 1000))) };
      }
      const timing = { duration, easing: isCatWalk(step.animation) ? Easing.linear : Easing.inOut(Easing.quad) };
      if (options.nativeWorld) {
        // Filament owns the visible motion; these values are only native UI anchors.
      } else if (!reduceMotion && isCatJump(step.animation)) {
        facing.set(1);
        const jump = getCatJumpMotion(petY.get(), step.position.y, options.petSize, duration);
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
      if (step.objectPosition && !options.nativeWorld) {
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
      const next = { plan: { ...plan, steps: plan.steps.map((item, index) => index === stepIndex ? visibleStep : item) }, stepIndex };
      running.current = next;
      setState(next);
      if (!step.hold) timer = setTimeout(() => {
        const kind = pendingCommand.current;
        if (kind) {
          pendingCommand.current = null;
          // The flight is complete. Route from the landed pose so a queued
          // touch after jump-down does not start a second jump off the sofa.
          const landedStep = { ...step, animation: undefined,
            sofaApproach: step.animation === "jumpOff" ? undefined : step.sofaApproach };
          running.current = { plan: { ...plan, steps: plan.steps.map((item, index) => index === stepIndex ? landedStep : item) }, stepIndex };
          setRequest(current => ({ id: (current?.id ?? 0) + 1, ...kind }));
        } else runStep(plan, stepIndex + 1);
      }, reduceMotion ? 600 : step.durationMs);
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
      const plan = buildRoomActivity(options, turn.current++);
      if (plan) startPlan(plan);
      else timer = setTimeout(startIdle, ROOM_IDLE_DELAY_MS + (turn.current % 5) * 700);
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
      petX.set(home.x); petY.set(home.y); scale.set(1); facing.set(1);
      if (request) handledRequest.current = request.id;
      timer = setTimeout(() => setState(null), 0);
    } else {
      const newRequest = request && request.id !== handledRequest.current ? request : null;
      if (newRequest) handledRequest.current = newRequest.id;
      const position = { x: petX.get(), y: petY.get() };
      const returning = current ? buildRoomReturn(options, current.plan, current.stepIndex, position) : null;
      const sofaCommand = newRequest?.kind === "sofaSit" || newRequest?.kind === "sofaSleep";
      const next = newRequest && newRequest.kind !== "returnHome"
        ? buildRoomActivity(options, turn.current++, newRequest.kind, newRequest.instanceId ?? (sofaCommand ? current?.plan.targetInstanceId : undefined)) : null;
      if (next) {
        const plan = next.kind === "sofaSit" || next.kind === "sofaSleep"
          ? routeToSofa(options, next, position, current)
          : returning ? { ...next, steps: [...returning.steps, ...next.steps] } : next;
        timer = setTimeout(() => startPlan(plan), 0);
      } else if (returning) {
        timer = setTimeout(() => runStep(returning, 0), 0);
      } else {
        petX.set(home.x); petY.set(home.y); scale.set(1); facing.set(1);
        timer = setTimeout(startIdle, ROOM_IDLE_DELAY_MS + (turn.current % 5) * 700);
      }
    }
    return () => {
      stopped = true;
      clearTimeout(timer);
      for (const value of [petX, petY, scale, objectX, objectY, objectRotation]) cancelAnimation(value);
    };
  }, [active, enabled, facing, objectRotation, objectX, objectY, options, petX, petY, reduceMotion, request, scale]);
  return { activity, scale, facing, objectX, objectY, objectRotation, startActivity, returnHome, updateNativeHeight };
}
