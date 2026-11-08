import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { readPuzzles } from './catalog.mjs';
import { activityMix } from './activity-mix.mjs';
import { solveEveryday } from './check-everyday-topics.mjs';

const cache = new Map();
function load(id) {
  if (cache.has(id)) return cache.get(id).exports;
  const file = id.replace('@/', '') + '.ts', module = { exports: {} }; cache.set(id, module);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, { module, exports: module.exports, require: load, Set, Map });
  return module.exports;
}
const { checkPuzzleResponse, responseComplete, editResponse } = load('@/utils/puzzle-response');
const { shufflePuzzleChoices } = load('@/utils/puzzle-practice');
const { getPuzzleDraftAnswer } = load('@/utils/puzzle-attempt');
const { checkPuzzleAnswer } = load('@/utils/puzzle-type');
const catalog = JSON.parse(fs.readFileSync('data/puzzle-curriculum.json'));
const extras = JSON.parse(fs.readFileSync('data/puzzle-path-extras.json'));
const normalize = s => String(s).replaceAll(',', '.');
const english = new Map(['easy', 'medium', 'hard'].flatMap(d => readPuzzles('en', d)).map(p => [p.id, p]));

test('every ten-task level mixes at least three activities with no long runs', () => {
  const all = ['easy', 'medium', 'hard'].flatMap(d => readPuzzles('en', d)), byId = new Map(all.map(p => [p.id, p]));
  for (const l of catalog.lessons) {
    const tasks = [...l.levels.filter(v => v.kind === 'practice').flatMap(v => v.puzzleIds), ...l.levels.filter(v => v.kind === 'challenge').flatMap(v => v.puzzleIds), ...extras[l.id]].map(id => byId.get(id));
    const mix = activityMix(tasks);
    assert.equal(tasks.length, 10);
    assert.ok(mix.types >= 3 && mix.largest <= 5 && mix.run <= 2, `${l.id}: ${JSON.stringify(mix)}`);
  }
});

/** Resolve the alternative question from the original model, rather than its new key. */
function expected(p) {
  const v = p.payload;
  if (p.type === 'multiple_choice') {
    if (p.everyday) {
      const m = p.everyday.model;
      return m.kind === 'bars' && ['most', 'least'].includes(m.task) ? String(m.task === 'most' ? Math.max(...m.values) : Math.min(...m.values)) : normalize(solveEveryday(m, english.get(p.id).question));
    }
    return normalize(p.choices[p.correctIndex]);
  }
  if (p.type === 'place_value' || p.type === 'decimal_place_value') return null; // Every offered composition is checked by the live model below.
  if (p.type === 'signed_line') return String(v.start + (v.mode === 'move' ? v.delta : v.start === v.max ? -1 : 1));
  if (p.type === 'coordinate_map') {
    const target = v.mode === 'plot' ? { x: v.end.x + (v.end.x === v.max ? -1 : 1), y: v.end.y } : load('@/utils/bridge-models').bridgeTarget(p);
    return typeof target === 'number' ? String(target) : `(${target.x}; ${target.y})`;
  }
  if (['ratio_table', 'equation_board'].includes(p.type)) return String(load('@/utils/bridge-models').bridgeTarget(p));
  if (p.type === 'geometry_measure') { const n = load('@/utils/geometry-models').geometryTarget(p); return v.mode === 'compare' ? ['A', 'B', 'A = B'][n] : String(n); }
  if (p.type === 'number_line') return String(v.start + v.jump);
  if (p.type === 'pair_sum') return String(v.target - v.numbers[v.correctIndices[0]]);
  if (p.type === 'fraction_build') return String(v.numerator);
  if (p.type === 'true_false') { const [a, b] = v.statement.split('=')[0].match(/\d+/g).map(Number); return String(a - b); }
  const answer = v.choices[p.correctIndex];
  return p.type === 'fix_mistake' && p.response.kind === 'write' ? answer.split('=').at(-1).trim() : normalize(answer);
}
function validComposition(p, value) {
  const numbers = value.match(/-?\d+(?:[.,]\d+)?/g).map(s => Number(s.replace(',', '.')));
  return p.type === 'place_value'
    ? load('@/utils/place-value').checkPlaceValue(p, { tens: numbers[0], ones: numbers[2], added: true })
    : load('@/utils/decimal-models').checkDecimalPlace(p, { ones: numbers[0], tenths: numbers[2], hundredths: numbers[4] });
}
for (const locale of ['en', 'lv', 'ru']) test(`${locale}: every alternate answer is independently reachable and correctly graded`, () => {
  for (const p of ['easy', 'medium', 'hard'].flatMap(d => readPuzzles(locale, d)).filter(p => p.response)) {
    const r = p.response, solution = expected(p);
    const correct = s => solution === null ? validComposition(p, s) : normalize(s) === solution;
    assert.equal(getPuzzleDraftAnswer(p, { response: null }), null, `${p.id}: empty is never ready`);
    if (r.kind === 'write') {
      assert.ok(correct(r.answer), `${p.id}: written answer follows the original givens`);
      assert.equal(responseComplete(p, r.answer), true);
      const draft = getPuzzleDraftAnswer(p, { response: r.answer });
      assert.equal(checkPuzzleAnswer(p, draft), true);
      assert.equal(checkPuzzleResponse(p, r.format === 'clock' ? r.answer === '23:59' ? '00:00' : '23:59' : r.format === 'fraction' ? '999/1' : '999999'), false);
    } else if (r.kind === 'judge') {
      assert.equal(r.isCorrect, correct(r.proposed), `${p.id}: proposed answer has the stated truth value`);
      for (const b of [true, false]) assert.equal(checkPuzzleResponse(p, b), b === correct(r.proposed));
    } else {
      assert.equal(r.options.length, 3); assert.equal(new Set(r.options).size, 3);
      const positions = new Set(), before = JSON.stringify(p);
      for (let seed = 0; seed < 8; seed++) {
        const q = shufflePuzzleChoices(p, `${p.id}/mix/${seed}`);
        positions.add(q.response.correctIndex);
        q.response.options.forEach((s, i) => assert.equal(checkPuzzleResponse(q, String(i)), correct(s), p.id));
      }
      assert.ok(positions.size > 1, `${p.id}: choice position varies between attempts`);
      assert.equal(JSON.stringify(p), before, 'Choice shuffling does not change the shared definition');
    }
  }
});

