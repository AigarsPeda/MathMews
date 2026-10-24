import type { SharedValue } from 'react-native-reanimated';

type Sample = { session: number; sequence: number; inputAt: number; appliedAt: number; phase: 'move' | 'release' };
const switches = new Set<SharedValue<boolean>>();
let samples: Sample[] | undefined;
/** Opt-in development probe; production drags do not report frames to JavaScript. */
export function registerRoomDragLatency(measure: SharedValue<boolean>) {
  if (!__DEV__) return () => {};
  switches.add(measure);
  const target = globalThis as typeof globalThis & { __roomDragLatency?: { start(): void; finish(): Sample[] } };
  target.__roomDragLatency = {
    start() { samples = []; for (const flag of switches) flag.set(true); },
    finish() { for (const flag of switches) flag.set(false); const result = samples ?? []; samples = undefined; return result; },
  };
  return () => { switches.delete(measure); measure.set(false); if (!switches.size) delete target.__roomDragLatency; };
}
export function recordRoomDragFrame(sample: Sample) {
  if (__DEV__ && samples && samples.length < 2000) samples.push(sample);
}
