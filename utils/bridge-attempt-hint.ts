import { bridgeComplete, bridgeTarget, checkBridgeAnswer, type BridgePuzzle, type BridgeState } from '@/utils/bridge-models';

export type BridgeAttemptHint = { key: string; detailKey?: string };

/** Diagnose only what the submitted draft demonstrates. Never change it or disclose the target. */
export function getBridgeAttemptHint(puzzle: BridgePuzzle, state: BridgeState, attempt = 1): BridgeAttemptHint | null {
  if (!bridgeComplete(puzzle, state) || checkBridgeAnswer(puzzle, state)) return null;
  const hint = (key: string, detail: string): BridgeAttemptHint => ({ key, ...(attempt >= 2 ? { detailKey: detail } : {}) });
  if (puzzle.type === 'ratio_table') {
    const { a, b, targetA } = puzzle.payload, value = state.value!;
    const detail = targetA % a === 0 ? 'ratioScaleDetail' : 'ratioUnitDetail';
    if (value === b + targetA - a) return hint('ratioAdded', detail);
    if (targetA !== 1 && value === b / a) return hint('ratioOneGroup', detail);
    if (targetA > a && value <= b) return hint('ratioMustGrow', detail);
    if (targetA < a && value >= b) return hint('ratioMustShrink', detail);
    return hint(value < targetA * b / a ? 'ratioLow' : 'ratioHigh', detail);
  }
  if (puzzle.type === 'signed_line') {
    const { start, delta, mode } = puzzle.payload, value = state.value!;
    if (mode === 'place') {
      if (start !== 0 && value === -start) return hint('signedSign', 'signedPlaceDetail');
      return hint(value < start ? 'signedTooFarLeft' : 'signedTooFarRight', 'signedPlaceDetail');
    }
    if (delta !== 0 && value === start) return hint('signedNoMove', 'signedMoveDetail');
    if ((value - start) * delta < 0) return hint('signedWrongDirection', 'signedMoveDetail');
    if (delta !== 0 && Math.abs(value - start - delta) === 1) return hint('signedIntervals', 'signedMoveDetail');
    return hint(value < start + delta ? 'signedTooFarLeft' : 'signedTooFarRight', 'signedMoveDetail');
  }
  if (puzzle.type === 'equation_board') {
    const { a, b, c } = state.equation!, original = puzzle.payload;
    // The controls preserve equivalence; checking before x is isolated is unfinished work.
    if (a <= 0 || ![a, b, c].every(Number.isSafeInteger) || a * (original.c - original.b) !== original.a * (c - b)) {
      return hint('equationCheck', 'equationCheckDetail');
    }
    if (b > 0) return hint('equationSubtract', 'equationConstantDetail');
    if (b < 0) return hint('equationAdd', 'equationConstantDetail');
    return hint('equationDivide', 'equationDivideDetail');
  }
  const { mode, start, end } = puzzle.payload, target = bridgeTarget(puzzle);
  if (typeof target === 'number') {
    if (state.value === target + 1) return hint('coordinateCountSpaces', 'coordinateDistanceDetail');
    return hint(state.value! < target ? 'coordinateDistanceLow' : 'coordinateDistanceHigh', 'coordinateDistanceDetail');
  }
  const point = state.point!;
  const detail = mode === 'translate' ? 'coordinateTranslateDetail' : 'coordinatePlotDetail';
  if (mode === 'translate' && point.x === start.x && point.y === start.y) return hint('coordinateNotMoved', detail);
  if (mode === 'translate' && point.x === end.x && point.y === end.y) return hint('coordinateUsedMove', detail);
  if (target.x !== target.y && point.x === target.y && point.y === target.x) return hint('coordinateSwapped', detail);
  if (point.x === target.x) return hint('coordinateCheckY', detail);
  if (point.y === target.y) return hint('coordinateCheckX', detail);
  return hint('coordinateCheckBoth', detail);
}
