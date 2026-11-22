// Keep measured quantities monotone, with zero speed at the start and end.
export function glide(progress: number) {
  'worklet';
  const t = Math.max(0, Math.min(1, progress));
  const v = Math.min(t, 1 - t);
  const eased = v * v * v * (v * (v * 6 - 15) + 10);
  return t < .5 ? eased : 1 - eased;
}

// Leave time to see the first and last count while the middle keeps moving.
export function countingCadence(t: number) {
  'worklet';
  return t * (.5 + .5 * t * (3 - 2 * t));
}

// Ease into each stop, then hold its exact value before the next leg starts.
export function distanceAtStops(distance: number, stops: readonly number[], maxHold: number) {
  'worklet';
  for (let i = 1; i < stops.length; i++) {
    const start = stops[i - 1], end = stops[i];
    if (distance >= end) continue;
    const length = end - start;
    const hold = Math.min(maxHold, length * .18);
    const t = Math.max(0, Math.min(1, (distance - start) / (length - hold)));
    return start + length * t * t * (3 - 2 * t);
  }
  return stops[stops.length - 1];
}

// Height above a landing surface. Contact first, then one small rebound.
export function dropHeight(progress: number) {
  'worklet';
  const t = Math.max(0, Math.min(1, progress));
  if (t < .72) return 1 - (t / .72) ** 2;
  const rebound = (t - .72) / .28;
  return .12 * 4 * rebound * (1 - rebound);
}
