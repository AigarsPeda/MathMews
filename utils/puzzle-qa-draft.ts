import { MATH_OPERATORS, type Puzzle, type RouteGridPuzzle } from '@/types/puzzle';
import { bridgeTarget, isBridgePuzzle, transformEquation, type EquationMove } from '@/utils/bridge-models';
import { checkChallengeAnswer, getRouteValue, getSortBucket } from '@/utils/challenge-puzzles';
import type { AttemptArrangement } from '@/utils/checked-attempt';
import { changeDecimalPlace, initialDecimalPlace } from '@/utils/decimal-models';
import { geometryTarget } from '@/utils/geometry-models';
import { initialPlaceValue, placeValueProof } from '@/utils/place-value';
import { getPuzzleDraftAnswer, type PuzzleDraft } from '@/utils/puzzle-attempt';
import { checkPuzzleAnswer, getValidPairs } from '@/utils/puzzle-type';

export type QAOutcome = 'correct' | 'wrong';
const indices = (count: number) => Array.from({ length: count }, (_, i) => i);

function routeFixture(puzzle: RouteGridPuzzle, correct: boolean, cells = [0]): number[] | undefined {
  if (cells.length === puzzle.payload.moves + 1) {
    return cells.at(-1) === puzzle.payload.cells.length - 1 && checkChallengeAnswer(puzzle, { kind: 'route', cells }) === correct ? cells : undefined;
  }
  for (const i of indices(puzzle.payload.cells.length)) {
    const next = [...cells, i];
    if (getRouteValue(puzzle, next) === null) continue;
    const found = routeFixture(puzzle, correct, next);
    if (found) return found;
  }
}

