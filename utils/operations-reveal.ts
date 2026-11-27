/**
 * Pure plans for the operations proofs (OperationsReveal). Each plan turns a
 * puzzle plus the checked answer into an ordered list of steps. A step is one
 * committed state: its duration, the caption that lands with it and the hold
 * after it. Mode `worked` plays a valid solution (the child's own when it is
 * valid). Mode `attempt` plays only the submitted work and stops at its first
 * mismatch, so a puzzle that can still be retried is not solved for the child.
 */
import { ProofMotion } from '@/constants/puzzle-theme';
import type {
  BalancePuzzle, EquationBoardPuzzle, EstimatePuzzle, FindAllPairsPuzzle, FixMistakePuzzle, FunctionMachinePuzzle,
  MathOperator, OperationPathPuzzle, OrderNumbersPuzzle, PairSumPuzzle, PatternNextPuzzle, Puzzle, RepairPatternPuzzle,
  RouteGridPuzzle, TargetBuildPuzzle, TrueFalsePuzzle,
} from '@/types/puzzle';
import { MATH_OPERATORS } from '@/types/puzzle';
import type { PuzzleAnswer } from '@/utils/puzzle-type';
import { applyMathOperator, runOperationPath } from '@/utils/puzzle-math';

export type ProofMode = 'attempt' | 'worked';
export type ProofStep = { ms: number; caption: string; hold?: number };
type T = (key: string, options?: Record<string, unknown>) => string;

export type OperationsPuzzle = BalancePuzzle | EquationBoardPuzzle | EstimatePuzzle | FindAllPairsPuzzle | FixMistakePuzzle
  | FunctionMachinePuzzle | OperationPathPuzzle | OrderNumbersPuzzle | PairSumPuzzle | PatternNextPuzzle | RepairPatternPuzzle
  | RouteGridPuzzle | TargetBuildPuzzle | TrueFalsePuzzle;

export const OPERATIONS_REVEAL_TYPES = ['balance', 'estimate', 'find_all_pairs', 'fix_mistake', 'function_machine', 'operation_path',
  'order_numbers', 'pair_sum', 'pattern_next', 'repair_pattern', 'route_grid', 'target_build', 'true_false', 'equation_board'] as const;

export function hasOperationsReveal(puzzle: Puzzle): puzzle is OperationsPuzzle {
  return (OPERATIONS_REVEAL_TYPES as readonly string[]).includes(puzzle.type ?? '');
}

const B = ProofMotion.beat;
/** Repeated identical completions hold 200 ms; nothing holds shorter than that between distinct states. */
export const PROOF_HOLD = ProofMotion.repeatHold;
/** Active sequence from Check to the last landing, holds included (the settled frame is excluded). */
export function proofDuration(steps: readonly ProofStep[], lead: number = ProofMotion.lead) {
  return lead + steps.reduce((sum, s, i) => sum + s.ms + (i < steps.length - 1 ? s.hold ?? PROOF_HOLD : 0), 0);
}

export const minus = (n: number) => n < 0 ? `−${Math.abs(n)}` : String(n);
export const sign = (op: MathOperator | string) => op === '-' ? '−' : op;
const opOf = (s: string): MathOperator => (s === '−' ? '-' : s) as MathOperator;

/* ---------- worked answers (QA fixtures use the same domain logic as Play) ---------- */

function solveOperationPath(p: OperationPathPuzzle['payload']): MathOperator[] {
  const n = p.steps.length;
  for (let code = 0; code < 4 ** n; code++) {
    const ops = Array.from({ length: n }, (_, i) => MATH_OPERATORS[Math.floor(code / 4 ** i) % 4]);
    if (runOperationPath(p.start, p.steps, ops) === p.target) return ops;
  }
  return p.steps.map(s => s.operator);
}

export function routeValue(p: RouteGridPuzzle['payload'], cells: readonly number[]) {
  const values = [p.start];
  for (let i = 1; i < cells.length; i++) {
    const step = p.cells[cells[i]];
    const next = step ? applyMathOperator(values[i - 1], step.operand, step.operator) : null;
    if (next === null || next < 0) return { values, failedAt: i };
    values.push(next);
  }
  return { values, failedAt: -1 };
}

function solveRoute(p: RouteGridPuzzle['payload']): number[] {
  const rows = Math.ceil(p.cells.length / p.columns);
  const exit = p.cells.length - 1;
  const walk = (path: number[]): number[] | null => {
    if (path.length === p.moves + 1) {
      const { values, failedAt } = routeValue(p, path);
      return path.at(-1) === exit && failedAt < 0 && values.at(-1) === p.target ? path : null;
    }
    const at = path.at(-1)!, r = Math.floor(at / p.columns), c = at % p.columns;
    for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const nr = r + dr, nc = c + dc, next = nr * p.columns + nc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= p.columns || path.includes(next) || !p.cells[next]) continue;
      const found = walk([...path, next]);
      if (found) return found;
    }
    return null;
  };
  return walk([0]) ?? [0];
}

function validPairs(numbers: readonly number[], target: number): [number, number][] {
  const out: [number, number][] = [];
  for (let a = 0; a < numbers.length; a++) for (let b = a + 1; b < numbers.length; b++) if (numbers[a] + numbers[b] === target) out.push([a, b]);
  return out;
}

