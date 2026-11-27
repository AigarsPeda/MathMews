import type { Puzzle } from '@/types/puzzle';

export type HopRoute = {
  stops: number[]; min: number; max: number; divisions?: number; equivalent?: string; claim?: string; kind?: 'signed-move' | 'signed-place' | 'integer' | 'fraction-attempt';
};

/** Positions are integer tick indices, including on a fraction line. */
export function numberLineRoute(puzzle: Puzzle, submittedFractionTick?: number): HopRoute | null {
  if (puzzle.type === 'fraction_number_line') {
    const { numerator, denominator, divisions } = puzzle.payload;
    if (submittedFractionTick !== undefined) {
      return { min: 0, max: divisions, divisions, stops: [submittedFractionTick], kind: 'fraction-attempt' };
    }
    const end = numerator * divisions / denominator;
    return {
      stops: Array.from({ length: end + 1 }, (_, tick) => tick), min: 0, max: divisions, divisions,
      equivalent: divisions !== denominator ? `${numerator}/${denominator}` : undefined,
    };
  }
  if (puzzle.type !== 'number_line' && puzzle.type !== 'signed_line') return null;
  const { min, max } = puzzle.payload;
  const placing = puzzle.type === 'signed_line' && puzzle.payload.mode === 'place';
  const response = puzzle.response;
  const choice = placing && response?.kind === 'choose' ? Number(response.options[response.correctIndex]?.replace('−', '-')) : NaN;
  const relative = Number.isFinite(choice) && choice >= min && choice <= max;
  const start = placing && !relative ? Math.max(min, Math.min(max, 0)) : puzzle.payload.start;
  const end = puzzle.type === 'number_line' ? puzzle.payload.correctValue
    : placing ? (relative ? choice : puzzle.payload.start) : start + puzzle.payload.delta;
  if (puzzle.type === 'signed_line') {
    const cross = start * end < 0;
    const stops = start === end ? [start] : cross ? [start, 0, end] : [start, end];
    return { stops, min, max, claim: response?.kind === 'judge' ? response.proposed : undefined, kind: placing && !relative ? 'signed-place' : 'signed-move' };
  }
  return { stops: integerHopStops(start, end), min, max, kind: 'integer' };
}

export function integerHopStops(start: number, end: number) {
  const direction = Math.sign(end - start);
  const distance = Math.abs(end - start);
  const stride = distance >= 20 ? 10 : distance >= 6 ? 5 : 1;
  const stops = [start];
  for (let tick = start; tick !== end;) {
    let next = tick + direction * Math.min(stride, Math.abs(end - tick));
    if (tick * next < 0) next = 0;
    stops.push(next);
    tick = next;
  }
  return stops;
}

export function lineValue(tick: number, divisions?: number) {
  return divisions && tick !== 0 ? `${tick}/${divisions}` : String(tick).replace('-', '−');
}

export function landingEquation(route: HopRoute, index: number, cumulative = true) {
  const { stops, divisions, equivalent } = route;
  const current = stops[index];
  if (route.kind === 'signed-place') return lineValue(current);
  const previous = stops[index - 1];
  const start = !cumulative && previous === 0 ? previous : stops[0];
  if (divisions) {
    const value = lineValue(current, divisions);
    const final = equivalent ?? (current === divisions ? '1' : undefined);
    return index === stops.length - 1 && final ? `${value} = ${final}` : value;
  }
  if (!index && stops.length > 1) return lineValue(start);
  return `${lineValue(start)} ${current < start ? '−' : '+'} ${Math.abs(current - start)} = ${lineValue(current)}`;
}