export function puzzleQADraft(puzzle: Puzzle, outcome: QAOutcome) {
  const correct = outcome === 'correct';
  const draft: PuzzleDraft = { choice: null, shaded: 0, operators: [], numberLine: null, pairIndices: [], order: [], matchedCount: 0, pairs: [], challenge: null };
  const arrangement: AttemptArrangement = { selectedSlices: [], decimalCells: [], distribution: [], matchedIds: [] };
  const response = puzzle.response;
  if (response?.kind === 'judge') draft.response = correct ? response.isCorrect : !response.isCorrect;
  else if (response?.kind === 'choose') draft.response = String((response.correctIndex + Number(!correct)) % response.options.length);
  else if (response?.kind === 'write') {
    if (correct) draft.response = response.answer;
    else if ('everyday' in puzzle && puzzle.everyday?.model.kind === 'grid') {
      const cells = puzzle.everyday.model.size ** 2;
      draft.response = String(Number(response.answer) % cells + 1);
    } else if (response.format === 'clock') draft.response = /^0?0:00$/.test(response.answer) ? '01:00' : '00:00';
    else if (response.format === 'fraction') {
      const [n,d] = response.answer.split('/').map(Number);
      draft.response = String(n + 1) + '/' + d;
    } else draft.response = String(Number(response.answer.replace(',', '.')) + 1);
  } else if (isBridgePuzzle(puzzle)) {
    const target = bridgeTarget(puzzle);
    if (typeof target !== 'number') draft.bridge = { point: { ...target, x: correct ? target.x : puzzle.type === 'coordinate_map' && target.x === puzzle.payload.max ? target.x - 1 : target.x + 1 } };
    else if (puzzle.type === 'equation_board') {
      const { a, b, c } = puzzle.payload;
      const equationMoves: EquationMove[] = correct
        ? Array.from({ length: Math.abs(b) }, () => ({ operation: 'add', amount: -Math.sign(b) }))
        : [{ operation: 'add', amount: b < 0 ? -1 : 1 }];
      if (correct && a > 1) equationMoves.push({ operation: 'divide', amount: a });
      let equation = { a, b, c };
      for (const move of equationMoves) {
        const next = transformEquation(equation, move.operation, move.amount);
        if (!next) return;
        equation = next;
      }
      draft.bridge = { equation, equationMoves };
    } else draft.bridge = { value: target + Number(!correct) };
  } else switch (puzzle.type) {
    case 'budget_plan': {
      const { items, pickCount } = puzzle.payload;
      const baskets = (start: number, chosen: number[]): number[] | undefined => {
        if (chosen.length === pickCount) return checkChallengeAnswer(puzzle, { kind: 'budget', indices: chosen }) === correct ? chosen : undefined;
        for (let i = start; i < items.length; i++) {
          const result = baskets(i + 1, [...chosen, i]);
          if (result) return result;
        }
      };
      const basket = baskets(0, []);
      if (basket) draft.challenge = { kind: 'budget', indices: basket };
      break;
    }
    case 'route_grid': {
      const cells = routeFixture(puzzle, correct);
      if (cells) draft.challenge = { kind: 'route', cells };
      break;
    }
    case 'repair_pattern': {
      const { tiles, solution } = puzzle.payload;
      const values = [...solution];
      if (!correct) {
        const spare = tiles.find(n => n !== values[0] && tiles.filter(v => v === n).length > values.filter(v => v === n).length);
        if (spare !== undefined) values[0] = spare;
        else values.reverse();
      }
      draft.challenge = { kind: 'sequence', values };
      break;
    }
    case 'sort_buckets': {
      const p = puzzle.payload;
      const buckets = indices(p.rule === 'range' ? p.numbers.length : p.fractions.length).map(i => getSortBucket(puzzle, i));
      if (!correct) buckets[0] = (buckets[0] + 1) % (p.rule === 'range' ? 2 : p.targets.length);
      draft.challenge = { kind: 'sort', buckets };
      break;
    }
    case 'place_value': {
      const final = placeValueProof(puzzle).final;
      draft.placeValue = correct ? final : puzzle.payload.mode === 'build'
        ? { ...final, ones: final.ones > 0 ? final.ones - 1 : 1 } : initialPlaceValue(puzzle);
      break;
    }
    case 'geometry_measure': {
      const target = geometryTarget(puzzle);
      draft.geometry = correct ? target : puzzle.payload.mode === 'compare' ? (target + 1) % 3 : target + 1;
      break;
    }
    case 'decimal_grid': {
      const { scale, hundredths } = puzzle.payload;
      draft.decimalGrid = (hundredths * scale / 100 + Number(!correct)) % (scale + 1);
      arrangement.decimalCells = indices(draft.decimalGrid).map(i => (i * 3) % scale);
      break;
    }
    case 'decimal_place_value': {
      const { mode, hundredths, exchangeUnit } = puzzle.payload;
      const initial = initialDecimalPlace(puzzle);
      draft.decimalPlace = !correct ? initial : mode === 'build' ? { ones: Math.floor(hundredths / 100), tenths: Math.floor(hundredths / 10) % 10, hundredths: hundredths % 10 }
        : changeDecimalPlace(puzzle, initial, { kind: mode, unit: exchangeUnit });
      break;
    }
    case 'fraction_strip': {
      const { numerator, denominator, partitions } = puzzle.payload;
      const parts = partitions.find(n => n * numerator % denominator === 0 && n !== denominator) ?? denominator;
      const shaded = (parts * numerator / denominator + Number(!correct)) % (parts + 1);
      draft.fractionStrip = { parts, shaded, selected: indices(shaded).map(i => parts - i - 1) };
      break;
    }
    case 'fraction_build': {
      const { numerator, denominator } = puzzle.payload;
      draft.shaded = correct ? numerator : numerator % denominator + 1;
      arrangement.selectedSlices = indices(draft.shaded).map(i => denominator - i - 1);
      break;
    }
    case 'fraction_number_line': {
      const { numerator, denominator, divisions } = puzzle.payload;
      draft.numberLine = (numerator * divisions / denominator + Number(!correct)) % (divisions + 1);
      break;
    }
    case 'number_line': {
      const { min,max,correctValue } = puzzle.payload;
      draft.numberLine = correct ? correctValue : correctValue < max ? correctValue + 1 : min;
      break;
    }
    case 'order_numbers': draft.order = [...puzzle.payload.correctOrder]; if (!correct) draft.order.reverse(); break;
    case 'operation_path': case 'target_build': {
      draft.operators = puzzle.type === 'operation_path' ? puzzle.payload.steps.map(s => s.operator) : [...puzzle.payload.solution];
      if (!correct) {
        for (const op of MATH_OPERATORS) {
          const operators = [op, ...draft.operators.slice(1)] as typeof MATH_OPERATORS;
          if (!checkPuzzleAnswer(puzzle, { kind: 'operators', operators })) { draft.operators = operators; break; }
        }
      }
      break;
    }
    case 'pair_sum': case 'find_all_pairs': {
      const { numbers, target } = puzzle.payload;
      const valid = getValidPairs(numbers, target);
      const pair = correct ? valid[0] : numbers.flatMap((_, a) => indices(numbers.length).filter(b => b > a && numbers[a] + numbers[b] !== target).map(b => [a,b] as [number,number]))[0];
      if (pair) { draft.pairIndices = pair; draft.pairs = [pair, ...valid.slice(1)]; }
      break;
    }
    case 'fraction_match':
      draft.selectedByPair = puzzle.payload.pairs.map(({ numerator, denominator }, i) => {
        const count = correct || i !== puzzle.payload.pairs.length - 1 ? numerator
          : numerator < denominator ? numerator + 1 : numerator - 1;
        return indices(count).map(wedge => denominator - 1 - wedge);
      });
      break;
    case 'fair_share': {
      const { items, people } = puzzle.payload;
      arrangement.distribution = indices(items).map(i => correct
        ? (i < items - items % people ? i % people + 1 : 0)
        : (i === 0 ? 1 : 0));
      draft.distribution = arrangement.distribution;
      break;
    }
    case 'true_false': draft.choice = Number(puzzle.isTrue !== correct); break;
    default: {
      const count = 'choices' in puzzle ? puzzle.choices.length : 'choices' in puzzle.payload ? puzzle.payload.choices.length : 2;
      draft.choice = (puzzle.correctIndex + Number(!correct)) % count;
    }
  }
  // Include a partly dealt practice board so retries exercise the frozen locations.
  if (puzzle.type === 'multiple_choice' && puzzle.taskVisual?.kind === 'share') {
    const { items, groups } = puzzle.taskVisual;
    arrangement.distribution = indices(items).map(i => i < groups ? i + 1 : 0);
  }
  const answer = getPuzzleDraftAnswer(puzzle, draft);
  return answer && checkPuzzleAnswer(puzzle, answer) === correct ? { draft, arrangement, answer, correct } : null;
}
