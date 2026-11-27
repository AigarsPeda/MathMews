import { getPuzzleType } from '@/utils/puzzle-type';
import type { HelpTemplate, Puzzle } from '@/types/puzzle';

/**
 * Picture help is one worked example per kind of maths, reused by every puzzle of that kind.
 * The example is a fixture of the same type and payload as a real puzzle, with numbers no catalog
 * puzzle of that kind uses, so help explains the method and never shows the current puzzle's answer.
 * The help sheet plays the fixture's correct-answer proof (puzzleQADraft → CheckedPuzzleReveal 'worked').
 */
export const MIGRATED_HELP_KEYS = ['coordinates', 'ratio', 'order_sort', 'route', 'area', 'perimeter', 'shapes', 'place_value', 'decimals', 'percent', 'measure_share', 'bars_total', 'bars_missing', 'bars_mean', 'multi_step', 'estimate', 'unit_price', 'discount', 'bars', 'capacity', 'grid_turn', 'grid_flip', 'symmetry', 'volume', 'grid_moves', 'clock', 'money', 'fraction_of_set', 'fraction_line', 'fraction_parts', 'fraction_sort', 'fraction_equivalent', 'fraction_compare', 'pattern', 'compare', 'number_line', 'target', 'add', 'subtract', 'multiply', 'divide', 'machine', 'balance', 'check_work'] as const;
export type MigratedHelpKey = (typeof MIGRATED_HELP_KEYS)[number];
const base = { difficulty: 'easy' as const, ageRange: [5, 7] as [number, number], hint: '', explanation: '' };