/** A deterministic valid answer for the proof, built from the same rules Play checks. */
export function operationsWorkedAnswer(puzzle: OperationsPuzzle): PuzzleAnswer {
  switch (puzzle.type) {
    case 'equation_board': {
      const { a, b, c } = puzzle.payload;
      return { kind: 'bridge', state: { equation: { a: 1, b: 0, c: (c - b) / a } } };
    }
    case 'find_all_pairs': return { kind: 'pairs', pairs: validPairs(puzzle.payload.numbers, puzzle.payload.target) };
    case 'operation_path': return { kind: 'operators', operators: solveOperationPath(puzzle.payload) };
    case 'target_build': return { kind: 'operators', operators: puzzle.payload.solution };
    case 'order_numbers': return { kind: 'order', numbers: puzzle.payload.correctOrder };
    case 'pair_sum': return { kind: 'pair', indices: puzzle.payload.correctIndices };
    case 'repair_pattern': return { kind: 'sequence', values: puzzle.payload.solution };
    case 'route_grid': return { kind: 'route', cells: solveRoute(puzzle.payload) };
    case 'true_false': return { kind: 'choice', index: puzzle.isTrue ? 0 : 1 };
    default: return { kind: 'choice', index: puzzle.correctIndex };
  }
}

/** The choice a plan plays: the submitted one in an attempt, or in worked mode when it is the correct one. */
export function proofChoice(answer: PuzzleAnswer | null | undefined, correct: number, mode: ProofMode) {
  if (answer?.kind !== 'choice') return correct;
  return mode === 'attempt' || answer.index === correct ? answer.index : correct;
}

/** The answer a plan plays: the submitted one when it fits the type (and, in worked mode, is valid). */
export function proofAnswer(puzzle: OperationsPuzzle, answer: PuzzleAnswer | null | undefined, mode: ProofMode, valid: boolean): PuzzleAnswer {
  const worked = operationsWorkedAnswer(puzzle);
  if (!answer || answer.kind !== worked.kind) return worked;
  if (mode === 'worked' && !valid) return worked;
  return answer;
}

/* ---------- balance ---------- */

export type BalanceParts = { a: string; op: string; b: string };
export function parseBalance(display: string): BalanceParts | null {
  const m = /^(-?\d+|\?)\s*([+−×÷-])\s*(-?\d+|\?)$/.exec(display.trim());
  return m ? { a: m[1], op: m[2] === '-' ? '−' : m[2], b: m[3] } : null;
}

export type BalancePlan = {
  parts: BalanceParts | null; value: number; right: number; left: number | null;
  /** Equal rows dealt one row per round; 0 for the part-whole model. */
  rows: number; dealt: number;
  /** Rows dealt once step k has landed. */
  dealtAt: number[]; steps: ProofStep[]; final: string; ok: boolean;
};

export function balancePlan(puzzle: BalancePuzzle, choiceIndex: number, mode: ProofMode, t?: T): BalancePlan {
  const { leftDisplay, rightValue: right, choices } = puzzle.payload;
  const value = Number(choices[choiceIndex]);
  const parts = parseBalance(leftDisplay);
  const fill = (s: string) => s === '?' ? String(value) : s.replace('-', '−');
  const a = parts ? Number(fill(parts.a)) : NaN, b = parts ? Number(fill(parts.b)) : NaN;
  const left = parts ? applyMathOperator(a, b, opOf(parts.op)) : null;
  const ok = left === right;
  const shown = parts ? `${fill(parts.a)} ${parts.op} ${fill(parts.b)}` : leftDisplay;
  const question = parts ? `${parts.a} ${parts.op} ${parts.b} = ${right}` : `${leftDisplay} = ${right}`;
  const relation = left === null ? '≠' : left < right ? '<' : left > right ? '>' : '=';
  const final = ok ? `${shown} = ${right}` : `${shown} = ${left ?? '?'} ${relation === '=' ? '≠' : relation} ${right}`;
  // n × ? (or ? × n) with a countable load: deal the value into each row in turn.
  const rowsToken = parts && parts.op === '×' ? (parts.b === '?' ? parts.a : parts.a === '?' ? parts.b : null) : null;
  const rowCount = rowsToken !== null && /^\d+$/.test(rowsToken) ? Number(rowsToken) : 0;
  const countable = rowCount >= 2 && rowCount <= 10 && Number.isInteger(value) && value >= 1 && value <= 8 && right <= 60 && rowCount * value <= 80;
  if (countable) {
    const dealt = rowCount;
    const steps: ProofStep[] = [{ ms: B[120], hold: 0, caption: question }];
    const dealtAt = [0];
    for (let rows = 1; rows <= dealt; rows++) {
      const equation = `${rows} × ${value} = ${rows * value}`;
      steps.push({ ms: Math.min(215, 1900 / dealt), hold: 40, caption: t?.('operationsReveal.equalRows', { count: rows, size: value, total: rows * value, defaultValue: equation }) ?? equation });
      dealtAt.push(rows);
    }
    return { parts, value, right, left, rows: rowCount, dealt, dealtAt, steps, final, ok };
  }
  return {
    parts, value, right, left, rows: 0, dealt: 0, dealtAt: [], ok, final,
    steps: [
      { ms: B[120], caption: question },
      { ms: B[240], caption: `${shown} = ${right}?` },
      { ms: B[240], caption: `${shown} = ${left ?? '?'}` },
      { ms: B[180], caption: final },
    ],
  };
}

/* ---------- equation board ---------- */

export type EquationState = { a: number; b: number; c: number };
export type EquationMove = { operation: 'add' | 'divide'; amount: number };
export type EquationPlan = {
  a: number; b: number; c: number; x: number;
  moves: EquationMove[];
  /** states[0] is the authored equation; states[i] follows move i. */
  states: EquationState[];
  /** For each step: the state drawn once it lands, and the move it animates (−1 for none). */
  stepState: number[]; stepMove: number[];
  /** Every state fits countable tiles (no negative loads, at most 24 units a side). */
  tiles: boolean; isolated: boolean; steps: ProofStep[]; final: string; ok: boolean;
};

