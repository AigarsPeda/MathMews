import { useSpriteActivity } from "@/pet-display/media/sprite/use-sprite-clock";
import {
  buildRoomActivity,
  roomOffsetToPoint,
  ROOM_IDLE_DELAY_MS,
  type RoomActivityOptions,
  type RoomActivityPlan,
} from "@/utils/room-activities";
import { useEffect, useRef, useState } from "react";
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

type ActivityState = { plan: RoomActivityPlan; stepIndex: number };

/** Ambient activities never write to the pet's saved placement or care engine. */
export function useRoomActivity(
  options: RoomActivityOptions,
  enabled: boolean,
  lastInteractionAt: number | undefined,
  petX: SharedValue<number>,
  petY: SharedValue<number>,
) {
  const { active, reduceMotion } = useSpriteActivity();
  const scale = useSharedValue(1);
  const bounce = useSharedValue(0);
  const facing = useSharedValue(1);
  const mouseX = useSharedValue(0);
  const mouseY = useSharedValue(0);
  const turn = useRef(0);
  const key = JSON.stringify([options, enabled, lastInteractionAt, active, reduceMotion]);
  const [state, setState] = useState<{ key: string; activity: ActivityState | null }>({ key, activity: null });
  if (state.key !== key) setState({ key, activity: null });
  const activity = state.key === key ? state.activity : null;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const home = roomOffsetToPoint(options.homeOffset, options.width, options.height, options.petSize);
    // Settle back to the saved spot when touched, edited, covered, or interrupted.
    petX.set(withTiming(home.x, { duration: reduceMotion || !active ? 0 : 180 }));
    petY.set(withTiming(home.y, { duration: reduceMotion || !active ? 0 : 180 }));
    scale.set(withTiming(1, { duration: 180 }));
    bounce.set(0);
    facing.set(1);
    if (!enabled || !active || reduceMotion) return;

    const runStep = (plan: RoomActivityPlan, stepIndex: number) => {
      if (stopped) return;
      const step = plan.steps[stepIndex];
      if (!step) {
        facing.set(1);
        setState({ key, activity: null });
        timer = setTimeout(start, ROOM_IDLE_DELAY_MS);
        return;
      }
      const dx = step.position.x - petX.get();
      if (Math.abs(dx) > 2) facing.set(dx < 0 ? -1 : 1);
      const duration = step.moveMs ?? 0;
      const timing = { duration, easing: Easing.inOut(Easing.quad) };
      petX.set(withTiming(step.position.x, timing));
      petY.set(withTiming(step.position.y, timing));
      scale.set(withTiming(step.scale ?? 1, { duration: Math.min(900, duration) }));
      cancelAnimation(bounce);
      if (step.jump) {
        bounce.set(withSequence(
          withTiming(-options.petSize * 0.15, { duration: duration / 2 }),
          withTiming(0, { duration: duration / 2 }),
        ));
      } else if (duration > 0) {
        bounce.set(withRepeat(withSequence(
          withTiming(-2, { duration: 170 }),
          withTiming(0, { duration: 170 }),
        ), Math.ceil(duration / 340)));
      } else {
        bounce.set(0);
      }
      if (step.mousePosition) {
        mouseX.set(withTiming(step.mousePosition.x, { duration: duration * 0.7, easing: Easing.inOut(Easing.quad) }));
        mouseY.set(withTiming(step.mousePosition.y, { duration: duration * 0.7, easing: Easing.inOut(Easing.quad) }));
      }
      setState({ key, activity: { plan, stepIndex } });
      timer = setTimeout(() => runStep(plan, stepIndex + 1), step.durationMs);
    };
    const start = () => {
      const plan = buildRoomActivity(options, turn.current++);
      if (!plan) {
        timer = setTimeout(start, ROOM_IDLE_DELAY_MS);
        return;
      }
      if (plan.mouseStart) {
        mouseX.set(plan.mouseStart.x);
        mouseY.set(plan.mouseStart.y);
      }
      runStep(plan, 0);
    };
    timer = setTimeout(start, ROOM_IDLE_DELAY_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
      for (const value of [petX, petY, scale, bounce, mouseX, mouseY]) cancelAnimation(value);
    };
  }, [active, bounce, enabled, facing, key, mouseX, mouseY, options, petX, petY, reduceMotion, scale]);
  return { activity, scale, bounce, facing, mouseX, mouseY };
}