export const HELP_EXAMPLES: Record<MigratedHelpKey, Puzzle> = {
  coordinates: { ...base, id: 'help-example-coordinates', topic: 'spatial', type: 'coordinate_map', question: 'Where is (3, 2)?',
    payload: { mode: 'plot', min: 0, max: 3, start: { x: 0, y: 0 }, end: { x: 3, y: 2 }, guided: true } },
  ratio: { ...base, id: 'help-example-ratio', topic: 'multiplication', type: 'ratio_table', question: 'Four 4 L bottles. How many litres?',
    payload: { a: 1, b: 4, targetA: 4, guided: true } },
  order_sort: { ...base, id: 'help-example-order-sort', topic: 'comparison', type: 'order_numbers', question: 'Which numbers come first?',
    payload: { numbers: [4, 9, 2, 7], correctOrder: [2, 4, 7, 9] } },
  route: { ...base, id: 'help-example-route', topic: 'operations', type: 'route_grid', question: 'From 4, what do +3 then ×2 give?',
    payload: { columns: 2, start: 4, moves: 2, target: 14, cells: [null, { operator: '+', operand: 3 }, { operator: '+', operand: 1 }, { operator: '×', operand: 2 }] } },
  bars_missing: { ...base, id: 'help-example-bars-missing', type: 'multiple_choice', topic: 'data',
    question: 'The total is 12. How many in C?', choices: ['3', '4', '5'], correctIndex: 0,
    everyday: { model: { kind: 'bars', task: 'missing', values: [5, 4, 3], step: 1, index: 2, total: 12, label: 'A: 5, B: 4, C: ?' } } },
  bars_mean: { ...base, id: 'help-example-bars-mean', type: 'multiple_choice', topic: 'data',
    question: 'What is the mean of 2, 6 and 4?', choices: ['4', '3', '6'], correctIndex: 0,
    everyday: { model: { kind: 'bars', task: 'mean', values: [2, 6, 4], step: 1, index: 0, label: 'A: 2, B: 6, C: 4' } } },
  multi_step: { ...base, id: 'help-example-multi-step', type: 'multiple_choice', topic: 'money', helpTemplate: 'multiply_subtract',
    question: 'Pay €20 for 3 packs at €4. Change?', choices: ['€8', '€12', '€16'], correctIndex: 0,
    everyday: { model: { kind: 'money', task: 'change', prices: [400], quantities: [3], unit: 'euros', paid: 2000, discount: 0, label: '3 × €4' } } },
  estimate: { ...base, id: 'help-example-estimate', type: 'estimate', topic: 'estimation',
    question: 'Which ten is nearest to 23 + 25?', correctIndex: 0, payload: { expression: '23 + 25', choices: ['50', '40', '60'] } },
  measure_share: { ...base, id: 'help-example-measure_share', type: 'multiple_choice', topic: 'capacity',
    question: '600 mL fills how many cups?', choices: ['4', '3', '5'], correctIndex: 0,
    everyday: { model: { kind: 'capacity', task: 'servings', amounts: [600], capacities: [600], portion: 150, unit: 'ml', label: '600 mL ÷ 150 mL' } } },
  bars_total: { ...base, id: 'help-example-bars_total', type: 'multiple_choice', topic: 'data',
    question: 'How many altogether?', choices: ['9', '8', '7'], correctIndex: 0,
    everyday: { model: { kind: 'bars', task: 'total', values: [3, 4, 2], step: 1, index: 0, label: 'A: 3, B: 4, C: 2' } } },
  unit_price: { ...base, id: 'help-example-unit_price', type: 'multiple_choice', topic: 'money',
    question: '3 apples cost 60 c. How much each?', choices: ['20 c', '30 c', '10 c'], correctIndex: 0,
    everyday: { model: { kind: 'money', task: 'unit', prices: [60], quantities: [3], unit: 'cents', paid: 0, discount: 0, label: '3 🍎 · 60 c' } } },
  discount: { ...base, id: 'help-example-discount', type: 'multiple_choice', topic: 'money',
    question: 'What do you pay after 25% off €40?', choices: ['€30', '€10', '€25'], correctIndex: 0,
    everyday: { model: { kind: 'money', task: 'discount', prices: [4000], quantities: [1], unit: 'euros', paid: 0, discount: 25, label: '€40 · −25%' } } },
  place_value: { ...base, id: 'help-example-place-value', type: 'place_value', topic: 'addition',
    question: 'How can you bundle 33?', payload: { start: 33, mode: 'bundle', guided: true } },
  decimals: { ...base, id: 'help-example-decimals', type: 'decimal_grid', topic: 'fractions',
    question: 'How do you shade 0.12?', payload: { hundredths: 12, scale: 100, digits: 2, guided: true } },
  percent: { ...base, id: 'help-example-percent', type: 'multiple_choice', topic: 'fractions', helpTemplate: 'percent_half',
    question: 'What is 50% of 40?', choices: ['20', '10', '40'], correctIndex: 0,
    percentageExample: { whole: 40, percent: 50, kind: 'amount' } },
  area: { ...base, id: 'help-example-area', topic: 'spatial', type: 'geometry_measure', helpTemplate: 'geometry_area',
    question: 'How many squares fit inside?', payload: { mode: 'area', width: 4, height: 2, guided: true } },
  perimeter: { ...base, id: 'help-example-perimeter', topic: 'spatial', type: 'geometry_measure', helpTemplate: 'geometry_perimeter',
    question: 'How far around the rectangle?', payload: { mode: 'perimeter', width: 5, height: 3, guided: true } },
  shapes: { ...base, id: 'help-example-shapes', topic: 'spatial', type: 'multiple_choice',
    question: 'How many sides does it have?', choices: ['4', '5', '6'], correctIndex: 1,
    everyday: { model: { kind: 'shapes', task: 'sides', sides: [5], rectangle: false, label: 'Pentagon' } } },
  bars: { ...base, id: 'help-example-bars', type: 'multiple_choice', topic: 'data',
    question: 'How many more in B than A?', choices: ['9', '12', '15'], correctIndex: 0,
    everyday: { model: { kind: 'bars', task: 'difference', values: [3, 12], step: 3, index: 0, label: 'A: 3, B: 12' } } },
  capacity: { ...base, id: 'help-example-capacity', type: 'multiple_choice', topic: 'capacity',
    question: 'How much after adding 650 mL?', choices: ['1000', '650', '350'], correctIndex: 0,
    everyday: { model: { kind: 'capacity', task: 'total', amounts: [350, 650], capacities: [350, 650], portion: 50, unit: 'ml', label: '350 mL + 650 mL' } } },
  grid_turn: { ...base, id: 'help-example-grid-turn', type: 'multiple_choice', topic: 'spatial',
    question: 'Where does 2 land?', choices: ['6', '4', '8'], correctIndex: 0,
    everyday: { model: { kind: 'grid', task: 'rotate', size: 3, start: 2, dx: 0, dy: 0, turns: 1, label: '2 ↻' } } },
  grid_flip: { ...base, id: 'help-example-grid-flip', type: 'multiple_choice', topic: 'spatial',
    question: 'Where does 5 land?', choices: ['8', '7', '6'], correctIndex: 0,
    everyday: { model: { kind: 'grid', task: 'reflect', size: 4, start: 5, dx: 0, dy: 0, turns: 0, label: '5 ↔' } } },
  symmetry: { ...base, id: 'help-example-symmetry', type: 'multiple_choice', topic: 'spatial',
    question: 'Do the two halves match?', choices: ['Yes', 'No'], correctIndex: 0,
    everyday: { model: { kind: 'shapes', task: 'symmetry', sides: [12], rectangle: false, label: 'Heart' } } },
  volume: { ...base, id: 'help-example-volume', type: 'multiple_choice', topic: 'capacity',
    question: 'How many cubes fill the box?', choices: ['12', '6', '10'], correctIndex: 0,
    everyday: { model: { kind: 'solid', width: 2, depth: 3, height: 2, answerUnit: 'cubes', label: '2 × 3 × 2' } } },
  grid_moves: { ...base, id: 'help-example-grid-moves', type: 'multiple_choice', topic: 'spatial',
    question: '2 right, 1 up from 7. Where now?', choices: ['6', '9', '3'], correctIndex: 0,
    everyday: { model: { kind: 'grid', task: 'translate', size: 3, start: 7, dx: 2, dy: -1, turns: 0, label: '7 → → ↑' } } },
  clock: { ...base, id: 'help-example-clock', type: 'multiple_choice', topic: 'time',
    question: 'What is 20 minutes after 3:00?', choices: ['3:20', '3:04', '3:40'], correctIndex: 0,
    everyday: { model: { kind: 'clock', task: 'finish', minutes: 180, duration: 20, analog: true, label: '3:00 + 20 min' } } },
  money: { ...base, id: 'help-example-money', type: 'multiple_choice', topic: 'money',
    question: 'How much is 20 c plus 10 c?', choices: ['30 c', '20 c', '10 c'], correctIndex: 0,
    everyday: { model: { kind: 'money', task: 'total', prices: [20, 10], quantities: [1, 1], unit: 'cents', coins: true,
      paid: 0, discount: 0, label: '20 c + 10 c' } } },
  fraction_of_set: { ...base, id: 'help-example-fraction-set', topic: 'fractions', type: 'multiple_choice', helpTemplate: 'fraction_of_set',
    question: 'What is 1/3 of 9 counters?', choices: ['3', '6', '9'], correctIndex: 0,
    fractionExample: { numerator: 1, denominator: 3, whole: 9 }, taskVisual: { kind: 'share', items: 9, groups: 3 } },
  fraction_line: { ...base, id: 'help-example-fraction-line', topic: 'fractions', type: 'fraction_number_line', question: 'Where is 3/5 on the line?',
    payload: { numerator: 3, denominator: 5, divisions: 5, guided: false } },
  fraction_parts: { ...base, id: 'help-example-fraction-parts', topic: 'fractions', type: 'fraction_strip', question: 'How do you shade 2/7?',
    payload: { numerator: 2, denominator: 7, partitions: [7], mode: 'build', guided: true } },
  fraction_sort: { ...base, id: 'help-example-fraction-sort', topic: 'fractions', type: 'sort_buckets', helpTemplate: 'fraction_sort',
    question: 'Which strips match?', payload: { rule: 'fractions', targets: [[2, 5], [3, 5]], fractions: [[6, 10], [4, 10]] } },
  fraction_equivalent: { ...base, id: 'help-example-fraction-equivalent', topic: 'fractions', type: 'fraction_equivalent', question: 'How many sixths equal 1/3?',
    payload: { numerator: 1, denominator: 3, choices: ['2/6', '1/6', '3/6'] }, correctIndex: 0 },
  fraction_compare: { ...base, id: 'help-example-fraction-compare', topic: 'fractions', type: 'compare', helpTemplate: 'fraction_compare_unit', question: 'Which is bigger, 1/3 or 1/4?',
    payload: { optionA: '1/3', optionB: '1/4' }, correctIndex: 0 },
  pattern: { ...base, id: 'help-example-pattern', topic: 'patterns', type: 'pattern_next', question: '8, 11, 14. What comes next?',
    payload: { sequence: [8, 11, 14], choices: ['17', '16', '18'] }, correctIndex: 0 },
  compare: { ...base, id: 'help-example-compare', topic: 'comparison', type: 'compare', question: 'Which is bigger, 43 or 47?',
    payload: { optionA: '43', optionB: '47' }, correctIndex: 1 },
  number_line: { ...base, id: 'help-example-number-line', topic: 'addition', type: 'number_line', question: 'Start at 24. Hop 3 ahead.',
    payload: { start: 24, jump: 3, min: 24, max: 27, correctValue: 27 } },
  target: { ...base, id: 'help-example-target', topic: 'addition', type: 'pair_sum', question: 'Which two tiles make 13?',
    payload: { numbers: [8, 2, 5], target: 13, correctIndices: [0, 2] } },
  add: { ...base, id: 'help-example-add', topic: 'addition', type: 'multiple_choice', question: 'The cat has 4 ribbons and adds 6 more. How many altogether?',
    choices: ['10', '9', '11'], correctIndex: 0, taskVisual: { kind: 'join', left: 4, right: 6, object: 'ribbon' } },
  subtract: { ...base, id: 'help-example-subtract', topic: 'subtraction', type: 'multiple_choice', question: 'There are 9 stars. Take away 4. How many are left?',
    choices: ['5', '6', '4'], correctIndex: 0, taskVisual: { kind: 'take_away', left: 9, right: 4, object: 'star' } },
  multiply: { ...base, id: 'help-example-multiply', topic: 'multiplication', type: 'multiple_choice', question: '3 rows of 3 mice. How many mice?',
    choices: ['9', '6', '12'], correctIndex: 0, taskVisual: { kind: 'array', rows: 3, columns: 3, object: 'mouse' } },
  divide: { ...base, id: 'help-example-divide', topic: 'division', type: 'fair_share', question: 'Share 6 cookies equally on 3 plates.',
    correctIndex: 0, payload: { items: 6, people: 3, object: 'cookie', emoji: '🍪', choices: ['2 each', '3 each', '1 each'] } },
  machine: { ...base, id: 'help-example-machine', topic: 'patterns', type: 'function_machine', question: 'Which rule turns 5 into 10?',
    payload: { input: 5, output: 10, choices: ['×2', '+3', '+4'] }, correctIndex: 0 },
  balance: { ...base, id: 'help-example-balance', topic: 'equality', type: 'equation_board', question: 'Get one x on its own.',
    payload: { a: 1, b: 4, c: 9, guided: false } },
  check_work: { ...base, id: 'help-example-check-work', topic: 'addition', type: 'true_false', isTrue: false,
    question: 'Is 6 + 7 = 12 right?', payload: { statement: '6 + 7 = 12' } },
};