const eq = ({ a, b, c }: EquationState) => `${a === 1 ? '' : a}x${b === 0 ? '' : ` ${b < 0 ? '−' : '+'} ${Math.abs(b)}`} = ${minus(c)}`;
const lhs = (s: EquationState) => eq(s).split(' = ')[0];
export { eq as equationLabel };

function moveOn(s: EquationState, m: EquationMove): EquationState | null {
  if (m.operation === 'add') return { a: s.a, b: s.b + m.amount, c: s.c + m.amount };
  return [s.a, s.b, s.c].every(v => v % m.amount === 0) && m.amount >= 2 ? { a: s.a / m.amount, b: s.b / m.amount, c: s.c / m.amount } : null;
}

/** The moves a worked proof makes: undo the constant, then share among the x tiles. */
export function workedEquationMoves({ a, b }: EquationState): EquationMove[] {
  return [...(b !== 0 ? [{ operation: 'add' as const, amount: -b }] : []), ...(a !== 1 ? [{ operation: 'divide' as const, amount: a }] : [])];
}

export function equationPlan(puzzle: EquationBoardPuzzle, answer: PuzzleAnswer, mode: ProofMode, t: T = (k, o) => String(o?.defaultValue ?? k)): EquationPlan {
  const start = { ...puzzle.payload } as EquationState;
  const { a, b, c } = start;
  const x = (c - b) / a;
  const submitted = answer.kind === 'bridge' ? answer.state : null;
  const reached = submitted?.equation ?? null;
  const solvedState = !!reached && reached.a === 1 && reached.b === 0;
  // The learner's own moves when they are recorded and replay to the submitted equation.
  let moves = submitted?.equationMoves ?? [];
  let states: EquationState[] = [start];
  for (const m of moves) { const next = moveOn(states.at(-1)!, m); if (!next) { states = [start]; moves = []; break; } states.push(next); }
  const replays = moves.length > 0 && !!reached && eq(states.at(-1)!) === eq(reached);
  const ok = solvedState || (mode === 'worked' && !submitted);
  if (!replays || (mode === 'worked' && !solvedState)) {
    if (mode === 'attempt' && reached && !solvedState) {
      // No usable history: show only where the attempt stopped.
      moves = []; states = [start, reached];
    } else {
      moves = workedEquationMoves(start);
      states = [start];
      for (const m of moves) states.push(moveOn(states.at(-1)!, m)!);
    }
  }
  // Consecutive removals have one visible contact on both sides of the scale.
  if (moves.length > 1) {
    const grouped: EquationMove[] = [];
    for (const move of moves) {
      const previous = grouped.at(-1);
      if (previous?.operation === 'add' && previous.amount < 0 && move.operation === 'add' && move.amount < 0) previous.amount += move.amount;
      else grouped.push({ ...move });
    }
    moves = grouped;
    states = [start];
    for (const move of moves) states.push(moveOn(states.at(-1)!, move)!);
  }
  const steps: ProofStep[] = [{ ms: B[120], caption: eq(start) }];
  const stepState = [0], stepMove = [-1];
  moves.forEach((m, i) => {
    const from = states[i], to = states[i + 1];
    const both = m.operation === 'add' ? `${m.amount < 0 ? '−' : '+'} ${Math.abs(m.amount)}` : `÷ ${m.amount}`;
    // Show the operation on both sides before units move, then commit the new counts and equation together.
    steps.push({ ms: B[120], hold: 0, caption: m.operation === 'add' ? `${lhs(from)} ${both} = ${minus(from.c)} ${both}` : `(${lhs(from)}) ${both} = ${minus(from.c)} ${both}` });
    stepState.push(i); stepMove.push(-1);
    steps.push({ ms: B[300], caption: eq(to) });
    stepState.push(i + 1); stepMove.push(i);
  });
  const last = states.at(-1)!;
  const isolated = last.a === 1 && last.b === 0;
  if (!moves.length && states.length > 1) { steps.push({ ms: B[240], caption: eq(last) }); stepState.push(1); stepMove.push(-1); }
  let final: string;
  if (isolated) {
    final = `x = ${minus(last.c)}`;
  } else {
    // One short line: the equation itself is already on the scale and in the verdict chip.
    final = t('operationsReveal.xNotAlone', { defaultValue: 'x is not on its own yet.' });
  }
  const tiles = states.every(s => s.b >= 0 && s.c >= 0 && s.c <= 24 && s.b <= 10 && s.a <= 4) && Number.isInteger(x);
  return { a, b, c, x, moves, states, stepState, stepMove, tiles, isolated, steps, final, ok: ok && isolated };
}

/* ---------- estimate ---------- */

export type EstimatePlan = { a: number; b: number; total: number; lower: number; upper: number; nearest: number; chosen: number; steps: ProofStep[]; final: string; ok: boolean };
export function estimatePlan(puzzle: EstimatePuzzle, choiceIndex: number, mode: ProofMode = 'worked', t?: T): EstimatePlan | null {
  const m = /^(\d+)\s*\+\s*(\d+)$/.exec(puzzle.payload.expression.trim());
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]), total = a + b;
  const lower = Math.floor(total / 10) * 10, upper = lower + 10;
  const nearest = Math.round(total / 10) * 10;
  const chosen = Number(puzzle.payload.choices[choiceIndex]?.match(/\d+/)?.[0] ?? NaN);
  const ok = chosen === nearest;
  const exact = total === lower;
  const sum = `${a} + ${b} = ${total}`;
  const exactTen = t?.('operationsReveal.exactTen', { total, defaultValue: `${total} is already a ten` }) ?? `${total} is already a ten`;
  const steps: ProofStep[] = [{ ms: B[300], hold: 100, caption: `${a} + ${b}` }];
  if (mode === 'worked' || ok) {
    steps.push({ ms: B[180], caption: exact ? exactTen : `${lower} < ${total} < ${upper}` });
  }
  const final = mode === 'attempt' && !ok ? `${a} + ${b} = ?` : exact ? sum : `${sum} ≈ ${nearest}`;
  return { a, b, total, lower, upper, nearest, chosen, ok, steps, final };

}

