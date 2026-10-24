type Sample = { id: number; item: string; started: number; events: Record<string, number> };
let sequence = 0;
let active: Sample | undefined;
const samples: Sample[] = [];
/** Local diagnostic samples only; no player data or network logging. */
export function startDecorationTiming(item: string) {
  active = { id: ++sequence, item, started: (globalThis.performance?.now() ?? Date.now()), events: { buy: 0 } };
  samples.push(active);
  if (samples.length > 30) samples.shift();
  return active.id;
}
export function markDecorationTiming(event: string) {
  if (active && active.events[event] === undefined) active.events[event] = (globalThis.performance?.now() ?? Date.now()) - active.started;
}
export function decorationTimingSamples() { return samples.map(sample => ({ ...sample, events: { ...sample.events } })); }