export function helpTemplateFor(puzzle: Puzzle): HelpTemplate | "number_line" {
  if (puzzle.helpTemplate) return puzzle.helpTemplate;
  const type = getPuzzleType(puzzle);
  if (type === "geometry_measure") return "geometry_area";
  if (type === "decimal_grid") return "decimal_grid_100";
  if (type === "decimal_place_value") return "decimal_place_build";
  if (type === "fraction_strip") return "fraction_strip_build";
  if (type === "place_value") return "base_ten_build";
  if (type === "find_all_pairs") return "all_pairs";
  if (type !== "multiple_choice") return type;
  switch (puzzle.topic) {
    case "addition": return "addition";
    case "subtraction": return "subtraction";
    case "multiplication": return "multiplication";
    case "division": return "division";
    case "fractions": return "fraction_build";
    case "comparison": return "compare";
    case "patterns": return "pattern_next";
    case "equality": return "balance";
    case "estimation": return "estimate";
    case "mental_math": return "pair_sum";
    case "operations": return "target_build";
    case "logic": return "odd_range";
    case "cat-plans": case "time": case "data": case "spatial": case "money": case "capacity": return "addition";
  }
}

const MIGRATED_TEMPLATES: Record<string, MigratedHelpKey> = {
  coordinate_map: 'coordinates', ratio_table: 'ratio', rate: 'ratio', order_numbers: 'order_sort', sort_buckets: 'order_sort', route_grid: 'route',
  bridge_positive: 'number_line', budget_plan: 'multi_step', multiply_subtract: 'multi_step', estimate: 'estimate',
  base_ten_build: 'place_value', base_ten_add: 'place_value', base_ten_subtract: 'place_value',
  base_ten_bundle: 'place_value', base_ten_split: 'place_value',
  decimal_grid_10: 'decimals', decimal_grid_100: 'decimals', decimal_place_build: 'decimals',
  decimal_place_tenths: 'decimals', decimal_place_bundle: 'decimals', decimal_place_split: 'decimals',
  percent_discount: 'discount', percent_half_discount: 'discount', percent_tenth_discount: 'discount', percent_fifth_discount: 'discount',
  percent_of: 'percent', percent_half: 'percent', percent_tenth: 'percent', percent_fifth: 'percent',
  geometry_area: 'area', geometry_missing_area: 'area', geometry_compare: 'perimeter',
  geometry_perimeter: 'perimeter', geometry_missing_perimeter: 'perimeter',
  fraction_of_set: 'fraction_of_set', fraction_unit_set: 'fraction_of_set', fraction_number_line: 'fraction_line',
  fraction_build: 'fraction_parts', fraction_match: 'fraction_parts', fraction_strip_build: 'fraction_parts', easy_fraction_half: 'fraction_parts',
  fraction_sort: 'fraction_sort', fraction_equivalent: 'fraction_equivalent', fraction_decimal_link: 'fraction_equivalent',
  fraction_compare_half: 'fraction_compare', fraction_compare_same_numerator: 'fraction_compare', fraction_compare_common: 'fraction_compare',
  fraction_compare_unit: 'fraction_compare', easy_fraction_compare: 'fraction_compare',
  pattern_next: 'pattern', repair_pattern: 'pattern', compare: 'compare', number_range: 'compare',
  number_line: 'number_line', signed_line: 'number_line', target_build: 'target', pair_sum: 'target', all_pairs: 'target',
  addition: 'add', subtraction: 'subtract', multiplication: 'multiply', division: 'divide', fair_share: 'divide',
  function_machine: 'machine', operation_path: 'machine', balance: 'balance', equation_board: 'balance',
};
const ARITHMETIC_TOPICS = new Set(['addition', 'subtraction', 'multiplication', 'division']);

