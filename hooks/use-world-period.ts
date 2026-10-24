import { useEffect, useState } from 'react';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { worldClockReading, type WorldClock } from '@/utils/world-clock';

function readPeriod(clock: WorldClock | undefined, running: boolean) {
  return { clock, running, period: clock ? worldClockReading(clock).period : undefined };
}

/** Room activities need period transitions, not a render for every clock tick. */
export function useWorldPeriod(clock?: WorldClock, enabled = true) {
  const { active } = useAnimationActivity();
  const running = active && enabled && !!clock;
  const [reading, setReading] = useState(() => readPeriod(clock, running));
  // Refresh before commit on activation or a clock preset/speed change.
  if (reading.clock !== clock || reading.running !== running) {
    setReading(() => readPeriod(clock, running));
  }
  useEffect(() => {
    if (!running) return;
    const update = () => setReading(previous => {
      const next = readPeriod(clock, running);
      return previous.period === next.period ? previous : next;
    });
    const frame = requestAnimationFrame(update);
    const timer = setInterval(update, 5000);
    return () => { cancelAnimationFrame(frame); clearInterval(timer); };
  }, [clock, running]);
  return reading.period;
}
