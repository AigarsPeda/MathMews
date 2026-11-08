import { solveAlignedReview } from './check-review-alignment.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readPuzzles } from './catalog.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const fraction = text => text.split('/').map(Number);
const equal = ([a, b], [c, d]) => a * d === c * b;
const familiar = ([n, d], context) => {
  assert.ok(Number.isInteger(n) && Number.isInteger(d) && n >= 0 && n <= d, `${context}: stay within one whole`);
  assert.ok([2, 3, 4, 5, 6, 8].includes(d), `${context}: use familiar pieces with at most eight parts`);
};

/** Check opening variety and the later paths, including distractors, help and daily checks. */
export function checkEasyFractions({ load }) {
  const track = read('data/puzzle-curriculum.json').lessons
    .filter(l => l.difficulty === 'easy' && l.topicId === 'fractions');
  const lessons = track.slice(4);
  const extras = read('data/puzzle-path-extras.json');
  const { getLearningReview } = load('@/constants/learning-review');
  const { getVisualExplanation } = load('@/constants/visual-explanations');
  const { checkPuzzleAnswer } = load('@/utils/puzzle-type');
  const { shufflePuzzleChoices } = load('@/utils/puzzle-practice');
  const { PUZZLE_PATHS } = load('@/constants/puzzle-path');
  const intro = PUZZLE_PATHS.find(l => l.id === track[0].id);
  assert.equal(lessons.length, 6);

  for (const locale of ['en', 'lv', 'ru']) {
    const byId = new Map(readPuzzles(locale, 'easy').map(p => [p.id, p]));
    const opening = intro.levels.flatMap(l => l.puzzleIds).map(id => byId.get(id));
    assert.equal(opening.length, 10, 'Keep the complete first-level session');
    assert.ok(new Set(opening.map(p => p.type)).size >= 6, 'Practise halves through different activities');
    assert.equal(new Set(opening.map(p => JSON.stringify([p.type, p.question, p.payload, p.choices]))).size, 10,
      'Every first-level task asks a different question');
    assert.ok(opening.every((p, i) => !i || p.type !== opening[i - 1].type), 'Do not repeat an interaction back to back');
    assert.equal(opening.filter(p => p.type === 'fraction_build').length, 2, 'Color a half once, then build a whole');
    for (const p of opening) {
      const v = p.payload;
      if (p.type === 'fraction_build') assert.equal(v.denominator, 2);
      if (p.type === 'fraction_match') assert.ok(v.pairs.every(pair => pair.denominator === 2));
      if (p.type === 'sort_buckets') assert.ok([...v.targets, ...v.fractions].every(([, d]) => d === 2));
      assert.equal(getVisualExplanation(p).keyframes.length, 3, `${p.id}: picture help remains available`);
      for (let seed = 0; seed < 12; seed++) {
        const shuffled = shufflePuzzleChoices(p, `intro-halves/${seed}`);
        if (p.type === 'multiple_choice' || p.type === 'compare' || p.type === 'true_false') {
          const options = shuffled.choices ?? (p.type === 'compare' ? [shuffled.payload.optionA, shuffled.payload.optionB] : [true, false]);
          options.forEach((option, index) => {
            const expected = p.type === 'compare' ? option === '2/2' : p.type === 'true_false' ? option === p.isTrue
              : option === (p.id.endsWith('boss-2') ? '2' : '1/2');
            assert.equal(checkPuzzleAnswer(shuffled, { kind: 'choice', index }), expected, `${p.id}: accept only the correct answer after shuffling`);
          });
        }
      }
    }
    for (const lesson of lessons) {
      const tasks = [...lesson.levels.flatMap(l => l.puzzleIds), ...extras[lesson.id]].map(id => byId.get(id));
      assert.equal(tasks.length, 10);
      for (const p of tasks) {
        const v = p.payload;
        if ('denominator' in v) familiar([v.numerator, v.denominator], p.id);
        if (p.type === 'fraction_match') v.pairs.forEach(pair => familiar([pair.numerator, pair.denominator], p.id));
        if (p.type === 'compare') {
          const [a, b] = [v.optionA, v.optionB].map(fraction);
          [a, b].forEach(f => familiar(f, p.id));
          assert.equal(a[1], b[1], `${p.id}: compare equal-sized pieces`);
          assert.notEqual(a[0], b[0]);
          assert.equal(p.correctIndex, a[0] > b[0] ? 0 : 1);
        }
        if (p.type === 'fraction_equivalent') {
          const source = [v.numerator, v.denominator], answer = fraction(v.choices[p.correctIndex]);
          assert.ok([2, 0.5].includes(answer[1] / source[1]), `${p.id}: split or join pairs only`);
          for (let seed = 0; seed < 12; seed++) {
            const shuffled = shufflePuzzleChoices(p, `easy-fractions/${seed}`);
            const options = shuffled.payload.choices.map(fraction);
            assert.equal(options.filter(f => equal(source, f)).length, 1);
            options.forEach((f, index) => {
              familiar(f, p.id);
              assert.equal(f[1], answer[1], 'Choices use the same-sized pieces');
              assert.equal(checkPuzzleAnswer(shuffled, { kind: 'choice', index }), equal(source, f));
            });
          }
        }
        if (p.type === 'fraction_strip') {
          for (const parts of v.partitions) {
            familiar([v.numerator * parts / v.denominator, parts], p.id);
          }
          if (v.mode === 'equivalent') assert.ok(v.partitions.length > 1, 'Repartitioning offers selectable partition buttons');
        }
        if (p.type === 'fraction_number_line') assert.equal(v.divisions, v.denominator, 'Count directly in the named parts');
        if (p.type === 'sort_buckets') {
          assert.equal(v.fractions.length, 4, 'Limit the sorting challenge to four cards');
          assert.equal(v.targets.length, 2);
          [...v.targets, ...v.fractions].forEach(f => familiar(f, p.id));
          v.fractions.forEach(f => assert.equal(v.targets.filter(t => equal(t, f)).length, 1));
        }
        // Include worked examples: a simple question must not open help about ninths.
        const help = getVisualExplanation(p);
        assert.equal(help.keyframes.length, 3);
        for (const [, n, d] of JSON.stringify(help).matchAll(/(\d+)\s*\/\s*(\d+)/g)) familiar([Number(n), Number(d)], `${p.id} help`);
      }
      for (let day = 20500; day < 20533; day++) {
        const q = getLearningReview(lesson, day);
        assert.ok(q.prompt[locale]?.trim() && q.explanation[locale]?.trim());
        if (q.prompt.en.startsWith('Equal-sized strips')) {
          const [d, a, b] = q.prompt.en.match(/\d+/g).map(Number);
          familiar([a, d], lesson.id); familiar([b, d], lesson.id);
          assert.equal(q.diagram.parts, d); assert.equal(q.diagram.colored, a);
          assert.equal(q.choices[q.correctIndex], solveAlignedReview(q));
          assert.deepEqual([...q.choices].sort(), ['A', 'A = B', 'B']);
          continue;
        }
        if (q.prompt.en.startsWith('From 0 to 1')) {
          const [, divisions, n, d] = q.prompt.en.match(/has (\d+) equal intervals.*reach (\d+)\/(\d+)/).map(Number);
          assert.ok(divisions <= 8 && n > 0 && n < d);
          assert.equal(Number(q.choices[q.correctIndex]), solveAlignedReview(q), 'Count intervals, not tick marks');
          assert.ok(q.choices.every(c => Number(c) >= 0 && Number(c) <= divisions));
          continue;
        }
        assert.ok(q.diagram, 'Later Easy daily checks retain a visible fraction model');
        const source = [q.diagram.colored, q.diagram.parts], options = q.choices.map(fraction);
        familiar(source, lesson.id);
        options.forEach(f => familiar(f, lesson.id));
        assert.equal(new Set(q.choices).size, 3);
        assert.equal(new Set(options.map(f => f[1])).size, 1);
        assert.equal(options.filter(f => equal(source, f)).length, 1);
        assert.ok(equal(source, options[q.correctIndex]));
        assert.ok([0.5, 1, 2].includes(options[q.correctIndex][1] / source[1]));
      }
    }
  }
  console.log('Verified ten distinct opening fraction tasks with six activity types, plus all 60 later Easy fraction tasks in three languages: familiar parts, equal-denominator comparisons, simple equivalence, reachable strips, four-card sorting, help and 33 daily-review variants per lesson.');
}
