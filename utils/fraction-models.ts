import type { FractionNumberLinePuzzle, FractionStripPuzzle } from '@/types/puzzle';

export type FractionStripState = { parts: number; shaded: number | null };

export function validFractionPoint(puzzle: FractionNumberLinePuzzle, tick: number): boolean {
  const { numerator, denominator, divisions } = puzzle.payload;
  return Number.isInteger(tick) && tick >= 0 && tick <= divisions && tick * denominator === numerator * divisions;
}

export function validFractionStrip(puzzle: FractionStripPuzzle, state: FractionStripState): boolean {
  const { numerator, denominator, partitions } = puzzle.payload;
  return partitions.includes(state.parts) && state.shaded !== null && Number.isInteger(state.shaded)
    && state.shaded >= 0 && state.shaded <= state.parts
    && state.shaded * denominator === numerator * state.parts;
}

/** Keep the entire whole visible. Tap locations snap to exact integer boundaries. */
export function fractionTickAt(x: number, width: number, divisions: number): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(width) || width <= 0 || !Number.isInteger(divisions) || divisions < 1) return null;
  return Math.max(0, Math.min(divisions, Math.round(x / width * divisions)));
}

/** A new partition clears the old count: it must never silently change the shaded amount. */
export function partitionFractionStrip(puzzle: FractionStripPuzzle, parts: number): FractionStripState | null {
  return puzzle.payload.partitions.includes(parts) ? { parts, shaded: null } : null;
}
