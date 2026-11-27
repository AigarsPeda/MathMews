/** Picture help: one worked example per kind of maths, never the current puzzle's own numbers. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { readPuzzles } from './puzzles/catalog.mjs';

const root = process.cwd(), cache = new Map();
function load(id) {
  if (id === 'react') return {};
  if (id === 'react-native') return { Dimensions: { get: () => ({ width: 390, height: 844 }) }, PixelRatio: { roundToNearestPixel: n => n } };
  const file = id.startsWith('@/') ? path.join(root, id.slice(2)) : id;
  const resolved = fs.existsSync(file) && fs.statSync(file).isFile() ? file : ['.ts', '.tsx', '.json'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} }; cache.set(resolved, module);
  if (resolved.endsWith('.json')) { module.exports = JSON.parse(fs.readFileSync(resolved, 'utf8')); return module.exports; }
  const source = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: load, Date, Math, Set, Map, Number, JSON, Array, Object, String });
  return module.exports;
}
const { HELP_EXAMPLES, MIGRATED_HELP_KEYS, helpKeyFor, helpTemplateFor, puzzleGivens } = load('@/constants/help-examples');
const { puzzleQADraft } = load('@/utils/puzzle-qa-draft');
const { getPuzzleDraftAnswer } = load('@/utils/puzzle-attempt');
const { checkPuzzleAnswer } = load('@/utils/puzzle-type');

const catalog = ['easy', 'medium', 'hard'].flatMap(tier => readPuzzles('en', tier));
const expectedKeys = {
  bridge_positive: 'number_line', estimate: 'estimate', budget_plan: 'multi_step', multiply_subtract: 'multi_step',
  coordinate_map: 'coordinates', ratio_table: 'ratio', rate: 'ratio', order_numbers: 'order_sort', sort_buckets: 'order_sort', route_grid: 'route',
  geometry_area: 'area', geometry_missing_area: 'area', geometry_compare: 'perimeter',
  geometry_perimeter: 'perimeter', geometry_missing_perimeter: 'perimeter',
  base_ten_build: 'place_value', base_ten_add: 'place_value', base_ten_subtract: 'place_value',
  base_ten_bundle: 'place_value', base_ten_split: 'place_value',
  decimal_grid_10: 'decimals', decimal_grid_100: 'decimals', decimal_place_build: 'decimals',
  decimal_place_tenths: 'decimals', decimal_place_bundle: 'decimals', decimal_place_split: 'decimals',
  percent_discount: 'discount', percent_half_discount: 'discount', percent_tenth_discount: 'discount', percent_fifth_discount: 'discount',
  percent_of: 'percent', percent_half: 'percent', percent_tenth: 'percent', percent_fifth: 'percent',
  fraction_build: 'fraction_parts', fraction_match: 'fraction_parts', fraction_strip_build: 'fraction_parts', easy_fraction_half: 'fraction_parts',
  fraction_sort: 'fraction_sort', fraction_equivalent: 'fraction_equivalent', fraction_decimal_link: 'fraction_equivalent',
  fraction_compare_half: 'fraction_compare', fraction_compare_same_numerator: 'fraction_compare', fraction_compare_common: 'fraction_compare',
  fraction_compare_unit: 'fraction_compare', easy_fraction_compare: 'fraction_compare',
  fraction_of_set: 'fraction_of_set', fraction_unit_set: 'fraction_of_set', fraction_number_line: 'fraction_line', pattern_next: 'pattern', repair_pattern: 'pattern', compare: 'compare', number_range: 'compare',
  number_line: 'number_line', signed_line: 'number_line', target_build: 'target', pair_sum: 'target', all_pairs: 'target' };
const kinds = new Map(MIGRATED_HELP_KEYS.map(key => [key, []]));
for (const puzzle of catalog) {
  const key = helpKeyFor(puzzle);
  const model = puzzle.everyday?.model;
  if (model?.kind === 'shapes') assert.equal(key, model.task === 'symmetry' ? 'symmetry' : 'shapes', puzzle.id);
  if (model?.kind === 'solid') assert.equal(key, 'volume', puzzle.id);
  if (model?.kind === 'clock') assert.equal(key, 'clock', puzzle.id);
  if (model?.kind === 'money') assert.equal(key, ({ unit: 'unit_price', discount: 'discount' })[model.task] ?? 'money', puzzle.id);
  if (model?.kind === 'bars') assert.equal(key, ({ total: 'bars_total', missing: 'bars_missing', mean: 'bars_mean' })[model.task] ?? 'bars', puzzle.id);
  if (model?.kind === 'capacity') assert.equal(key, ['total', 'read', 'space', 'litres'].includes(model.task) ? 'capacity' : 'measure_share', puzzle.id);
  if (model?.kind === 'grid') assert.equal(key, ({ translate: 'grid_moves', rotate: 'grid_turn', reflect: 'grid_flip' })[model.task], puzzle.id);
  if (puzzle.type === 'coordinate_map') assert.equal(key, 'coordinates', puzzle.id);
  const expected = expectedKeys[helpTemplateFor(puzzle)];
  if (expected && !model) assert.equal(key, expected, puzzle.id);
  assert.ok(typeof key === 'string' && key, `${puzzle.id}: maps to a help key`);
  kinds.get(key).push(puzzle);
}

// A migrated key has locale copy and an example whose correct proof the pipeline can build.
const help = Object.fromEntries(['en', 'lv', 'ru'].map(code => [code, load(`@/locales/visual-help/${code}`)[{ en: 'visualHelpEn', lv: 'visualHelpLv', ru: 'visualHelpRu' }[code]]]));
const correctAnswer = example => {
  const fixture = puzzleQADraft(example, 'correct');
  return fixture && fixture.correct && checkPuzzleAnswer(example, getPuzzleDraftAnswer(example, fixture.draft)) ? fixture : null;
};
const sameNumbers = (a, b) => a.length === b.length && a.every((n, i) => n === b[i]);
for (const key of MIGRATED_HELP_KEYS) {
  const example = HELP_EXAMPLES[key];
  assert.ok(example && example.id.startsWith('help-example-'), `${key}: has an example puzzle`);
  assert.ok(correctAnswer(example), `${key}: puzzleQADraft builds a correct draft`);
  assert.equal(helpKeyFor(example), key, `${key}: the example maps to its own key`);
  assert.ok(!example.response && (!example.everyday || example.everyday.model.kind === ({ measure_share: 'capacity', bars_total: 'bars', bars_mean: 'bars', bars_missing: 'bars', multi_step: 'money', unit_price: 'money', discount: 'money', grid_moves: 'grid', grid_turn: 'grid', grid_flip: 'grid', symmetry: 'shapes', volume: 'solid' }[key] ?? key)), `${key}: the example is a plain proof, no input response`);
  for (const [code, strings] of Object.entries(help)) {
    for (const field of ['title', 'question', 'rule']) assert.ok(strings.examples?.[key]?.[field]?.trim(), `${key}: ${code} ${field}`);
  }
  assert.ok(kinds.get(key).length > 0, `${key}: covers catalog puzzles`);
  const givens = puzzleGivens(example);
  const shared = kinds.get(key).filter(puzzle => sameNumbers(puzzleGivens(puzzle), givens));
  assert.deepEqual(shared.map(p => p.id), [], `${key}: no catalog puzzle uses the example's numbers ${givens.join(', ')}`);
}
{
  const { coordinates, ratio, order_sort: order, route } = HELP_EXAMPLES;
  const { bridgeTarget } = load('@/utils/bridge-models');
  const point = bridgeTarget(coordinates);
  assert.equal(point.x, 3);
  assert.equal(point.y, 2);
  assert.equal(bridgeTarget(ratio), ratio.payload.targetA * ratio.payload.b / ratio.payload.a);
  assert.equal([...order.payload.numbers].sort((a, b) => a - b).join(','), order.payload.correctOrder.join(','));
  const { routeValue } = load('@/utils/operations-reveal');
  const path = correctAnswer(route).draft.challenge.cells;
  assert.equal(routeValue(route.payload, path).values.join(','), '4,7,14');
}
{
  const sorts = kinds.get('fraction_sort');
  assert.equal(sorts.length, 20);
  const example = HELP_EXAMPLES.fraction_sort.payload;
  for (const puzzle of sorts) {
    const catalogFractions = [...puzzle.payload.targets, ...puzzle.payload.fractions];
    assert.ok(example.targets.every(([n, d]) => catalogFractions.every(([a, b]) => n * b !== a * d)),
      'fraction_sort: neither worked match gives away a catalog answer');
  }
}
{
  const { place_value: bundle, decimals, percent } = HELP_EXAMPLES;
  const { initialPlaceValue, changePlaceValue } = load('@/utils/place-value');
  const before = initialPlaceValue(bundle);
  const after = changePlaceValue(bundle, before, 'bundle');
  assert.equal(after.ones, before.ones - 10);
  assert.equal(after.tens, before.tens + 1);
  assert.equal(after.tens * 10 + after.ones, bundle.payload.start);
  assert.equal(decimals.payload.scale, 100);
  const { percentageShareParts } = load('@/utils/percentage-reveal');
  const { whole, percent: rate } = percent.percentageExample;
  assert.equal(whole / percentageShareParts(rate), Number(percent.choices[percent.correctIndex]));
}
for (const puzzle of catalog.filter(p => p.helpTemplate?.startsWith('percent_') && p.helpTemplate.endsWith('_discount'))) {
  assert.equal(helpKeyFor(puzzle), 'discount', puzzle.id);
}
{
  const { geometryMeasurement } = load('@/utils/geometry-models');
  assert.equal(geometryMeasurement(HELP_EXAMPLES.area).total, 8);
  assert.equal(geometryMeasurement(HELP_EXAMPLES.perimeter).equation, '5 + 3 + 5 + 3 = 16');
  const { shapes } = HELP_EXAMPLES;
  const model = shapes.everyday.model;
  const { edges } = load('@/utils/puzzle-shapes').shapeGeometry(model.sides[0], model.rectangle);
  assert.equal(String(edges.length), shapes.choices[shapes.correctIndex]);
}
for (const [key, count] of Object.entries({ bars_missing: 40, bars_mean: 20, multi_step: 11, estimate: 6 })) {
  assert.equal(kinds.get(key).length, count);
  assert.ok(help.en.examples[key].question.length <= 34);
}
for (const key of ['bars_missing', 'bars_mean']) {
  const example = HELP_EXAMPLES[key];
  assert.equal(load('@/utils/puzzle-bars').barAnswer(example.everyday.model).answer, example.choices[example.correctIndex]);
}
{
  const { estimate, multi_step: purchase } = HELP_EXAMPLES;
  const total = estimate.payload.expression.split('+').reduce((sum, operand) => sum + Number(operand), 0);
  assert.equal(Math.round(total / 10) * 10, Number(estimate.payload.choices[estimate.correctIndex]));
  const tape = load('@/utils/money-tape').planMoneyTape(purchase.everyday.model, undefined, 'en');
  assert.equal(tape.segments.at(-1).label, purchase.choices[purchase.correctIndex]);
}
const bars = HELP_EXAMPLES.bars;
const { barAnswer } = load('@/utils/puzzle-bars');
assert.equal(barAnswer(bars.everyday.model).answer, bars.choices[bars.correctIndex]);
assert.ok(kinds.get('bars').every(({ everyday: { model } }) =>
  !bars.everyday.model.values.every(value => model.values.includes(value))), 'bars: chart uses a fresh pair of heights');
{
  const { measure_share, bars_total, unit_price, discount } = HELP_EXAMPLES;
  const { jugMeasure } = load('@/utils/puzzle-capacity');
  const { planMoneyTape, saleTiles } = load('@/utils/money-tape');
  const { moneyPurchase, formatPriceTicket } = load('@/utils/puzzle-money');
  const answer = puzzle => puzzle.choices[puzzle.correctIndex];
  const jug = jugMeasure(measure_share.everyday.model);
  assert.equal(jug.remainder, 0);
  assert.equal(String(jug.portions), answer(measure_share));
  assert.equal(String(bars_total.everyday.model.values.reduce((sum, value) => sum + value, 0)), answer(bars_total));
  const pack = unit_price.everyday.model;
  const tape = planMoneyTape(pack, undefined, 'en');
  assert.equal(tape.segments.length, pack.quantities[0]);
  assert.equal(tape.segments.reduce((sum, part) => sum + part.value, 0), pack.prices[0]);
  assert.ok(tape.segments.every(part => part.label === answer(unit_price)));
  const sale = discount.everyday.model;
  const { tiles, cut } = saleTiles(sale.discount);
  const { subtotal, price } = moneyPurchase(sale);
  assert.equal(subtotal * (tiles - cut) / tiles, price);
  assert.equal(formatPriceTicket(price, sale.unit, 'en'), answer(discount));
}
const capacity = HELP_EXAMPLES.capacity;
const jug = load('@/utils/puzzle-capacity').jugMeasure(capacity.everyday.model);
assert.equal(jug.end, Number(capacity.choices[capacity.correctIndex]));
assert.equal(jug.end, jug.capacity, 'capacity: both pours reach the litre mark');
assert.equal(jug.capacity, 1000);
for (const key of ['grid_turn', 'grid_flip']) {
  const example = HELP_EXAMPLES[key];
  const stops = load('@/utils/puzzle-grid').gridStops(example.everyday.model);
  assert.equal(String(stops.at(-1).square), example.choices[example.correctIndex]);
  assert.notEqual(stops[0].square, stops.at(-1).square);
}
const folded = HELP_EXAMPLES.symmetry.everyday.model;
const { edges: foldEdges } = load('@/utils/puzzle-shapes').shapeGeometry(folded.sides[0], folded.rectangle);
assert.ok(foldEdges.every(({ from }) => foldEdges.some(({ to }) =>
  Math.abs(to.x - (140 - from.x)) < 1e-6 && Math.abs(to.y - from.y) < 1e-6)), 'symmetry: each corner has a matching corner across the fold');
for (const key of ['grid_turn', 'grid_flip', 'symmetry', 'volume']) {
  for (const [locale, strings] of Object.entries(help)) assert.ok(strings.examples[key].equation, `${key}: ${locale} equation`);
}
for (const [locale, strings] of Object.entries(help)) {
  // The fold ends on "the halves match", not on a fraction sum; the box names one layer, then two.
  assert.ok(!/[½=+]/.test(strings.examples.symmetry.equation), `symmetry: ${locale} ends on words, not an equation`);
  for (const field of ['layerOne', 'layerMany']) assert.ok(strings.examples.volume[field]?.includes('{{total}}'), `volume: ${locale} ${field}`);
}
const box = HELP_EXAMPLES.volume.everyday.model;
assert.equal(box.width * box.depth, 6);
assert.equal(box.width * box.depth * box.height, Number(HELP_EXAMPLES.volume.choices[HELP_EXAMPLES.volume.correctIndex]));
const grid = HELP_EXAMPLES.grid_moves;
const { gridStops } = load('@/utils/puzzle-grid');
assert.equal(gridStops(grid.everyday.model).at(-1).square, Number(grid.choices[grid.correctIndex]));
{
  const { clockTime, clockTravel } = load('@/utils/puzzle-clock');
  const { clock, money } = HELP_EXAMPLES;
  const dial = clock.everyday.model;
  assert.equal(clockTime(dial.minutes + clockTravel(dial)).replace(/^0/, ''), clock.choices[clock.correctIndex]);
  const { planMoneyTape } = load('@/utils/money-tape');
  const tape = planMoneyTape(money.everyday.model, undefined, 'en');
  assert.equal(tape.segments.length, 2);
  assert.equal(tape.segments.reduce((sum, segment) => sum + segment.value, 0) + ' c', money.choices[money.correctIndex]);
}
const { fractionRevealPlan } = load('@/utils/fraction-reveal');
{
  const [given, split] = fractionRevealPlan(HELP_EXAMPLES.fraction_equivalent).diagrams;
  assert.equal(split.denominator, given.denominator * 2, 'each piece splits in two');
  assert.equal(split.numerator, given.numerator * 2, 'the shaded amount is conserved');
  const [a, b] = fractionRevealPlan(HELP_EXAMPLES.fraction_compare).diagrams;
  assert.ok(a.numerator === 1 && b.numerator === 1 && a.denominator < b.denominator, 'the first strip shows a longer unit fraction');
  const { numerator, denominator } = HELP_EXAMPLES.fraction_parts.payload;
  assert.ok(kinds.get('fraction_parts').every(p => !p.payload?.pairs?.some(part =>
    part.numerator === numerator && part.denominator === denominator)), 'the shaded example is absent from catalog matching cards');
}
// Seven-year-olds see short questions: one line of copy at the 20 pt question size.
for (const key of MIGRATED_HELP_KEYS) assert.ok(help.en.examples[key].question.length <= 34, `${key}: the example question fits one line`);
// machine: one offered rule turns the input into the output; route grids are a different model and keep their own help.
{
  const { input, output, choices } = HELP_EXAMPLES.machine.payload;
  const fits = choices.filter(rule => Function(`return ${input}${rule.replace('×', '*').replace('÷', '/').replace('−', '-')}`)() === output);
  assert.equal(fits.length, 1, 'machine: exactly one offered rule fits the example');
  assert.ok(catalog.filter(p => p.type === 'route_grid').every(p => helpKeyFor(p) === 'route'), 'machine: route_grid keeps its own help');
}
// balance: the example is a scale where the same amount comes off both sides and x is a whole number.
{
  const { a, b, c } = HELP_EXAMPLES.balance.payload;
  assert.ok(b > 0 && Number.isInteger((c - b) / a), 'balance: the example needs a take-away from both sides and a whole x');
}
// check_work: a false addition claim, whose true sum the proof joins and compares; every true_false / fix_mistake puzzle without a more specific template routes here.
{
  const { statement } = HELP_EXAMPLES.check_work.payload;
  const claim = /^(\d+) \+ (\d+) = (\d+)$/.exec(statement);
  assert.ok(claim, 'check_work: the example claim is "a + b = c"');
  assert.equal(HELP_EXAMPLES.check_work.isTrue, false);
  assert.notEqual(Number(claim[1]) + Number(claim[2]), Number(claim[3]), 'check_work: the claim is wrong, so the sum differs from it');
  assert.ok(catalog.filter(p => p.type === 'true_false' || p.type === 'fix_mistake').every(p => ['check_work', ...MIGRATED_HELP_KEYS].includes(helpKeyFor(p))), 'check_work: judged claims and repairs never fall back to the old engine');
  for (const [code, strings] of Object.entries(help)) {
    for (const field of ['join', 'makes', 'compare', 'differ', 'result']) assert.ok(strings.examples.check_work[field]?.trim(), `check_work: ${code} ${field}`);
  }
}
// decimals: one tenth (a column of ten) plus single hundredths; percent: whole, split, keep one. Each narrated beat has copy in every language.
{
  const { hundredths } = HELP_EXAMPLES.decimals.payload;
  assert.ok(hundredths > 10 && hundredths % 10 > 0, 'decimals: the example shows a tenth and then single hundredths');
  for (const [code, strings] of Object.entries(help)) {
    for (const field of ['tenth', 'more']) assert.ok(strings.examples.decimals[field]?.trim(), `decimals: ${code} ${field}`);
    for (const field of ['whole', 'split', 'take']) assert.ok(strings.examples.percent[field]?.trim(), `percent: ${code} ${field}`);
  }
}
console.log(`Help examples: ${MIGRATED_HELP_KEYS.map(key => `${key} ${kinds.get(key).length}`).join(', ')}; ${catalog.length} puzzles map to a key.`);
