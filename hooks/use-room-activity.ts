import { useSpriteActivity } from "@/pet-display/media/sprite/use-sprite-clock";
import {
  buildRoomActivity,
  buildRoomReturn,
  roomOffsetToPoint,
  ROOM_IDLE_DELAY_MS,
  type RoomActivityKind,
  type RoomActivityOptions,
  type RoomActivityPlan,
} from "@/utils/room-activities";
import { useCallback, useEffect, useRef, useState } from "react";
import { cancelAnimation, Easing, useSharedValue, withDelay, withTiming, type SharedValue } from "react-native-reanimated";

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
  const handledRequest = useRef(0);
  const [request, setRequest] = useState<ActivityRequest | null>(null);
  const [state, setState] = useState<ActivityState | null>(null);
  const activity = enabled && active && !reduceMotion ? state : null;
  const startActivity = useCallback((kind: RoomActivityKind) => {
    setRequest(current => ({ id: (current?.id ?? 0) + 1, kind }));
  }, []);
  const returnHome = useCallback(() => {
    if (!activity || activity.plan.kind === "returnHome") return;
    setRequest(current => ({ id: (current?.id ?? 0) + 1, kind: "returnHome" }));
  }, [activity]);

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
      const dx = step.position.x - petX.get();
      if (Math.abs(dx) > 2) facing.set(dx < 0 ? -1 : 1);
      const duration = step.moveMs ?? 0;
      const timing = { duration, easing: step.animation === "walk" ? Easing.linear : Easing.inOut(Easing.quad) };
      petX.set(withTiming(step.position.x, timing));
      petY.set(withTiming(step.position.y, timing));
      scale.set(withTiming(step.scale ?? 1, { duration: duration || 180 }));
      if (step.objectPosition) {
        // The mouse gets a head start; balls/yarn roll just after a paw contact.
        const objectDuration = step.objectMoveMs ?? (plan.kind === "mouseChase" ? duration * 0.6 : Math.min(duration, 700));
        const delay = step.objectDelayMs ?? 0;
        objectX.set(withDelay(delay, withTiming(step.objectPosition.x, { duration: objectDuration })));
        objectY.set(withDelay(delay, withTiming(step.objectPosition.y, { duration: objectDuration })));
        objectRotation.set(withDelay(delay, withTiming(step.objectRotation ?? 0, { duration: objectDuration })));
      }
      const next = { plan, stepIndex };
      running.current = next;
      setState(next);
      if (!step.hold) timer = setTimeout(() => runStep(plan, stepIndex + 1), step.durationMs);
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
      petX.set(home.x); petY.set(home.y); scale.set(1); facing.set(1);
      if (request) handledRequest.current = request.id;
      timer = setTimeout(() => setState(null), 0);
    } else {
      const newRequest = request && request.id !== handledRequest.current ? request : null;
      if (newRequest) handledRequest.current = newRequest.id;
      const returning = current ? buildRoomReturn(options, current.plan, current.stepIndex, { x: petX.get(), y: petY.get() }) : null;
      const next = newRequest && newRequest.kind !== "returnHome" ? buildRoomActivity(options, turn.current++, newRequest.kind) : null;
      if (next) {
        // Finish leaving the previous object before walking to the next one.
        const plan = returning ? { ...next, steps: [...returning.steps, ...next.steps] } : next;
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
  }, [active, enabled, facing, lastInteractionAt, objectRotation, objectX, objectY, options, petX, petY, reduceMotion, request, scale]);
  return { activity, scale, facing, objectX, objectY, objectRotation, startActivity, returnHome };
}
