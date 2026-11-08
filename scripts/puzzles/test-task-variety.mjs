import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { readPuzzles } from './catalog.mjs';
import { auditTaskRepetition, readRepetitionAudit, taskFingerprint } from './task-repetition.mjs';

test('cosmetic differences cannot hide a repeated question', () => {
  const p = { id: 'one', type: 'fraction_equivalent', question: 'Which fraction shows the same amount?',
    payload: { numerator: 1, denominator: 2, choices: ['2/4', '1/4', '3/4'], guided: true }, correctIndex: 0 };
  assert.equal(taskFingerprint(p), taskFingerprint({ ...p, id: 'two', question: 'Choose an equal fraction.', correctIndex: 2,
    payload: { choices: ['0/4', '4/4', '2/4'], denominator: 2, numerator: 1, guided: false } }));
  assert.notEqual(taskFingerprint(p), taskFingerprint({ ...p, payload: { ...p.payload, numerator: 2, denominator: 3 } }));
  const comparison = { type: 'compare', question: 'Which is larger?', payload: { optionA: '1/4', optionB: '3/4' } };
  assert.equal(taskFingerprint(comparison), taskFingerprint({ ...comparison, payload: { optionA: '3/4', optionB: '1/4' } }));
  const claim = { type: 'true_false', question: 'Every multiple of four is even. Is that true?', payload: { statement: '4 × 3 = 12', hideStatement: true } };
  assert.equal(taskFingerprint(claim), taskFingerprint({ ...claim, payload: { statement: '4 × 5 = 20', hideStatement: true } }));
});

test('diagram questions ignore incidental fields and preserve the quantities being taught', () => {
  const p = { type: 'multiple_choice', question: 'How many toys altogether?', choices: ['8', '9', '10'],
    everyday: { model: { kind: 'bars', task: 'total', values: [1, 3, 5], step: 1, index: 0, label: 'First chart' } } };
  const q = structuredClone(p);
  q.everyday.model.index = 2; q.everyday.model.label = 'Another label';
  q.choices = ['9', '11', '12'];
  assert.equal(taskFingerprint(p), taskFingerprint(q));
  q.everyday.model.values[0] = 2;
  assert.notEqual(taskFingerprint(p), taskFingerprint(q));
});

test('the audit distinguishes same-level, neighboring-level and spaced practice', () => {
  const puzzles = [0, 1, 2, 3, 4].map(i => ({ id: `p${i}`, type: 'fraction_build', question: 'Color a half.', payload: { numerator: 1, denominator: 2 } }));
  puzzles[3].payload.numerator = 2;
  const lessons = [[0, 1], [2], [3], [4]].map((ids, i) => ({ id: `l${i}`, difficulty: 'easy', topicId: 'fractions', levels: [{ puzzleIds: ids.map(i => `p${i}`) }] }));
  const audit = auditTaskRepetition({ lessons, puzzles, pathExtras: Object.fromEntries(lessons.map(l => [l.id, []])) });
  assert.equal(audit.withinLevel.length, 1);
  assert.equal(audit.neighboringLevels.length, 1);
  assert.equal(audit.spacedReview.length, 1);
});

for (const locale of ['en', 'lv', 'ru']) test(`${locale}: every level and its immediate predecessor have distinct tasks`, () => {
  const audit = readRepetitionAudit(locale);
  assert.equal(audit.levels, 339);
  assert.equal(audit.puzzles, 3390);
  assert.deepEqual(audit.withinLevel, [], 'A level must not ask the same question twice');
  assert.deepEqual(audit.neighboringLevels, [], 'A new level must have fresh examples');
});

test('native diagram retry fixtures match the current authored questions and answers', () => {
  const fixture = fs.readFileSync('scripts/native/everyday/fixture.tsx', 'utf8');
  const ids = [...fixture.match(/const ids = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  const swift = fs.readFileSync('scripts/native/everyday/NativeDragTests.swift', 'utf8');
  const cases = JSON.parse(swift.match(/let cases: \[\[String\]\] = (.*)/)[1]);
  for (const [i, [question, correct, wrong, locale]] of cases.entries()) {
    const p = readPuzzles(locale, ids[i].split('-')[0]).find(p => p.id === `v2-${ids[i]}`);
    const prefix = { en: 'Answer ', lv: 'Atbilde ', ru: 'Ответ ' }[locale];
    assert.equal(question, p.question);
    assert.equal(correct, prefix + p.choices[p.correctIndex]);
    assert.ok(p.choices.some((choice, i) => i !== p.correctIndex && prefix + choice === wrong));
  }
});
