import { NavigationContext } from "expo-router/react-navigation";
import { useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { AccessibilityInfo, AppState } from "react-native";
import { useFrameCallback, useSharedValue, type FrameInfo } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { advanceSpritePlayback } from "./sprite-playback";

/** Pause covered screens/background work and respond to the system motion setting. */
export function useSpriteActivity() {
  const navigation = useContext(NavigationContext);
  const subscribe = useCallback((notify: () => void) => {
    if (!navigation) return () => {};
    const focus = navigation.addListener("focus", notify);
    const blur = navigation.addListener("blur", notify);
    return () => { focus(); blur(); };
  }, [navigation]);
  const focused = useSyncExternalStore(subscribe, () => navigation?.isFocused() ?? true, () => true);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    const app = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => { mounted = false; motion.remove(); app.remove(); };
  }, []);
  return { active: foreground && focused, reduceMotion };
}

type ClockOptions = {
  frameCount: number;
  fps: number;
  loop: boolean;
  reverse?: boolean;
  framesPerPage?: number;
  readyPages?: readonly number[];
  onComplete?: () => void;
};

/** UI-thread playback. React runs only for page loads and one-shot completion. */
export function useSpriteClock({ frameCount, fps, loop, reverse = false,
  framesPerPage = frameCount, readyPages = [0], onComplete }: ClockOptions) {
  const { active, reduceMotion } = useSpriteActivity();
  const frame = useSharedValue(reverse ? frameCount - 1 : 0);
  const elapsed = useSharedValue(0);
  const done = useSharedValue(false);
  const [finished, setFinished] = useState(false);
  const ready = useSharedValue<readonly number[]>(readyPages);
  useEffect(() => { ready.set(readyPages); }, [ready, readyPages]);
  const complete = useCallback(() => { setFinished(true); onComplete?.(); }, [onComplete]);
  // Page loads update readiness, not the callback registration/time base.
  const advance = useCallback((info: FrameInfo) => {
    "worklet";
    if (done.get() || !ready.get().includes(Math.floor(frame.get() / framesPerPage))) return;
    if (reduceMotion) {
      elapsed.set(elapsed.get() + Math.min(info.timeSincePreviousFrame ?? 0, 100));
      // Hold a readable pose; semantic callbacks still unblock the game.
      if (!loop && elapsed.get() >= 600) {
        done.set(true);
        scheduleOnRN(complete);
      }
      return;
    }
    const next = advanceSpritePlayback(frame.get(), elapsed.get(), info.timeSincePreviousFrame ?? 0,
      frameCount, fps, reverse, loop, framesPerPage, ready.get());
    frame.set(next.frame);
    elapsed.set(next.elapsed);
    if (next.finished) { done.set(true); scheduleOnRN(complete); }
  }, [complete, done, elapsed, fps, frame, frameCount, framesPerPage, loop, ready, reduceMotion, reverse]);
  const clock = useFrameCallback(advance, false);
  useEffect(() => {
    clock.setActive(active && !finished && !(reduceMotion && loop));
    return () => clock.setActive(false);
  }, [active, clock, finished, loop, reduceMotion]);
  return frame;
}
