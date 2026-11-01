import type { PlaceValuePuzzle } from '@/types/puzzle';

export type PlaceValueState = { tens: number; ones: number; added: boolean };
export type PlaceValueAction = 'addTen' | 'addOne' | 'removeTen' | 'removeOne' | 'bundle' | 'split' | 'addOperand';

export function initialPlaceValue(puzzle: PlaceValuePuzzle): PlaceValueState {
  const { mode, start } = puzzle.payload;
  if (mode === 'build') return { tens: 0, ones: 0, added: false };
  const tens = Math.floor(start / 10), ones = start % 10;
  return mode === 'bundle' ? { tens: tens - 1, ones: ones + 10, added: false }
    : { tens, ones, added: false };
}

/** Exchanges conserve quantity; only the authored operation can change it. */
export function changePlaceValue(puzzle: PlaceValuePuzzle, state: PlaceValueState, action: PlaceValueAction): PlaceValueState {
  const { mode, operand = 0 } = puzzle.payload;
  const { tens, ones } = state;
  if (action === 'bundle' && mode !== 'split' && ones >= 10 && tens < 9) return { ...state, tens: tens + 1, ones: ones - 10 };
  if (action === 'split' && (mode === 'split' || mode === 'subtract') && tens > 0 && ones < 10) return { ...state, tens: tens - 1, ones: ones + 10 };
  if (mode === 'build') {
    if (action === 'addTen' && tens < 9) return { ...state, tens: tens + 1 };
    if (action === 'addOne' && ones < 19) return { ...state, ones: ones + 1 };
  }
  if (mode === 'build' || mode === 'subtract') {
    if (action === 'removeTen' && tens > 0) return { ...state, tens: tens - 1 };
    if (action === 'removeOne' && ones > 0) return { ...state, ones: ones - 1 };
  }
  if (mode === 'add' && action === 'addOperand' && !state.added) {
    return { tens: tens + Math.floor(operand / 10), ones: ones + operand % 10, added: true };
  }
  return state;
}

export function placeValueTarget(puzzle: PlaceValuePuzzle) {
  const { mode, start, operand = 0 } = puzzle.payload;
  return mode === 'add' ? start + operand : mode === 'subtract' ? start - operand : start;
}

export function checkPlaceValue(puzzle: PlaceValuePuzzle, state: PlaceValueState): boolean {
  const { tens, ones } = state;
  if (![tens, ones].every(n => Number.isInteger(n) && n >= 0) || tens > 9 || ones > 19) return false;
  if (puzzle.payload.mode === 'add' && !state.added) return false;
  if (puzzle.payload.mode === 'split') return tens === Math.floor(puzzle.payload.start / 10) - 1 && ones === puzzle.payload.start % 10 + 10;
  return ones < 10 && tens * 10 + ones === placeValueTarget(puzzle);
}