/* ---------- find all pairs ---------- */

export type PairsPlan = { pairs: [number, number][]; sums: number[]; valid: number; needed: number; checked: number; steps: ProofStep[]; final: string; ok: boolean };
export function findPairsPlan(puzzle: FindAllPairsPuzzle, answer: PuzzleAnswer, mode: ProofMode): PairsPlan {
  const { numbers, target } = puzzle.payload;
  const needed = validPairs(numbers, target).length;
  // A reversed pair counts once.
  const seen = new Set<string>();
  const pairs = (answer.kind === 'pairs' ? answer.pairs : []).map(([x, y]) => (x < y ? [x, y] : [y, x]) as [number, number])
    .filter(([x, y]) => { const k = `${x}:${y}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const bad = pairs.findIndex(([x, y]) => numbers[x] + numbers[y] !== target);
  const checked = mode === 'attempt' && bad >= 0 ? bad + 1 : pairs.length;
  const sums = pairs.map(([x, y]) => numbers[x] + numbers[y]);
  const valid = sums.filter(s => s === target).length;
  const ok = bad < 0 && valid === needed;
  const terms = pairs.filter(([x, y]) => numbers[x] + numbers[y] === target).map(([x, y]) => `${numbers[x]} + ${numbers[y]}`);
  const final = bad >= 0 && mode === 'attempt'
    ? `${numbers[pairs[bad][0]]} + ${numbers[pairs[bad][1]]} = ${sums[bad]} ≠ ${target}`
    : `${[...terms, String(target)].join(' = ')}`;
  return {
    pairs, sums, valid, needed, checked, ok, final,
    steps: [
      { ms: B[120], caption: pairs.length ? `${numbers[pairs[0][0]]} + ${numbers[pairs[0][1]]} = ?` : `? + ? = ${target}` },
      ...pairs.slice(0, checked).map(([x, y], i) => ({ ms: B[240], caption: `${numbers[x]} + ${numbers[y]} = ${sums[i]}${sums[i] === target ? '' : ` ≠ ${target}`}` })),
      { ms: B[180], caption: final },
    ],
  };
}

/* ---------- column arithmetic (fix mistake) ---------- */

export type ColumnStep = { kind: 'column'; column: number; digit: number; carry: number; text: string } | { kind: 'exchange'; column: number; text: string };
export type FixPlan = {
  /** The operation the cat wrote; `op` is the one the repair uses. */
  written: string;
  a: string; op: string; b: string; claimed: string; result: number; chosen: string | null;
  mismatchColumn?: number; columns: boolean; width: number; work: ColumnStep[]; steps: ProofStep[]; final: string; ok: boolean;
  /** Three columns or two exchanges: the dense tempo budget (4500 ms) applies. */
  dense: boolean;
};

const LINE = /^\s*(\d+)\s*([+−×÷-])\s*(\d+)\s*=\s*(-?\d+)\s*$/;

/** Column-by-column work for whole-number + and −, with each exchange as its own step. */
export function columnWork(a: number, b: number, op: '+' | '−'): ColumnStep[] {
  const work: ColumnStep[] = [];
  const width = Math.max(String(a).length, String(b).length);
  let carry = 0;
  const top = String(a).padStart(width, '0').split('').map(Number).reverse();
  const bottom = String(b).padStart(width, '0').split('').map(Number).reverse();
  for (let k = 0; k < width; k++) {
    if (op === '+') {
      const sum = top[k] + bottom[k] + carry;
      const parts = [top[k], bottom[k], ...(carry ? [carry] : [])].join(' + ');
      work.push({ kind: 'column', column: k, digit: sum % 10, carry: sum >= 10 ? 1 : 0, text: `${parts} = ${sum}` });
      if (sum >= 10) work.push({ kind: 'exchange', column: k, text: `${sum} = 10 + ${sum - 10}` });
      carry = sum >= 10 ? 1 : 0;
    } else {
      let digit = top[k] - carry;
      carry = 0;
      if (digit < bottom[k] && k < width - 1) { work.push({ kind: 'exchange', column: k, text: `${digit} + 10 = ${digit + 10}` }); digit += 10; carry = 1; }
      work.push({ kind: 'column', column: k, digit: digit - bottom[k], carry, text: `${digit} − ${bottom[k]} = ${digit - bottom[k]}` });
    }
  }
  if (op === '+' && carry) work.push({ kind: 'column', column: width, digit: carry, carry: 0, text: `${carry}` });
  return work;
}

export function fixPlan(puzzle: FixMistakePuzzle, choiceIndex: number, mode: ProofMode): FixPlan | null {
  const m = LINE.exec(puzzle.payload.wrongWork[0] ?? '');
  if (!m) return null;
  const [, a, rawOp, b, claimed] = m;
  const written = rawOp === '-' ? '−' : rawOp;
  // A bare-number repair (a sale price) fixes the operation itself: find the one that gives the correct choice.
  const correct = puzzle.payload.choices[puzzle.correctIndex] ?? '';
  const bare = /^\s*-?\d+\s*$/.test(correct);
  const op = bare ? (['−', '+', '×', '÷'].find(o => applyMathOperator(Number(a), Number(b), opOf(o)) === Number(correct)) ?? written) : written;
  const result = applyMathOperator(Number(a), Number(b), opOf(op));
  if (result === null) return null;
  const chosenLine = puzzle.payload.choices[choiceIndex] ?? '';
  const chosen = chosenLine.split('=').pop()?.trim() ?? null;
  const ok = chosen === String(result);
  const columns = (op === '+' || op === '−') && result >= 0;
  const width = Math.max(a.length, b.length, String(result).length, claimed.length, chosen?.length ?? 0);
  const work = columns ? columnWork(Number(a), Number(b), op as '+' | '−') : [];
  if (mode === 'attempt' && !ok) {
    const answerDigits = (chosen ?? '').padStart(width, ' ').split('').reverse();
    const mismatch = work.find(step => step.kind === 'column' && String(step.digit) !== answerDigits[step.column]);
    const column = mismatch?.column;
    // Locate the first disputed place in the submitted answer without filling its correction.
    const digit = (operand: string) => Number(operand.at(-1 - (column ?? 0)) ?? 0);
    const final = column === undefined || op !== written ? `${a} ${written} ${b} = ?` : `${digit(a)} ${op} ${digit(b)} → ?`;
    return { written, a, op: written, b, claimed: chosen ?? claimed, result, chosen, columns, width, work: [], mismatchColumn: column,
      steps: [{ ms: B[180], caption: final }], final, ok, dense: false };
  }
  const steps: ProofStep[] = [{ ms: B[120], caption: `${a} ${written} ${b} = ${claimed}?` }];
  if (op !== written) steps.push({ ms: B[240], caption: `${a} ${op} ${b}` });
  if (columns) {
    for (const step of work) steps.push({ ms: step.kind === 'exchange' ? B[240] : steps.length === 1 ? B[300] : B[240], caption: step.text });
  } else {
    // × and ÷ are checked with the related fact.
    steps.push({ ms: B[300], caption: op === '÷' ? `${b} × ${result} = ${a}` : `${a} × ${b} = ${result}` });
  }
  const final = `${a} ${op} ${b} = ${result}`;
  steps.push({ ms: B[120], caption: final });
  return { written, a, op, b, claimed, result, chosen, columns, width, work, steps, final, ok, dense: steps.length > 6 };
}

/* ---------- function machine ---------- */

export type RuleOp = { op: MathOperator; n: number; from: number; to: number };
export function ruleOps(input: number, rule: string): RuleOp[] | null {
  const clean = rule.replace(/\s/g, '');
  const parts = [...clean.matchAll(/([+\-−×÷])(\d+)/g)];
  if (!parts.length || parts.map(p => p[0]).join('') !== clean) return null;
  const out: RuleOp[] = [];
  let value = input;
  for (const [, o, n] of parts) {
    const op = opOf(o);
    const next = op === '÷' ? value / Number(n) : applyMathOperator(value, Number(n), op);
    if (next === null || !Number.isFinite(next)) return null;
    out.push({ op, n: Number(n), from: value, to: next });
    value = next;
  }
  return out;
}

export type MachinePlan = { rule: string; ops: RuleOp[]; result: number; steps: ProofStep[]; final: string; ok: boolean };
export function machinePlan(puzzle: FunctionMachinePuzzle, choiceIndex: number): MachinePlan | null {
  const { input, output, choices } = puzzle.payload;
  const rule = choices[choiceIndex] ?? '';
  const ops = ruleOps(input, rule);
  if (!ops) return null;
  const result = ops.at(-1)!.to;
  const ok = result === output;
  const chain = `${input} ${ops.map(o => `${sign(o.op)} ${o.n}`).join(' ')}`;
  const final = ok ? `${chain} = ${output}` : `${chain} = ${result} ≠ ${output}`;
  return {
    rule, ops, result, ok, final,
    steps: [
      { ms: B[120], caption: `${input} → ${rule.replace(/-/g, '−')} → ?` },
      ...ops.flatMap(o => [
        { ms: B[300], caption: `${o.from} ${sign(o.op)} ${o.n}` },
        { ms: B[240], caption: `${o.from} ${sign(o.op)} ${o.n} = ${o.to}` },
      ]),
      { ms: B[120], caption: final },
    ],
  };
}

/* ---------- operation path ---------- */

/** Format the operations in travel order. Parentheses preserve each previous landing. */
function travelExpression(start: number, moves: { operator: MathOperator; operand: number }[]) {
  let text = minus(start), previous: MathOperator | null = null;
  for (const { operator, operand } of moves) {
    if ((operator === '×' || operator === '÷') && (previous === '+' || previous === '-')) text = `(${text})`;
    text += ` ${sign(operator)} ${minus(operand)}`;
    previous = operator;
  }
  return text;
}

export type PathPlan = { operators: MathOperator[]; values: (number | null)[]; rows: number; steps: ProofStep[]; final: string; ok: boolean };
export function pathPlan(puzzle: OperationPathPuzzle, operators: MathOperator[]): PathPlan {
  const { start, target, steps: path } = puzzle.payload;
  const values: (number | null)[] = [start];
  const steps: ProofStep[] = [{ ms: B[120], caption: `${start} → … → ${target}` }];
  let rows = 0;
  for (let i = 0; i < path.length; i++) {
    const v = values[i];
    const next = v === null || !operators[i] ? null : applyMathOperator(v, path[i].operand, operators[i]);
    values.push(next);
    rows = i + 1;
    steps.push({ ms: B[300], caption: `${v} ${sign(operators[i] ?? '?')} ${path[i].operand} = ${next ?? '?'}` });
    if (next === null) break;
  }
  const end = values[rows];
  const ok = end === target;
  const expression = travelExpression(start, path.slice(0, rows).map((step, i) => ({ operand: step.operand, operator: operators[i] })));
  const final = end === null ? `${expression} ≠ ${target}` : `${expression} = ${end}${ok ? '' : ` ≠ ${target}`}`;
  return { operators, values, rows, steps, final, ok };
}

/* ---------- order numbers ---------- */

export type OrderPlan = { order: number[]; compared: number; inversion: number; ascending: boolean; steps: ProofStep[]; final: string; ok: boolean };
export function orderPlan(puzzle: OrderNumbersPuzzle, order: number[], mode: ProofMode): OrderPlan {
  const correct = puzzle.payload.correctOrder;
  const ascending = correct.length < 2 || correct[0] <= correct[correct.length - 1];
  const fits = (x: number, y: number) => ascending ? x <= y : x >= y;
  const rel = (x: number, y: number) => x < y ? '<' : x > y ? '>' : '=';
  const inversion = order.findIndex((x, i) => i < order.length - 1 && !fits(x, order[i + 1]));
  const compared = inversion >= 0 && mode === 'attempt' ? inversion + 1 : order.length - 1;
  const ok = inversion < 0 && order.length === correct.length;
  const final = inversion >= 0 && mode === 'attempt'
    ? `${order[inversion]} ${rel(order[inversion], order[inversion + 1])} ${order[inversion + 1]}`
    : order.map((n, i) => i ? `${rel(order[i - 1], n)} ${n}` : String(n)).join(' ');
  return {
    order, compared, inversion, ascending, ok, final,
    steps: [
      { ms: B[120], caption: order.join('  ') },
      ...Array.from({ length: compared }, (_, i) => ({ ms: B[200], caption: `${order[i]} ${rel(order[i], order[i + 1])} ${order[i + 1]}` })),
      { ms: B[180], caption: final },
    ],
  };
}

/* ---------- pair sum ---------- */

export type PairPlan = { a: number; b: number; target: number; steps: ProofStep[]; final: string; ok: boolean };
export function pairPlan(puzzle: PairSumPuzzle, [i, j]: [number, number]): PairPlan {
  const { numbers, target } = puzzle.payload;
  const a = numbers[i], b = numbers[j];
  const ok = i !== j && a + b === target;
  const final = ok ? `${a} + ${b} = ${target}` : `${a} + ${b} = ${a + b} ≠ ${target}`;
  return {
    a, b, target, ok, final,
    steps: [{ ms: B[120], caption: `${a}` }, { ms: B[240], caption: `${a} + ${b}` }, { ms: B[180], caption: final }],
  };
}

/* ---------- patterns ---------- */

export type PatternRule = { op: '+' | '−' | '×'; n: number };
export function patternRule(values: readonly number[]): PatternRule | null {
  if (values.length < 2) return null;
  const diffs = values.slice(1).map((v, i) => v - values[i]);
  if (diffs.every(d => d === diffs[0]) && diffs[0] !== 0) return { op: diffs[0] > 0 ? '+' : '−', n: Math.abs(diffs[0]) };
  const ratios = values.slice(1).map((v, i) => values[i] === 0 ? NaN : v / values[i]);
  if (ratios.every(r => r === ratios[0]) && Number.isInteger(ratios[0]) && ratios[0] > 1) return { op: '×', n: ratios[0] };
  return null;
}
export const applyRule = (v: number, r: PatternRule) => r.op === '+' ? v + r.n : r.op === '−' ? v - r.n : v * r.n;
export const ruleLabel = (r: PatternRule) => `${r.op}${r.n}`;
/** The step between two values, written the way the rule is written. */
export function stepLabel(from: number, to: number, r: PatternRule | null) {
  if (r?.op === '×' && from !== 0 && Number.isInteger(to / from)) return `×${to / from}`;
  return to >= from ? `+${to - from}` : `−${from - to}`;
}

export type PatternPlan = { sequence: number[]; next: number; chosen: number; rule: PatternRule | null; steps: ProofStep[]; final: string; ok: boolean };
export function patternPlan(puzzle: PatternNextPuzzle, choiceIndex: number): PatternPlan {
  const { sequence, choices } = puzzle.payload;
  const rule = patternRule(sequence);
  const last = sequence[sequence.length - 1];
  const next = rule ? applyRule(last, rule) : Number(choices[puzzle.correctIndex]);
  const chosen = Number(choices[choiceIndex]);
  const ok = chosen === next;
  const transitions = sequence.slice(1).map((v, i) => `${sequence[i]} ${stepLabel(sequence[i], v, rule).replace(/^([+−×])/, '$1 ')} = ${v}`);
  const shown = `${last} ${stepLabel(last, chosen, rule).replace(/^([+−×])/, '$1 ')} = ${chosen}`;
  const final = ok ? shown : `${stepLabel(last, chosen, rule)} ≠ ${rule ? ruleLabel(rule) : '?'}`;
  return {
    sequence, next, chosen, rule, ok, final,
    steps: [
      { ms: B[120], caption: transitions[0] },
      ...transitions.slice(1).map(caption => ({ ms: B[180], caption })),
      { ms: B[240], caption: shown },
    ],
  };
}

export type RepairPlan = {
  sequence: (number | null)[]; filled: number[]; gaps: number[]; rule: PatternRule | null; anchors: [number, number] | null;
  checked: number; spares: number[]; steps: ProofStep[]; final: string; ok: boolean;
};
export function repairPlan(puzzle: RepairPatternPuzzle, values: number[], mode: ProofMode): RepairPlan {
  const { sequence, tiles, solution } = puzzle.payload;
  const gaps = sequence.flatMap((v, i) => v === null ? [i] : []);
  const known = sequence.flatMap((v, i) => v === null ? [] : [i]);
  // The rule comes from the two closest known neighbours.
  let anchors: [number, number] | null = null;
  for (let k = 0; k < known.length - 1; k++) if (!anchors || known[k + 1] - known[k] < anchors[1] - anchors[0]) anchors = [known[k], known[k + 1]];
  const full = sequence.map((v, i) => v ?? solution[gaps.indexOf(i)]);
  const rule = patternRule(full as number[]);
  const filled = sequence.map((v, i) => v ?? values[gaps.indexOf(i)]);
  const firstBad = gaps.findIndex((g, k) => values[k] !== solution[k]);
  const checked = mode === 'attempt' && firstBad >= 0 ? firstBad + 1 : gaps.length;
  const ok = firstBad < 0;
  const used = [...values];
  const spares = tiles.filter(t => { const k = used.indexOf(t); if (k < 0) return true; used.splice(k, 1); return false; });
  const steps: ProofStep[] = [{ ms: B[120], hold: 0, caption: known.map(i => filled[i]).join('  ') }];
  if (anchors) {
    const [i, j] = anchors, a = sequence[i]!, b = sequence[j]!;
    const each = rule ? ruleLabel(rule) : stepLabel(a, b, null);
    steps.push({ ms: B[240], caption: j - i > 1 ? `${a} → ${b} (${each})` : `${a} ${each} = ${b}` });
  }
  for (let k = 0; k < checked; k++) {
    const g = gaps[k], before = full[g - 1] ?? null, v = values[k];
    const expect = solution[k];
    const text = before !== null && rule ? `${before} ${ruleLabel(rule).replace(/^([+−×])/, '$1 ')} = ${expect}` : `${expect}`;
    steps.push({ ms: B[200], caption: v === expect ? text : `${before ?? "?"} ${rule ? ruleLabel(rule) : "?"} ≠ ${v}` });
  }
  const final = ok ? '' : steps.at(-1)!.caption;
  return { sequence, filled, gaps, rule, anchors, checked, spares, ok, final, steps };
}

/* ---------- route grid ---------- */

export type RoutePlan = { cells: number[]; values: number[]; moves: number; steps: ProofStep[]; final: string; ok: boolean };
export function routePlan(puzzle: RouteGridPuzzle, cells: number[], t: T = (k, o) => String(o?.defaultValue ?? k)): RoutePlan {
  const p = puzzle.payload;
  const { values, failedAt } = routeValue(p, cells);
  const moves = failedAt >= 0 ? failedAt : cells.length - 1;
  const end = values.at(-1)!;
  const atExit = cells[moves] === p.cells.length - 1;
  const ok = failedAt < 0 && atExit && moves === p.moves && end === p.target;
  const steps: ProofStep[] = [{ ms: B[120], caption: String(p.start) }];
  for (let i = 1; i <= moves; i++) {
    const c = p.cells[cells[i]]!;
    // A long route is one continuous walk: within the tempo budget its moves follow without a hold.
    steps.push({ ms: B[240], hold: moves > 3 && i < moves ? 0 : PROOF_HOLD, caption: `${values[i - 1]} ${sign(c.operator)} ${c.operand} = ${values[i]}` });
  }
  const expression = travelExpression(p.start, cells.slice(1, moves + 1).map(i => p.cells[i]!));
  const final = `${expression} = ${end}${end === p.target ? '' : ` ≠ ${p.target}`}`;
  return { cells: cells.slice(0, moves + 1), values, moves, ok, final, steps };
}

/* ---------- target build ---------- */

export type BuildStage = { tokens: (number | MathOperator)[]; active: number; contractedAt?: number };
export type BuildPlan = { stages: BuildStage[]; value: number | null; steps: ProofStep[]; final: string; ok: boolean };
const expr = (tokens: (number | MathOperator)[]) => tokens.map(t => typeof t === 'number' ? minus(t) : sign(t)).join(' ');
export function buildPlan(puzzle: TargetBuildPuzzle, operators: MathOperator[]): BuildPlan {
  const { numbers, target } = puzzle.payload;
  let tokens: (number | MathOperator)[] = numbers.flatMap((n, i) => i < operators.length ? [n, operators[i]] : [n]);
  const original = expr(tokens);
  const stages: BuildStage[] = [{ tokens, active: -1 }];
  const steps: ProofStep[] = [{ ms: B[120], caption: original }];
  let value: number | null = null;
  // Highest precedence first, ties left to right.
  while (tokens.length > 1) {
    const ops = tokens.flatMap((t, i) => typeof t === 'string' ? [i] : []);
    const at = ops.find(i => tokens[i] === '×' || tokens[i] === '÷') ?? ops[0];
    const l = tokens[at - 1] as number, r = tokens[at + 1] as number, op = tokens[at] as MathOperator;
    const result = applyMathOperator(l, r, op);
    if (stages.length === 1) {
      stages.push({ tokens, active: at });
      steps.push({ ms: B[240], caption: `${expr(tokens.slice(0, at - 1))}${at > 1 ? ' ' : ''}(${minus(l)} ${sign(op)} ${minus(r)})${at + 2 < tokens.length ? ' ' : ''}${expr(tokens.slice(at + 2))}` });
    }
    if (result === null) { value = null; break; }
    tokens = [...tokens.slice(0, at - 1), result, ...tokens.slice(at + 2)];
    stages.push({ tokens, active: -1, contractedAt: at - 1 });
    steps.push({ ms: B[240], caption: expr(tokens) });
    value = tokens.length === 1 ? result : value;
  }
  const ok = value === target;
  const final = value === null ? `${original} ≠ ${target}` : `${original} = ${value}${ok ? '' : ` ≠ ${target}`}`;
  steps.push({ ms: B[120], caption: final });
  return { stages, value, steps, final, ok };
}

/* ---------- true / false ---------- */

type Q = { n: number; d: number };
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : Math.abs(a);
const q = (n: number, d = 1): Q => { const g = gcd(n, d) || 1; return { n: n / g * Math.sign(d), d: Math.abs(d / g) }; };
const qText = (x: Q) => x.d === 1 ? minus(x.n) : `${minus(x.n)}/${x.d}`;
const qOp = (x: Q, y: Q, op: string): Q | null => op === '+' ? q(x.n * y.d + y.n * x.d, x.d * y.d) : op === '−' ? q(x.n * y.d - y.n * x.d, x.d * y.d)
  : op === '×' ? q(x.n * y.n, x.d * y.d) : op === '÷' ? (y.n === 0 ? null : q(x.n * y.d, x.d * y.n)) : null;
function term(s: string): Q | null {
  const t = s.trim().replace('-', '−');
  let m = /^(−?\d+)\/(\d+)$/.exec(t); if (m) return q(Number(m[1].replace('−', '-')), Number(m[2]));
  m = /^(\d+)%$/.exec(t); if (m) return q(Number(m[1]), 100);
  m = /^(−?\d+)$/.exec(t); if (m) return q(Number(m[1].replace('−', '-')));
  return null;
}
/** "a op b" or a single term. */
function side(s: string): { value: Q; a: Q; op: string | null; b: Q | null; text: string } | null {
  const m = /^\s*(\S+)\s*([+−×÷-])\s*(\S+)\s*$/.exec(s);
  if (m) {
    const a = term(m[1]), b = term(m[3]), op = m[2] === '-' ? '−' : m[2];
    const value = a && b ? qOp(a, b, op) : null;
    return a && b && value ? { value, a, op, b, text: `${m[1]} ${op} ${m[3]}` } : null;
  }
  const v = term(s);
  return v ? { value: v, a: v, op: null, b: null, text: s.trim() } : null;
}

export type ClaimHop = { from: number; by: number; to: number };
export type ClaimPlan = {
  statement: string; relation: '=' | '<' | '>'; holds: boolean; computed: string; other: string;
  /** Whole-number + or − on one side: hops of tens then ones on an open line. */
  hops: ClaimHop[] | null; groups: { count: number; size: number } | null;
  steps: ProofStep[]; final: string; ok: boolean; claimTrue: boolean;
};
export function claimPlan(puzzle: TrueFalsePuzzle, choiceIndex: number, t: T): ClaimPlan | null {
  const statement = puzzle.payload.statement.trim();
  const m = /^(.+?)\s*(=|<|>)\s*(.+)$/.exec(statement);
  if (!m) return null;
  const left = side(m[1]), right = side(m[3]);
  if (!left || !right) return null;
  const relation = m[2] as '=' | '<' | '>';
  const worked = left.op ? left : right.op ? right : left;
  const other = worked === left ? right : left;
  const lv = left.value.n * right.value.d, rv = right.value.n * left.value.d;
  const holds = relation === '=' ? lv === rv : relation === '<' ? lv < rv : lv > rv;
  const computed = qText(worked.value);
  const question = worked.op ? `${worked.text} = ?` : `${t('puzzleTypes.minkaSays')} ${statement}`;
  const steps: ProofStep[] = [{ ms: B[120], caption: question }];
  let hops: ClaimHop[] | null = null, groups: ClaimPlan['groups'] = null;
  const whole = (x: Q | null) => !!x && x.d === 1;
  if ((worked.op === '+' || worked.op === '−') && whole(worked.a) && whole(worked.b) && worked.b!.n > 0 && worked.a.n <= 999) {
    const s = worked.op === '+' ? 1 : -1, b = worked.b!.n, tens = b - b % 10, ones = b % 10;
    let at = worked.a.n;
    hops = [tens, ones].filter(Boolean).map(n => { const h = { from: at, by: s * n, to: at + s * n }; at = h.to; return h; });
    hops.forEach(h => steps.push({ ms: B[240], caption: `${minus(h.from)} ${h.by > 0 ? '+' : '−'} ${Math.abs(h.by)} = ${minus(h.to)}` }));
  } else if (worked.op === '×' && whole(worked.a) && whole(worked.b) && worked.a.n > 0 && worked.b!.n > 0 && worked.a.n * worked.b!.n <= 144) {
    const [count, size] = worked.a.n <= 12 ? [worked.a.n, worked.b!.n] : [worked.b!.n, worked.a.n];
    groups = { count, size };
    steps.push({ ms: B[240], caption: `${worked.text} = ${computed}` });
  } else {
    steps.push({ ms: B[240], caption: `${worked.text} = ${computed}` });
  }
  const otherText = qText(other.value);
  const shownRelation = lv === rv ? '=' : lv < rv ? '<' : '>';
  const compare = worked === left ? `${computed} ${shownRelation} ${otherText}` : `${otherText} ${shownRelation} ${computed}`;
  const final = worked.op ? `${worked.text} = ${computed}` : compare;
  const claimTrue = puzzle.isTrue;
  const ok = (choiceIndex === 0) === claimTrue;
  return { statement, relation, holds, computed, other: otherText, hops, groups, steps, final, ok, claimTrue };
}
