import { solveAlignedReview } from './check-review-alignment.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readPuzzles } from './catalog.mjs';

const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const fraction = text => text.split('/').map(Number);
const equal = ([a, b], [c, d]) => a * d === c * b;

export function checkFractionTransition({ load }) {
  const lessons = read('data/puzzle-curriculum.json').lessons.filter(l => l.difficulty === 'medium' && l.topicId === 'fractions').slice(0, 6);
  const extras = read('data/puzzle-path-extras.json');
  const { getLearningReview } = load('@/constants/learning-review');
  const { getVisualExplanation } = load('@/constants/visual-explanations');
  const { shufflePuzzleChoices } = load('@/utils/puzzle-practice');
  const { checkPuzzleAnswer } = load('@/utils/puzzle-type');
  assert.equal(lessons.length, 6);
  for (const locale of ['en', 'lv', 'ru']) {
    const byId = new Map(readPuzzles(locale, 'medium').map(p => [p.id, p]));
    lessons.forEach((lesson, stage) => {
      const max = [8, 8, 12, 12, 18, 24][stage];
      const bounded = ([n, d]) => {
        assert.ok(Number.isInteger(n) && Number.isInteger(d) && d >= 2 && d <= max && n >= 0 && n <= d, `${lesson.id}: familiar proper fractions within this lesson's range`);
        if (stage < 2) assert.ok([2, 3, 4, 5, 6, 8].includes(d), 'Opening lessons reuse Easy denominators');
      };
      const tasks = [...lesson.levels.flatMap(l => l.puzzleIds), ...extras[lesson.id]].map(id => byId.get(id));
      assert.equal(tasks.length, 10);
      for (const p of tasks) {
        const v = p.payload;
        if ('denominator' in v) bounded([v.numerator, v.denominator]);
        if (p.type === 'fraction_match') v.pairs.forEach(f => bounded([f.numerator, f.denominator]));
        if (p.type === 'fraction_strip') {
          assert.ok(v.partitions.length >= 2);
          v.partitions.forEach(parts => bounded([v.numerator * parts / v.denominator, parts]));
        }
        if (p.type === 'fraction_number_line') bounded([v.numerator * v.divisions / v.denominator, v.divisions]);
        if (p.type === 'fraction_equivalent') {
          const source = [v.numerator, v.denominator];
          for (let seed = 0; seed < 12; seed++) {
            const shuffled = shufflePuzzleChoices(p, `transition/${seed}`), options = shuffled.payload.choices.map(fraction);
            options.forEach(bounded);
            assert.equal(new Set(options.map(f => f[1])).size, 1, 'Distractors do not introduce another equivalence method');
            assert.equal(options.filter(f => equal(f, source)).length, 1);
            options.forEach((f, index) => assert.equal(checkPuzzleAnswer(shuffled, { kind: 'choice', index }), equal(f, source)));
          }
          if (stage < 2) assert.ok([2, 0.5].includes(fraction(v.choices[p.correctIndex])[1] / v.denominator));
        }
        if (p.type === 'compare') {
          const options = [v.optionA, v.optionB].map(fraction), [a, b] = options;
          options.forEach(bounded);
          assert.equal(p.correctIndex, a[0] * b[1] > b[0] * a[1] ? 0 : 1);
          if (stage < 2) assert.equal(a[1], b[1], 'Retain equal denominators before comparing different-sized pieces');
          else if (stage < 4) {
            assert.equal(a[0], b[0]);
            if (stage === 2) assert.equal(a[0], 1, 'Compare single pieces before several pieces');
          } else assert.ok(options.some(f => equal(f, [1, 2])), 'Use half before general unlike-denominator comparison');
        }
        if (p.type === 'sort_buckets') {
          assert.equal(v.fractions.length, stage < 3 ? 4 : 6);
          [...v.targets, ...v.fractions].forEach(bounded);
          v.fractions.forEach(f => assert.equal(v.targets.filter(t => equal(f, t)).length, 1));
        }
        const help = getVisualExplanation(p);
        assert.equal(help.keyframes.length, 3);
        for (const [, n, d] of JSON.stringify(help).matchAll(/(\d+)\s*\/\s*(\d+)/g)) bounded([Number(n), Number(d)]);
        if (p.type === 'compare') assert.match(help.keyframes[2].scene.result, /[<>]/, 'Comparison help actually demonstrates an inequality');
      }
      for (let day = 20500; day < 20533; day++) {
        const q = getLearningReview(lesson, day), source = [q.diagram?.colored, q.diagram?.parts];
        assert.ok(q.prompt[locale]?.trim() && q.explanation[locale]?.trim());
        if (q.prompt.en.startsWith('From 0 to 1')) {
          const [, divisions, n, d] = q.prompt.en.match(/has (\d+) equal intervals.*reach (\d+)\/(\d+)/).map(Number);
          assert.ok(divisions <= 8 && n > 0 && n < d);
          assert.equal(Number(q.choices[q.correctIndex]), solveAlignedReview(q), 'Count intervals, not tick marks');
          assert.ok(q.choices.every(c => Number(c) >= 0 && Number(c) <= divisions));
          continue;
        }
        bounded(source);
        assert.ok(source[1] <= 12, 'Daily picture remains countable');
        const choices = q.choices.map(fraction);
        choices.forEach(bounded);
        assert.equal(new Set(q.choices).size, 3);
        assert.equal(new Set(choices.map(f => f[1])).size, 1);
        assert.equal(choices.filter(f => equal(f, source)).length, 1);
        assert.ok(equal(choices[q.correctIndex], source));
        if (stage < 2) assert.ok([2, 0.5].includes(choices[q.correctIndex][1] / source[1]));
      }
    });
  }
  console.log('Verified 60 Medium fraction transition tasks in three languages: gradual denominator limits, comparison prerequisites, reachable models, shuffled answers, help and 33 picture-supported daily reviews per lesson.');
}
