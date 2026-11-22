import { glide } from '@/utils/puzzle-motion';
import type { DecimalGridPuzzle, DecimalPlaceValuePuzzle } from '@/types/puzzle';
import { changeDecimalPlace, decimalLabel, initialDecimalPlace, type DecimalPlaceState } from '@/utils/decimal-models';

export type DecimalPuzzle = DecimalGridPuzzle | DecimalPlaceValuePuzzle;

export function decimalRevealModel(puzzle: DecimalPuzzle) {
  const total = puzzle.payload.hundredths;
  const grid = puzzle.type === 'decimal_grid';
  const scale = grid ? puzzle.payload.scale : puzzle.payload.digits === 1 ? 10 : 100;
  const steps = [0];
  let amount = 0;
  while (amount < total) {
    const remaining = total - amount;
    amount += !grid && remaining >= 100 ? 100 : remaining >= 10 ? 10 : 1;
    steps.push(amount);
  }
  let exchange;
  if (puzzle.type === 'decimal_place_value' && puzzle.payload.mode !== 'build') {
    const { mode, exchangeUnit: unit } = puzzle.payload;
    const before = initialDecimalPlace(puzzle);
    const after = changeDecimalPlace(puzzle, before, { kind: mode, unit });
    const size = unit === 'tenths' ? 100 : 10;
    exchange = { mode, unit, before, after, size, start: (Math.floor(total / size) - 1) * size };
  }
  return { grid, scale, digits: puzzle.payload.digits, total, steps, exchange, plates: Math.max(1, Math.ceil(total / 100)) };
}
export type DecimalRevealModel = ReturnType<typeof decimalRevealModel>;

export function decimalFillAt(steps: readonly number[], beat: number) {
  'worklet';
  const last = steps.length - 1;
  const position = Math.max(0, Math.min(last, beat));
  const i = Math.floor(position);
  if (i === last) return steps[last];
  const progress = glide((position - i) / .82);
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
