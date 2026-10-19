export function getFractionSliceAtPoint(
  x: number,
  y: number,
  center: number,
  radius: number,
  denominator: number,
): number | null {
  const dx = x - center;
  const dy = y - center;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared > radius * radius || distanceSquared === 0) return null;

  // Slices start at twelve o'clock and run clockwise, matching the drawing.
  const turn = Math.PI * 2;
  const angle = (Math.atan2(dy, dx) + Math.PI / 2 + turn) % turn;
  return Math.min(denominator - 1, Math.floor(angle / turn * denominator));
}

export function toggleFractionSlice(selected: readonly number[], index: number): number[] {
  return selected.includes(index)
    ? selected.filter(slice => slice !== index)
    : [...selected, index].sort((a, b) => a - b);
}

export function resizeFractionSelection(
  selected: readonly number[],
  count: number,
  denominator: number,
): number[] {
  const target = Math.max(0, Math.min(denominator, count));
  const next = [...selected];
  for (let index = 0; next.length < target && index < denominator; index++) {
    if (!next.includes(index)) next.push(index);
  }
  return next.sort((a, b) => a - b).slice(0, target);
}
