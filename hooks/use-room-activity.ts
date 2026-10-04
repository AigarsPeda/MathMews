import { useSpriteActivity } from "@/pet-display/media/sprite/use-sprite-clock";
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
type ActivityRequest = { id: number; kind: RoomActivityKind | "returnHome" };

/** One scheduler owns idle choices, commands, and the visible journey home. */
export function useRoomActivity(
  options: RoomActivityOptions,
  enabled: boolean,
  lastInteractionAt: number | undefined,
  petX: SharedValue<number>,
  petY: SharedValue<number>,
) {
  const { active, reduceMotion } = useSpriteActivity();
  const scale = useSharedValue(1);
  const facing = useSharedValue(1);
  const objectX = useSharedValue(0);
  const objectY = useSharedValue(0);
  const objectRotation = useSharedValue(0);
  const turn = useRef(0);
  const running = useRef<ActivityState | null>(null);
  const pendingCommand = useRef<ActivityRequest["kind"] | null>(null);
  const previousInteraction = useRef(lastInteractionAt);
  const handledRequest = useRef(0);
  const [request, setRequest] = useState<ActivityRequest | null>(null);
  const [state, setState] = useState<ActivityState | null>(null);
  const activity = enabled && active && !reduceMotion ? state : null;
  const requestActivity = useCallback((kind: ActivityRequest["kind"]) => {
    const current = running.current;
    if (current && isCatJump(current.plan.steps[current.stepIndex].animation)) {
      pendingCommand.current = kind;
      return;
    }
    setRequest(current => ({ id: (current?.id ?? 0) + 1, kind }));
  }, []);
  const startActivity = useCallback((kind: RoomActivityKind) => requestActivity(kind), [requestActivity]);
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
      const step = plan.steps[stepIndex];
      if (!step) {
        running.current = null;
        facing.set(1);
        setState(null);
        timer = setTimeout(startIdle, ROOM_IDLE_DELAY_MS);
        return;
      }
      const duration = step.moveMs ?? 0;
      let visibleStep = step;
      if (isCatWalk(step.animation)) {
        const motion = getCatWalkMotion({ x: petX.get(), y: petY.get() }, step.position, options.petSize * (step.scale ?? 1));
        facing.set(motion.facing);
        visibleStep = { ...step, animation: motion.animation, animationFps: Math.max(12, Math.min(60, 24 * motion.cycles / Math.max(.1, duration / 1000))) };
      }
      const timing = { duration, easing: isCatWalk(step.animation) ? Easing.linear : Easing.inOut(Easing.quad) };
      if (isCatJump(step.animation)) {
        facing.set(1);
        const jump = getCatJumpMotion(petY.get(), step.position.y, options.petSize, duration);
        // Keep the paws planted during the crouch, then rise and fall onto
        // the cushion/floor. Landing recovery happens before walking/resting.
        petX.set(withDelay(jump.prepareMs, withTiming(step.position.x, { duration: jump.flightMs, easing: Easing.linear })));
        petY.set(withDelay(jump.prepareMs, withSequence(
          withTiming(jump.apexY, { duration: jump.riseMs, easing: Easing.out(Easing.quad) }),
          withTiming(step.position.y, { duration: jump.fallMs, easing: Easing.in(Easing.quad) }),
        )));
        scale.set(withDelay(jump.prepareMs, withTiming(step.scale ?? 1, { duration: jump.flightMs, easing: Easing.linear })));
      } else {
        petX.set(withTiming(step.position.x, timing));
        petY.set(withTiming(step.position.y, timing));
        scale.set(withTiming(step.scale ?? 1, { duration: duration || 180 }));
      }
      if (step.objectPosition) {
        // The mouse gets a head start; balls/yarn roll just after a paw contact.
        const objectDuration = step.objectMoveMs ?? (plan.kind === "mouseChase" ? duration * 0.6 : Math.min(duration, 700));
        const delay = step.objectDelayMs ?? 0;
        objectX.set(withDelay(delay, withTiming(step.objectPosition.x, { duration: objectDuration })));
        objectY.set(withDelay(delay, withTiming(step.objectPosition.y, { duration: objectDuration })));
        objectRotation.set(withDelay(delay, withTiming(step.objectRotation ?? 0, { duration: objectDuration })));
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
          setRequest(current => ({ id: (current?.id ?? 0) + 1, kind }));
        } else runStep(plan, stepIndex + 1);
      }, step.durationMs);
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
      const plan = buildRoomActivity(options, turn.current++);
      if (plan) startPlan(plan);
      else timer = setTimeout(startIdle, ROOM_IDLE_DELAY_MS);
    };
    const current = running.current;
    if (!enabled || !active || reduceMotion) {
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
        ? buildRoomActivity(options, turn.current++, newRequest.kind, sofaCommand ? current?.plan.targetInstanceId : undefined) : null;
      if (next) {
        const plan = next.kind === "sofaSit" || next.kind === "sofaSleep"
          ? routeToSofa(options, next, position, current)
          : returning ? { ...next, steps: [...returning.steps, ...next.steps] } : next;
        timer = setTimeout(() => startPlan(plan), 0);
      } else if (returning) {
        timer = setTimeout(() => runStep(returning, 0), 0);
      } else {
        petX.set(home.x); petY.set(home.y); scale.set(1); facing.set(1);
        timer = setTimeout(startIdle, ROOM_IDLE_DELAY_MS);
      }
    }
    return () => {
      stopped = true;
      clearTimeout(timer);
      for (const value of [petX, petY, scale, objectX, objectY, objectRotation]) cancelAnimation(value);
    };
  }, [active, enabled, facing, objectRotation, objectX, objectY, options, petX, petY, reduceMotion, request, scale]);
  return { activity, scale, facing, objectX, objectY, objectRotation, startActivity, returnHome };
}
