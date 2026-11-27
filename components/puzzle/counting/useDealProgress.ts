import { useState } from 'react';
import { runOnJS, useAnimatedReaction, useDerivedValue } from 'react-native-reanimated';
import type { RevealBeats } from '../kit/useRevealBeats';

/** Interpolate within the actual batch. A final partial batch never adds fictitious rounds. */
export function useDealProgress(clock: RevealBeats, rounds: number, batch: number, groups: number) {
  const { reduced, landed, position, runId } = clock;
  const time = useDerivedValue(() => {
    const at = reduced ? landed : position.value;
    const index = Math.floor(at), from = Math.min(rounds, index * batch), to = Math.min(rounds, (index + 1) * batch);
    return (from + (at - index) * (to - from)) * groups;
  });
  const [observed, setObserved] = useState({ run: -1, count: 0 });
  useAnimatedReaction(() => Math.floor(time.value), (count, previous) => {
    if (count !== previous && !reduced) runOnJS(setObserved)({ run: runId, count });
  }, [runId, reduced]);
  const completed = Math.min(rounds, landed * batch) * groups;
  return { time, dealt: reduced || observed.run !== runId ? completed : Math.max(completed, observed.count) };
}
