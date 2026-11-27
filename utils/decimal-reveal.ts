import type { DecimalGridPuzzle, DecimalPlaceValuePuzzle } from '@/types/puzzle';
import { changeDecimalPlace, decimalLabel, decimalTotal, initialDecimalPlace, type DecimalPlaceState } from '@/utils/decimal-models';

export type DecimalPuzzle = DecimalGridPuzzle | DecimalPlaceValuePuzzle;

export function decimalRevealModel(puzzle: DecimalPuzzle, selected?: readonly number[], submitted?: DecimalPlaceState) {
  const total = puzzle.type === 'decimal_grid' && selected ? selected.length * 100 / puzzle.payload.scale
    : submitted ? decimalTotal(submitted) : puzzle.payload.hundredths;
  const grid = puzzle.type === 'decimal_grid';
  const scale = grid ? puzzle.payload.scale : puzzle.payload.digits === 1 ? 10 : 100;
  const steps = [0];
  let amount = 0;
  while (amount < total) {
    const remaining = total - amount;
    const chunk = 10;
    amount += !grid && remaining >= 100 ? 100 : remaining >= 10
      ? Math.min(chunk, Math.floor(remaining / 10) * 10)
      : grid ? Math.min(4, remaining) : 1;
    steps.push(amount);
  }
  let exchange;
  if (puzzle.type === 'decimal_place_value' && puzzle.payload.mode !== 'build') {
    const { mode, exchangeUnit: unit } = puzzle.payload;
    const initial = initialDecimalPlace(puzzle);
    const after = submitted ?? changeDecimalPlace(puzzle, initial, { kind: mode, unit });
    const before = submitted ?? initial;
    const size = unit === 'tenths' ? 100 : 10;
    exchange = { mode, unit, before, after, size, start: (Math.floor(total / size) - 1) * size };
  }
  return { grid, scale, digits: puzzle.payload.digits, total, steps, exchange, plates: Math.max(1, Math.ceil(total / 100)) };
}
export type DecimalRevealModel = ReturnType<typeof decimalRevealModel>;

/** Each beat fills the next group using exactly one donor per empty cell. */
export function decimalGroupingMasks(mask: readonly number[], stops: readonly number[]) {
  const cells = new Set(mask);
  const donors = mask.filter(index => index >= mask.length);
  let next = 0, donor = 0;
  const first = { cells: mask, moving: [] as number[] };
  return [first, ...stops.slice(1).map(stop => {
    const moving: number[] = [];
    for (; next < stop; next++) {
      if (cells.has(next)) continue;
      const from = donors[donor++];
      cells.delete(from);
      cells.add(next);
      moving.push(from, next);
    }
    return { cells: [...cells], moving };
  })];
}

export function decimalFillAt(steps: readonly number[], beat: number) {
  'worklet';
  const last = steps.length - 1;
  const position = Math.max(0, Math.min(last, beat));
  const i = Math.floor(position);
  if (i === last) return steps[last];
  const progress = position - i;
  return steps[i] + (steps[i + 1] - steps[i]) * progress;
}

export function decimalEquation(model: DecimalRevealModel, amount: number, finished: boolean, locale: string) {
  const { digits, scale, exchange } = model;
  const decimal = decimalLabel(amount, model.grid && scale === 100 ? 2 : digits, locale);
  if (model.grid) {
    const shorter = finished && scale === 100 && digits === 1 ? ` = ${decimalLabel(amount, 1, locale)}` : '';
    return `${amount * scale / 100}/${scale} = ${decimal}${shorter}`;
  }
  const state: DecimalPlaceState = exchange ? (finished ? exchange.after : exchange.before) : {
    ones: Math.floor(amount / 100), tenths: Math.floor(amount % 100 / 10), hundredths: amount % 10,
  };
  const terms = [];
  if (state.ones) terms.push(String(state.ones));
  if (state.tenths) terms.push(`${state.tenths}/10`);
  if (state.hundredths) terms.push(`${state.hundredths}/100`);
  return `${terms.join(' + ') || '0'} = ${decimal}`;
}
