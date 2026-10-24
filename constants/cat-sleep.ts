/** Select once per nap; the same pose must survive wake/return interruptions. */
export const CAT_SLEEP_POSES = ['Loaf', 'Crescent', 'Side'] as const;
export type CatSleepPose = typeof CAT_SLEEP_POSES[number];
export const CAT_SLEEP_ENTER_MS = 2200;
export function sleepTransitionTiming(pose?: CatSleepPose) {
  return pose ? { durationMs: CAT_SLEEP_ENTER_MS, animationFps: 24_000 / CAT_SLEEP_ENTER_MS }
    : { durationMs: 1000 };
}
