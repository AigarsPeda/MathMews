import type { Puzzle } from '@/types/puzzle';

export type HopRoute = {
  stops: number[]; min: number; max: number; divisions?: number; equivalent?: string;
};

/** Positions are integer tick indices, including on a fraction line. */
export function numberLineRoute(puzzle: Puzzle): HopRoute | null {
  if (puzzle.type === 'fraction_number_line') {
    const { numerator, denominator, divisions } = puzzle.payload;
    const end = numerator * divisions / denominator;
    return {
      stops: Array.from({ length: end + 1 }, (_, tick) => tick), min: 0, max: divisions, divisions,
      equivalent: divisions !== denominator ? `${numerator}/${denominator}` : undefined,
    };
  }
  if (puzzle.type !== 'number_line' && puzzle.type !== 'signed_line') return null;
  const { min, max } = puzzle.payload;
  const start = puzzle.type === 'signed_line' && puzzle.payload.mode === 'place' ? 0 : puzzle.payload.start;
  const end = puzzle.type === 'number_line' ? puzzle.payload.correctValue
    : puzzle.payload.mode === 'place' ? puzzle.payload.start : start + puzzle.payload.delta;
  const direction = Math.sign(end - start);
  const stride = Math.abs(end - start) > 10 ? 10 : 1;
  const stops = [start];
  for (let tick = start; tick !== end;) {
    let next = tick + direction * Math.min(stride, Math.abs(end - tick));
    if (tick * next < 0) next = 0;
    stops.push(next);
    tick = next;
  }
  const span = Math.min(max - min, Math.max(4, Math.abs(end - start) + 2));
  const low = Math.max(min, Math.min(max - span, Math.floor((start + end - span) / 2)));
  return { stops, min: low, max: low + span };
}

export function lineValue(tick: number, divisions?: number) {
  return divisions && tick !== 0 ? `${tick}/${divisions}` : String(tick).replace('-', '−');
}

export function landingEquation(route: HopRoute, index: number) {
  const { stops, divisions, equivalent } = route;
  const current = stops[index], start = stops[0];
  if (divisions) {
    const value = lineValue(current, divisions);
    const final = equivalent ?? (current === divisions ? '1' : undefined);
    return index === stops.length - 1 && final ? `${value} = ${final}` : value;
  }
  if (!index && stops.length > 1) return lineValue(start);
  return `${lineValue(start)} ${current < start ? '−' : '+'} ${Math.abs(current - start)} = ${lineValue(current)}`;
}
