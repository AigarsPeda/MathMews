import { useEffect, useState } from 'react';
import { useAnimationActivity } from '@/hooks/use-animation-activity';

/** Poll only while the app is active. Reading a clock never writes the game save. */
export function useWorldClockNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  const { active } = useAnimationActivity();
  useEffect(() => {
    if (!active || !enabled) return;
    const firstFrame = requestAnimationFrame(() => setNow(Date.now()));
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => { clearInterval(interval); cancelAnimationFrame(firstFrame); };
  }, [active, enabled, intervalMs]);
  return now;
}
