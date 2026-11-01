import type { DecimalGridPuzzle, DecimalPlaceValuePuzzle } from '@/types/puzzle';

// All arithmetic is in integer hundredths. Formatting never determines correctness.
export function decimalLabel(hundredths: number, digits: 1 | 2, locale: string): string {
  const remainder = String(hundredths % 100).padStart(2, '0');
  return `${Math.floor(hundredths / 100)}${locale.startsWith('lv') ? ',' : '.'}${remainder.slice(0, digits)}`;
}
export function checkDecimalGrid(puzzle: DecimalGridPuzzle, shaded: number): boolean {
  return Number.isInteger(shaded) && shaded >= 0 && shaded <= puzzle.payload.scale
    && shaded * (100 / puzzle.payload.scale) === puzzle.payload.hundredths;
}
export function decimalGridCell(x: number, y: number, width: number, scale: 10 | 100): number | null {
  if (![x, y, width].every(Number.isFinite) || width <= 0) return null;
  const column = Math.max(0, Math.min(9, Math.floor(x / width * 10)));
  const row = scale === 10 ? 0 : Math.max(0, Math.min(9, Math.floor(y / width * 10)));
  return row * 10 + column + 1;
}
export type DecimalPlaceState = { ones: number; tenths: number; hundredths: number };
export type DecimalUnit = keyof DecimalPlaceState;
export type DecimalAction = { kind: 'add' | 'remove'; unit: DecimalUnit } | { kind: 'bundle' | 'split'; unit: 'tenths' | 'hundredths' };
export const decimalTotal = (state: DecimalPlaceState) => state.ones * 100 + state.tenths * 10 + state.hundredths;
export function initialDecimalPlace(puzzle: DecimalPlaceValuePuzzle): DecimalPlaceState {
  const { mode, hundredths: total, exchangeUnit } = puzzle.payload;
  if (mode === 'build') return { ones: 0, tenths: 0, hundredths: 0 };
  const state = { ones: Math.floor(total / 100), tenths: Math.floor(total % 100 / 10), hundredths: total % 10 };
  if (mode === 'bundle') { const large = exchangeUnit === 'tenths' ? 'ones' : 'tenths'; state[large]--; state[exchangeUnit] += 10; }
  return state;
}
export function changeDecimalPlace(puzzle: DecimalPlaceValuePuzzle, state: DecimalPlaceState, action: DecimalAction): DecimalPlaceState {
  if (action.kind === 'add' || action.kind === 'remove') {
    if (puzzle.payload.mode !== 'build' || !puzzle.payload.units.includes(action.unit)) return state;
    const next = state[action.unit] + (action.kind === 'add' ? 1 : -1);
    if (next < 0 || next > (action.unit === 'ones' ? 2 : 9)) return state;
    return { ...state, [action.unit]: next };
  }
  if (action.kind !== puzzle.payload.mode || action.unit !== puzzle.payload.exchangeUnit) return state;
  const large = action.unit === 'tenths' ? 'ones' : 'tenths';
  if (action.kind === 'bundle' && state[action.unit] >= 10) return { ...state, [large]: state[large] + 1, [action.unit]: state[action.unit] - 10 };
  if (action.kind === 'split' && state[large] > 0 && state[action.unit] < 10) return { ...state, [large]: state[large] - 1, [action.unit]: state[action.unit] + 10 };
  return state;
}
export function checkDecimalPlace(puzzle: DecimalPlaceValuePuzzle, state: DecimalPlaceState): boolean {
  if (!Object.values(state).every(n => Number.isInteger(n) && n >= 0) || state.ones > 2 || state.tenths > 19 || state.hundredths > 19) return false;
  if (decimalTotal(state) !== puzzle.payload.hundredths) return false;
  if (puzzle.payload.mode === 'split') {
    const expected = changeDecimalPlace(puzzle, initialDecimalPlace(puzzle), { kind: 'split', unit: puzzle.payload.exchangeUnit });
    return (['ones', 'tenths', 'hundredths'] as const).every(unit => state[unit] === expected[unit]);
  }
  return state.tenths < 10 && state.hundredths < 10 && (['ones', 'tenths', 'hundredths'] as const).every(unit => puzzle.payload.units.includes(unit) || state[unit] === 0);
}