test('proposed answers balance both verdicts without an alternating answer shortcut', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const values = readPuzzles('en', difficulty).filter(p => p.response?.kind === 'judge').map(p => p.response.isCorrect);
    assert.ok(Math.abs(values.filter(Boolean).length - values.filter(v => !v).length) <= 1);
    assert.ok(values.some((v, i) => i && v === values[i - 1]), 'Success requires checking the mathematics');
  }
});

test('keypad editing and readiness handle zero, decimal commas, times and fractions', () => {
  const number = { response: { kind: 'write', format: 'number', answer: '1.5' } };
  assert.equal(checkPuzzleResponse(number, '1,50'), true);
  assert.equal(responseComplete(number, ''), false); assert.equal(responseComplete(number, '-'), false); assert.equal(responseComplete(number, '1,'), false);
  assert.equal(checkPuzzleResponse({ response: { ...number.response, answer: '0' } }, '0'), true);
  const clock = { response: { kind: 'write', format: 'clock', answer: '02:30' } };
  assert.equal(checkPuzzleResponse(clock, '2:30'), true);
  for (const value of ['2:', '2:3', '24:00', '12:65']) assert.equal(responseComplete(clock, value), false);
  const fraction = { response: { kind: 'write', format: 'fraction', answer: '2/4', denominator: 4 } };
  assert.equal(checkPuzzleResponse(fraction, '1/2'), false); assert.equal(checkPuzzleResponse(fraction, '2/4'), true);
  assert.equal(responseComplete(fraction, '1/0'), false);
  let typed = ''; for (const key of ['0', '2', ':', '3', '0']) typed = editResponse(typed, key, 'clock');
  assert.equal(typed, '02:30'); assert.equal(editResponse(typed, '4', 'clock'), typed);
  assert.equal(editResponse(typed, 'erase', 'clock'), '02:3'); assert.equal(editResponse(typed, 'clear', 'clock'), '');
  assert.equal(editResponse('1.2', '.', 'number'), '1.2'); assert.equal(editResponse('5', 'sign', 'number'), '-5');
});
