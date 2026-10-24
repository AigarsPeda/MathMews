import { useCallback, useState, useSyncExternalStore } from 'react';
import { useAnimationActivity } from '@/hooks/use-animation-activity';

/** Poll only while the app is active. Reading a clock never writes the game save. */
export function useWorldClockNow(intervalMs = 1000, enabled = true) {
  const { active } = useAnimationActivity();
  const running = active && enabled;
  const [clock] = useState(() => {
    let now = Date.now();
    return {
      getSnapshot: () => now,
      subscribe(notify: () => void, interval: number) {
        const update = () => {
          now = Date.now();
          notify();
        };
        // Catch up on activation in the subscription, outside React rendering.
        update();
        const timer = setInterval(update, interval);
        return () => clearInterval(timer);
      },
    };
  });
  const subscribe = useCallback((notify: () => void) => {
    if (!running) return () => {};
    return clock.subscribe(notify, intervalMs);
  }, [clock, running, intervalMs]);
  return useSyncExternalStore(subscribe, clock.getSnapshot, clock.getSnapshot);
}