/** Every catalog puzzle maps to exactly one key. */
export function helpKeyFor(puzzle: Puzzle): MigratedHelpKey | null {
  const model = 'everyday' in puzzle && puzzle.everyday?.model;
  if (model && model.kind === 'shapes' && (model.task === 'sides' || model.task === 'corners')) return 'shapes';
  if (puzzle.helpTemplate === 'multiply_subtract') return 'multi_step';
  if (model && model.kind === 'bars' && model.task === 'missing') return 'bars_missing';
  if (model && model.kind === 'bars' && model.task === 'mean') return 'bars_mean';
  if (model && model.kind === 'bars' && model.task === 'total') return 'bars_total';
  if (model && model.kind === 'capacity' && ['servings', 'containers'].includes(model.task)) return 'measure_share';
  if (model && model.kind === 'money' && model.task === 'unit') return 'unit_price';
  if (model && model.kind === 'money' && model.task === 'discount') return 'discount';
  if (model && model.kind === 'bars' && !['missing', 'total', 'mean'].includes(model.task)) return 'bars';
  if (model && model.kind === 'capacity' && !['servings', 'containers'].includes(model.task)) return 'capacity';
  if (model && model.kind === 'solid') return 'volume';
  if (model && model.kind === 'shapes' && model.task === 'symmetry') return 'symmetry';
  if (model && model.kind === 'grid' && model.task === 'rotate') return 'grid_turn';
  if (model && model.kind === 'grid' && model.task === 'reflect') return 'grid_flip';
  if (model && model.kind === 'grid' && model.task === 'translate') return 'grid_moves';
  if (model && model.kind === 'clock') return 'clock';
  if (model && model.kind === 'money' && model.task !== 'discount' && model.task !== 'unit') return 'money';
  const template = helpTemplateFor(puzzle);
  const migrated = MIGRATED_TEMPLATES[template];
  // The old engine fell back to "addition" for time, data, money and similar stories; those are not arithmetic helps.
  const arithmetic = puzzle.helpTemplate !== undefined || (puzzle.type ?? 'multiple_choice') !== 'multiple_choice' || ARITHMETIC_TOPICS.has(puzzle.topic);
  if (migrated && (template !== 'addition' || arithmetic)) return migrated;
  // A claim to judge or work to repair: recompute it and compare. Puzzles with a more specific template keep that template's help.
  if (puzzle.type === 'true_false' || puzzle.type === 'fix_mistake') return 'check_work';
  return null;
}

