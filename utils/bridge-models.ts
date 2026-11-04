import type { Puzzle, RatioTablePuzzle, SignedLinePuzzle, EquationBoardPuzzle, CoordinateMapPuzzle } from '@/types/puzzle';
export type BridgePuzzle = RatioTablePuzzle | SignedLinePuzzle | EquationBoardPuzzle | CoordinateMapPuzzle;
export type Point = { x: number; y: number };
export type EquationState = { a: number; b: number; c: number };
export type BridgeState = { value?: number | null; point?: Point | null; equation?: EquationState | null };
export function isBridgePuzzle(p: Puzzle): p is BridgePuzzle {
  return ['ratio_table', 'signed_line', 'equation_board', 'coordinate_map'].includes(p.type ?? '');
}
export function bridgeTarget(p: BridgePuzzle): number | Point {
  const q = p.payload;
  if (p.type === 'ratio_table') return p.payload.targetA * p.payload.b / p.payload.a;
  if (p.type === 'signed_line') return p.payload.mode === 'place' ? p.payload.start : p.payload.start + p.payload.delta;
  if (p.type === 'equation_board') return (p.payload.c - p.payload.b) / p.payload.a;
  const c = q as CoordinateMapPuzzle['payload'];
  if (c.mode === 'distance') return Math.abs(c.end.x - c.start.x) + Math.abs(c.end.y - c.start.y);
  return c.mode === 'translate' ? { x: c.start.x + c.end.x, y: c.start.y + c.end.y } : c.end;
}
export function bridgeComplete(p: BridgePuzzle, state?: BridgeState | null): state is BridgeState {
  if (!state) return false;
  return p.type === 'equation_board' ? state.equation != null : p.type === 'coordinate_map' && p.payload.mode !== 'distance' ? state.point != null : state.value != null;
}
export function checkBridgeAnswer(p: BridgePuzzle, state: BridgeState): boolean {
  if (!bridgeComplete(p, state)) return false;
  const target = bridgeTarget(p);
  if (typeof target !== 'number') return state.point?.x === target.x && state.point?.y === target.y;
  if (p.type === 'equation_board') return state.equation?.a === 1 && state.equation.b === 0 && state.equation.c === target;
  return Number.isSafeInteger(state.value) && state.value === target;
}
export function transformEquation(s: EquationState, operation: 'add' | 'divide', n: number): EquationState | null {
  if (!Number.isSafeInteger(n) || (operation === 'divide' && n < 2)) return null;
  const next = operation === 'add' ? { ...s, b: s.b + n, c: s.c + n }
    : [s.a, s.b, s.c].every(v => v % n === 0) ? { a: s.a / n, b: s.b / n, c: s.c / n } : null;
  return next && next.a > 0 && [next.a, next.b, next.c].every(v => Number.isSafeInteger(v) && Math.abs(v) <= 200) ? next : null;
}
export function equationText({ a, b, c }: EquationState) {
  return `${a === 1 ? '' : a}x${b === 0 ? '' : ` ${b < 0 ? '−' : '+'} ${Math.abs(b)}`} = ${c}`;
}
