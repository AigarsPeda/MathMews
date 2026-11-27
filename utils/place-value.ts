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

/** Reserve the same mat slots before, during and after an exchange. */
export function placeValueCapacity(puzzle: PlaceValuePuzzle) {
  const { beats } = placeValueProof(puzzle);
  return {
    tens: Math.max(...beats.map(beat => beat.state.tens)),
    ones: Math.max(...beats.map(beat => beat.state.ones)),
  };
}

export function checkPlaceValue(puzzle: PlaceValuePuzzle, state: PlaceValueState): boolean {
  const { tens, ones } = state;
  if (![tens, ones].every(n => Number.isInteger(n) && n >= 0) || tens > 9 || ones > 19) return false;
  if (puzzle.payload.mode === 'add' && !state.added) return false;
  if (puzzle.payload.mode === 'split') return tens === Math.floor(puzzle.payload.start / 10) - 1 && ones === puzzle.payload.start % 10 + 10;
  return ones < 10 && tens * 10 + ones === placeValueTarget(puzzle);
}

type PlaceValueProofMove = 'start' | 'addTen' | 'addOne' | 'join' | 'bundle' | 'split' | 'removeTens' | 'removeOne';
type PlaceValueProofBeat = { state: PlaceValueState; move: PlaceValueProofMove; duration: 100 | 120 | 140 | 160 | 240 | 300 };
export function placeValueProof(puzzle: PlaceValuePuzzle) {
  const { mode, operand = 0 } = puzzle.payload;
  let current = initialPlaceValue(puzzle);
  const beats: PlaceValueProofBeat[] = [{ state: current, move: 'start', duration: 120 }];
  const commit = (move: PlaceValueProofMove, duration: PlaceValueProofBeat['duration'], next: PlaceValueState) => {
    current = next;
    beats.push({ state: current, move, duration });
  };
  const act = (move: PlaceValueAction, duration: PlaceValueProofBeat['duration']) => {
    commit(move === 'addOperand' ? 'join' : move === 'removeTen' ? 'removeTens' : move, duration, changePlaceValue(puzzle, current, move));
  };
  if (mode === 'build') {
    for (let i = 0; i < Math.floor(puzzle.payload.start / 10); i++) act('addTen', 160);
    const ones = puzzle.payload.start % 10;
    if (ones) commit('addOne', 160, { ...current, ones });
  } else if (mode === 'add') {
    const joined = changePlaceValue(puzzle, current, 'addOperand');
    if (joined.tens > current.tens) commit('join', 140, { ...current, tens: joined.tens, added: joined.ones === current.ones });
    while (current.ones < joined.ones) {
      const ones = Math.min(current.ones + 5, joined.ones);
      commit('join', 140, { ...current, ones, added: ones === joined.ones });
    }
    if (!current.added) commit('join', 140, joined);
    if (current.ones >= 10) act('bundle', 300);
  } else if (mode === 'subtract') {
    if (current.ones < operand % 10) act('split', 300);
    const tens = Math.floor(operand / 10);
    const ones = operand % 10;
    if (ones) commit('removeOne', 140, { ...current, ones: current.ones - ones });
    if (tens) commit('removeTens', 140, { ...current, tens: current.tens - tens });
  } else {
    act(mode, 300);
  }
  return { initial: beats[0].state, beats, final: current };
}
