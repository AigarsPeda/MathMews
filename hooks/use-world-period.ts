import { useEffect, useMemo, useState } from 'react';
import { useAnimationActivity } from '@/hooks/use-animation-activity';
import { worldClockReading, type WorldClock } from '@/utils/world-clock';

function readPeriod(clock: WorldClock | undefined, running: boolean) {
  return { clock, running, period: clock ? worldClockReading(clock).period : undefined };
}

/** Room activities need period transitions, not a render for every clock tick. */
export function useWorldPeriod(clock?: WorldClock, enabled = true) {
  const { active } = useAnimationActivity();
  const running = active && enabled && !!clock;
  // Read activation/preset changes in this render, without restarting PetStage.
  const source = useMemo(() => readPeriod(clock, running), [clock, running]);
  const [reading, setReading] = useState(() => ({ source, period: source.period }));
  useEffect(() => {
    if (!running) return;
    const update = () => setReading(previous => {
      const next = readPeriod(clock, running);
      const current = previous.source === source ? previous.period : source.period;
      return current === next.period ? previous : { source, period: next.period };
    });
    const frame = requestAnimationFrame(update);
    const timer = setInterval(update, 5000);
    return () => { cancelAnimationFrame(frame); clearInterval(timer); };
  }, [clock, running, source]);
  return reading.source === source ? reading.period : source.period;
}
