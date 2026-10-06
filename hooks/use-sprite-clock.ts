import { useCallback, useEffect } from "react";
import { useFrameCallback, useSharedValue, type FrameInfo } from "react-native-reanimated";
import { useAnimationActivity } from "./use-animation-activity";
import { advanceSpritePlayback } from "@/utils/sprite-playback";

type ClockOptions = { frameCount: number; fps: number; ready: boolean };

/** Advance a loaded UI thumbnail strip without React updates per frame. */
export function useSpriteClock({ frameCount, fps, ready }: ClockOptions) {
  const { active, reduceMotion } = useAnimationActivity();
  const frame = useSharedValue(0);
  const elapsed = useSharedValue(0);
  const loaded = useSharedValue(ready);
  useEffect(() => { loaded.set(ready); }, [loaded, ready]);
  const advance = useCallback((info: FrameInfo) => {
    "worklet";
    if (!loaded.get()) return;
    const next = advanceSpritePlayback(
      frame.get(), elapsed.get(), info.timeSincePreviousFrame ?? 0, frameCount, fps,
    );
    frame.set(next.frame);
    elapsed.set(next.elapsed);
  }, [elapsed, fps, frame, frameCount, loaded]);
  const clock = useFrameCallback(advance, false);
  useEffect(() => {
    clock.setActive(active && !reduceMotion);
    return () => clock.setActive(false);
  }, [active, clock, reduceMotion]);
  return frame;
}