/** The example puzzle a migrated key teaches with. */
export function helpExampleFor(puzzle: Puzzle): { key: MigratedHelpKey; example: Puzzle } | null {
  const key = helpKeyFor(puzzle);
  return key ? { key, example: HELP_EXAMPLES[key] } : null;
}

/** The quantities a puzzle shows: its structured givens when it has them, otherwise the numbers in its question. */
export function puzzleGivens(puzzle: Puzzle): number[] {
  const model = 'everyday' in puzzle && puzzle.everyday?.model;
  if (model && model.kind === 'shapes') return [...model.sides].sort((a, b) => a - b);
  if (puzzle.type === 'geometry_measure') return [puzzle.payload.width, puzzle.payload.height].sort((a, b) => a - b);
  if (model && model.kind === 'clock') return [model.minutes, model.duration ?? (model.end ?? model.minutes) - model.minutes];
  if (puzzle.type === 'estimate') return (puzzle.payload.expression.match(/\d+/g) ?? []).map(Number).sort((a, b) => a - b);
  if (puzzle.type === 'budget_plan') return [puzzle.payload.budget, ...puzzle.payload.items.map(item => item.price)].sort((a, b) => a - b);
  if (model && model.kind === 'money' && puzzle.helpTemplate === 'multiply_subtract') return [model.quantities[0], model.prices[0] / 100, model.paid / 100].sort((a, b) => a - b);
  if (model && model.kind === 'money' && model.task === 'unit') return [model.prices[0], model.quantities[0]];
  if (model && model.kind === 'money' && model.task === 'discount') {
    const subtotal = model.prices.reduce((sum, price, i) => sum + price * model.quantities[i], 0);
    return [model.unit === 'euros' ? subtotal / 100 : subtotal, model.discount];
  }
  if (model && model.kind === 'capacity' && ['servings', 'containers'].includes(model.task)) return [model.amounts[0], model.portion];
  if (model && model.kind === 'money') return model.prices.map((price, i) => price * model.quantities[i]).sort((a, b) => a - b);
  if (model && model.kind === 'bars') return [...model.values].sort((a, b) => a - b);
  if (model && model.kind === 'capacity') return [...model.amounts].sort((a, b) => a - b);
  if (model && model.kind === 'solid') return [model.width, model.depth, model.height];
  if (model && model.kind === 'grid' && model.task !== 'translate') return model.task === 'rotate' ? [model.size, model.start, model.turns] : [model.size, model.start];
  if (model && model.kind === 'grid') return [model.size, model.start, model.dx, model.dy];
  const numbers = (text: string) => (text.match(/[-−]?\d+/g) ?? []).map(n => Number(n.replace('−', '-')));
  if (puzzle.percentageExample) return [puzzle.percentageExample.whole, puzzle.percentageExample.percent];
  switch (puzzle.type) {
    case 'coordinate_map': return [puzzle.payload.start.x, puzzle.payload.start.y, puzzle.payload.end.x, puzzle.payload.end.y];
    case 'ratio_table': return [puzzle.payload.a, puzzle.payload.b, puzzle.payload.targetA];
    case 'order_numbers': return [...puzzle.payload.correctOrder];
    case 'sort_buckets': return (puzzle.payload.rule === 'range' ? [...puzzle.payload.numbers]
      : [...puzzle.payload.targets.flat(), ...puzzle.payload.fractions.flat()]).sort((a, b) => a - b);
    case 'route_grid': return [puzzle.payload.start, ...puzzle.payload.cells.flatMap(cell => cell ? [cell.operand] : []), puzzle.payload.target];
    case 'decimal_grid': case 'decimal_place_value': return [puzzle.payload.hundredths];
    case 'place_value': return [puzzle.payload.start, ...(puzzle.payload.operand === undefined ? [] : [puzzle.payload.operand])];
    case 'fraction_strip': case 'fraction_build': case 'fraction_equivalent':
      return [puzzle.payload.numerator, puzzle.payload.denominator];
    case 'fraction_match': return puzzle.payload.pairs.flatMap(pair => [pair.numerator, pair.denominator]);
    case 'pattern_next': return [...puzzle.payload.sequence].sort((a, b) => a - b);
    case 'repair_pattern': return puzzle.payload.sequence.filter((n): n is number => n != null).sort((a, b) => a - b);
    case 'compare': return [puzzle.payload.optionA, puzzle.payload.optionB].flatMap(numbers).sort((a, b) => a - b);
    case 'number_line': return [puzzle.payload.start, puzzle.payload.jump].sort((a, b) => a - b);
    case 'fraction_number_line': return [puzzle.payload.numerator, puzzle.payload.denominator].sort((a, b) => a - b);
    case 'signed_line': return [puzzle.payload.start, puzzle.payload.delta].sort((a, b) => a - b);
    case 'function_machine': return [puzzle.payload.input, puzzle.payload.output].sort((a, b) => a - b);
    case 'equation_board': return [puzzle.payload.a, puzzle.payload.b, puzzle.payload.c].sort((a, b) => a - b);
    case 'true_false': return numbers(puzzle.payload.statement).sort((a, b) => a - b);
    case 'fix_mistake': return numbers(puzzle.payload.wrongWork.join(' ')).sort((a, b) => a - b);
    case 'pair_sum': case 'target_build': case 'find_all_pairs':
      return [...puzzle.payload.numbers, puzzle.payload.target].sort((a, b) => a - b);
  }
  if ('fractionExample' in puzzle && puzzle.fractionExample?.whole) {
    const { numerator, denominator, whole } = puzzle.fractionExample;
    return [numerator, denominator, whole].sort((a, b) => a - b);
  }
  const structured = 'taskVisual' in puzzle && puzzle.taskVisual
    ? puzzle.taskVisual.kind === 'array' ? [puzzle.taskVisual.rows, puzzle.taskVisual.columns]
      : puzzle.taskVisual.kind === 'share' ? [puzzle.taskVisual.items, puzzle.taskVisual.groups]
      : [puzzle.taskVisual.left, puzzle.taskVisual.right]
    : puzzle.type === 'fair_share' ? [puzzle.payload.items, puzzle.payload.people] : undefined;
  return (structured ?? (puzzle.question.match(/\d+/g) ?? []).map(Number)).slice().sort((a, b) => a - b);
}
