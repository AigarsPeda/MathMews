import { useEffect, useState } from 'react';
import { useAnimationActivity } from '@/hooks/use-animation-activity';

/** Poll only while the app is active. Reading a clock never writes the game save. */
export function useWorldClockNow(intervalMs = 1000, enabled = true) {
  const { active } = useAnimationActivity();
  const running = active && enabled;
  const [reading, setReading] = useState(() => ({ running, now: Date.now() }));
  // React retries this render before committing a newly active room.
  if (reading.running !== running) setReading(() => ({ running, now: Date.now() }));
  useEffect(() => {
    if (!running) return;
    const update = () => setReading({ running, now: Date.now() });
    const firstFrame = requestAnimationFrame(update);
    const interval = setInterval(update, intervalMs);
    return () => { clearInterval(interval); cancelAnimationFrame(firstFrame); };
  }, [running, intervalMs]);
  return reading.now;
}
