import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readPuzzles } from './catalog.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const fraction = s => s.split('/').map(Number);
const equal = ([a, b], [c, d]) => a * d === c * b;

export function checkHardFractionTransition({ load }) {
  const lessons = read('data/puzzle-curriculum.json').lessons, extras = read('data/puzzle-path-extras.json');
  const hard = lessons.filter(l => l.difficulty === 'hard' && l.topicId === 'fractions');
  const finale = lessons.find(l => l.id === 'medium-fractions-explore-10');
  const { getLearningReview } = load('@/constants/learning-review');
  const { getVisualExplanation } = load('@/constants/visual-explanations');
  const { getQuantityTaskTokens, getQuantityTaskHeight } = load('@/utils/quantity-task-scene');
  const { shufflePuzzleChoices } = load('@/utils/puzzle-practice');
  const { checkPuzzleAnswer } = load('@/utils/puzzle-type');
  for (const locale of ['en', 'lv', 'ru']) {
    const byId = new Map(['medium', 'hard'].flatMap(d => readPuzzles(locale, d)).map(p => [p.id, p]));
    const path = l => [...l.levels.flatMap(s => s.puzzleIds), ...extras[l.id]].map(id => byId.get(id));
    const bounded = ([n, d], max) => assert.ok(Number.isInteger(n) && n >= 0 && n <= d && Number.isInteger(d) && d >= 2 && d <= max);
    for (const [stage, lesson] of [finale, ...hard.slice(0, 4)].entries()) {
      const max = [24, 12, 16, 20, 24][stage], tasks = path(lesson);
      assert.equal(tasks.length, 10);
      for (const p of tasks) {
        const v = p.payload;
        if (v?.denominator) bounded([v.numerator, v.denominator], max);
        if (p.type === 'fraction_match') v.pairs.forEach(f => bounded([f.numerator, f.denominator], max));
        if (p.type === 'sort_buckets') {
          [...v.targets, ...v.fractions].forEach(f => bounded(f, max));
          v.fractions.forEach(f => assert.equal(v.targets.filter(t => equal(t, f)).length, 1));
        }
        if (p.type === 'compare') {
          const [a, b] = [v.optionA, v.optionB].map(fraction);
          [a, b].forEach(f => bounded(f, max));
          assert.equal(p.correctIndex, a[0] * b[1] > b[0] * a[1] ? 0 : 1);
          assert.match(getVisualExplanation(p).keyframes[2].scene.result, /[<>]/);
        }
        if (p.type === 'fraction_equivalent') {
          const source = [v.numerator, v.denominator];
          for (let seed = 0; seed < 12; seed++) {
            const shuffled = shufflePuzzleChoices(p, `hard-transition/${seed}`);
            const options = shuffled.payload.choices.map(fraction);
            options.forEach(f => bounded(f, max));
            assert.equal(options.filter(f => equal(source, f)).length, 1);
            options.forEach((f, index) => assert.equal(checkPuzzleAnswer(shuffled, { kind: 'choice', index }), equal(source, f)));
          }
        }
        if (p.type === 'multiple_choice' && stage > 0) {
          const [total, n, d] = p.question.match(/\d+/g).map(Number), answer = total / d * n;
          assert.equal(total % d, 0);
          assert.ok(total <= [20, 25, 32, 40][stage - 1]);
          if (stage === 1) { assert.equal(n, 1); assert.equal(p.helpTemplate, 'fraction_unit_set'); }
          else assert.ok(n > 1, 'Extend to several groups after unit fractions');
          for (let seed = 0; seed < 12; seed++) {
            const shuffled = shufflePuzzleChoices(p, `amount/${seed}`);
            assert.equal(shuffled.choices.filter(c => Number(c) === answer).length, 1);
            shuffled.choices.forEach((c, index) => assert.equal(checkPuzzleAnswer(shuffled, { kind: 'choice', index }), Number(c) === answer));
          }
          const supported = stage === 1 || stage === 2 && p.learning.role === 'practice';
          assert.equal(Boolean(p.taskVisual), supported, 'Group models fade after the first multi-part example');
          if (p.taskVisual) {
            const model = p.taskVisual;
            assert.equal(model.items, total); assert.equal(model.groups, d);
            for (let step = 0; step <= total / d; step++) {
              const tokens = getQuantityTaskTokens(model, step);
              assert.equal(tokens.filter(t => t.id.startsWith('counter-')).length, total, 'Dealing conserves the complete collection');
              assert.equal(new Set(tokens.map(t => t.id)).size, tokens.length);
              assert.ok(tokens.every(t => t.x >= 0 && t.x <= 300 && t.y >= 0 && t.y <= getQuantityTaskHeight(model)));
            }
          }
        }
      }
    }
    const decimalLink = byId.get('v2-medium-fractions-explore-10-1');
    const decimal = Number(decimalLink.question.match(/\d+[.,]\d+/)[0].replace(',', '.'));
    assert.equal(decimalLink.type, 'multiple_choice');
    decimalLink.choices.forEach((c, i) => {
      const [n, d] = fraction(c);
      assert.equal(n / d === decimal, i === decimalLink.correctIndex);
    });
    // Keep the mosaic story's blue part and remainder consistent with its artwork.
    assert.deepEqual(byId.get('v2-medium-fractions-fountain-1').payload, { numerator: 3, denominator: 8 });
    assert.deepEqual(byId.get('v2-medium-fractions-fountain-3').payload.pairs.map(f => [f.numerator, f.denominator]), [[3,8],[5,8]]);
    const reviewVariants = hard.map(() => new Set());
    for (let day = 20500; day < 20533; day++) {
      hard.forEach((lesson, stage) => {
        const q = getLearningReview(lesson, day), [total, n, d] = q.prompt[locale].match(/\d+/g).map(Number);
        reviewVariants[stage].add(q.prompt[locale]);
        assert.equal(total % d, 0);
        assert.ok(total <= (stage < 4 ? [20,25,32,40][stage] : 64));
        if (stage === 0) assert.equal(n, 1);
        const answer = total / d * n;
        assert.equal(new Set(q.choices).size, 3);
        assert.equal(q.choices.filter(c => Number(c) === answer).length, 1);
        assert.equal(Number(q.choices[q.correctIndex]), answer);
      });
      const q = getLearningReview(finale, day), source = fraction(q.prompt[locale].match(/\d+\/\d+/)[0]);
      bounded(source, 24);
      q.choices.map(fraction).forEach((f, i) => { bounded(f, 24); assert.equal(equal(source, f), i === q.correctIndex); });
    }
    assert.ok(reviewVariants.every(variants => variants.size >= 6), 'Daily questions vary quantities as well as answer order');
  }
  console.log('Verified the Medium finale and 40 opening Hard fraction tasks in three languages: exact answers, decimal connection, gradual quantity limits, animated equal groups, fading support and 33 daily-review variants across all Hard fraction lessons.');
}
