import { BRIDGE_PLANS } from './bridge-pilot.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

/** Check actual questions across all ten positions, including challenges and reviews. */
export function checkFoundations({ load }) {
  const catalog = read('data/puzzle-curriculum.json'), extras = read('data/puzzle-path-extras.json');
  const { getLearningReview } = load('@/constants/learning-review');
  const { checkPuzzleAnswer } = load('@/utils/puzzle-type');
  const { shufflePuzzleChoices } = load('@/utils/puzzle-practice');
  const lessons = catalog.lessons.filter(l => l.difficulty !== 'hard');
  assert.equal(lessons.length, 120);
  for (const locale of ['en', 'lv', 'ru']) {
    const all = ['easy', 'medium'].flatMap(d => read(`assets/puzzles/${locale === 'en' ? '' : `${locale}/`}${d}.json`));
    const byId = new Map(all.map(p => [p.id, p]));
    const path = lesson => [...['practice', 'boss', 'challenge'].flatMap(kind => lesson.levels.filter(l => l.kind === kind).flatMap(l => l.puzzleIds)), ...extras[lesson.id]].map(id => byId.get(id));
    for (const lesson of lessons) {
      if (BRIDGE_PLANS.some(p=>p.id===lesson.id)) continue; // Dedicated checks cover these replacement paths and their daily reviews.
      const stage = lessons.filter(l => l.difficulty === lesson.difficulty && l.topicId === lesson.topicId).indexOf(lesson);
      const tasks = path(lesson);
      assert.equal(tasks.length, 10);
      if (lesson.difficulty === 'easy' && lesson.topicId === 'numbers') {
        const max = stage === 0 ? 10 : 20;
        for (const p of tasks) {
          const values = p.type === 'order_numbers' ? p.payload.numbers : p.type === 'compare' ? [p.payload.optionA, p.payload.optionB]
            : p.type === 'number_line' ? [p.payload.start, p.payload.correctValue, p.payload.max]
              : p.type === 'sort_buckets' ? [...p.payload.numbers, p.payload.boundary] : p.choices;
          assert.ok(values.every(n => Number(n) >= 0 && Number(n) <= max), `${p.id}: no larger numbers appear in a boss, challenge or review before practice`);
          if (p.type === 'multiple_choice') {
            const [lower, upper] = p.question.match(/\d+/g).map(Number);
            for (let seed = 0; seed < 12; seed++) {
              const shuffled = shufflePuzzleChoices(p, `foundation/${seed}`);
              shuffled.choices.forEach((n, index) => assert.equal(checkPuzzleAnswer(shuffled, { kind: 'choice', index }), Number(n) > lower && Number(n) < upper, `${p.id}: every mathematically valid range answer is accepted`));
            }
          }
        }
      }
      if (lesson.difficulty === 'easy' && lesson.topicId === 'patterns' && stage < 2) {
        for (const p of tasks) {
          const sequence = p.type === 'pattern_next' ? p.payload.sequence : p.type === 'repair_pattern' ? p.payload.sequence.filter(n => n !== null) : null;
          if (sequence) assert.ok(sequence.every(n => n >= 0 && n <= 20), `${p.id}: early patterns stay within twenty`);
          if (p.type === 'function_machine') assert.ok(Math.abs(p.payload.output - p.payload.input) <= 2, 'Introduce small constant jumps before larger rules');
        }
      }
      if (lesson.difficulty === 'easy' && lesson.topicId === 'multiplication' && stage < 2) {
        assert.ok(tasks.slice(0, 7).every(p => p.type === 'multiple_choice' && p.taskVisual?.kind === 'array'), 'Teach visible equal groups before machine rules, claims or missing factors');
        assert.ok(tasks.filter(p => p.taskVisual).every(p => [2, 5].includes(p.taskVisual.columns)), 'Early groups use twos and fives');
      }
      if (lesson.difficulty === 'medium' && lesson.topicId === 'division') {
        assert.ok(tasks.every(p => p.type !== 'repair_pattern'), 'Division challenges test sharing instead of unexplained powers');
        for (const p of tasks.filter(p => p.type === 'fair_share')) {
          const { items, people, choices } = p.payload;
          assert.ok(people <= 5 && items <= 35, 'Sharing fits the physical plates and counter pool');
          if (stage === 0) assert.equal(items % people, 0, 'Every introductory sharing task divides exactly, including bosses and challenges');
          choices.forEach((choice, index) => {
            const [each, left = 0] = choice.match(/\d+/g).map(Number);
            assert.equal(each * people + left === items && left < people, index === p.correctIndex, `${p.id}: unique quotient and remainder`);
          });
        }
      }
      if (lesson.difficulty === 'medium' && lesson.topicId === 'operations' && stage < 3) {
        assert.ok(tasks.every(p => p.type !== 'route_grid'), 'Follow short routes before navigating a maze');
        for (const p of tasks) {
          const operators = p.type === 'operation_path' ? p.payload.steps.map(s => s.operator) : p.type === 'target_build' ? p.payload.solution : [];
          assert.ok(operators.every(op => op === '+' || op === '-'), `${p.id}: no untaught multiplication or division in early route solutions`);
        }
      }
      // Fresh daily checks must respect the same lesson's limits in every supported language.
      for (let day = 20500; day < 20522; day++) {
        const q = getLearningReview(lesson, day), numbers = q.prompt.en.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
        assert.ok(q.prompt[locale]?.trim());
        assert.equal(new Set(q.choices).size, 3);
        assert.ok(q.choices.filter(c => /^-?\d+$/.test(c)).every(c => Number(c) >= 0));
        if (lesson.topicId === 'multiplication') {
          assert.ok(numbers.every(n => n <= 12), `${lesson.id}: reviews stay within the taught multiplication tables`);
          if (lesson.difficulty === 'easy' && stage < 2) assert.ok(numbers.some(n => [2, 5].includes(n)));
        }
        if (lesson.topicId === 'division') assert.ok(numbers[1] <= 12 && Number(q.choices[q.correctIndex]) <= 10, 'Daily sharing uses known facts, not two-digit quotients');
        if (lesson.difficulty === 'easy' && lesson.topicId === 'numbers') assert.ok(q.choices.every(c => Number(c) <= (stage === 0 ? 10 : 20)), 'Daily number choices stay inside the lesson range');
        if (lesson.difficulty === 'medium' && lesson.topicId === 'fractions' && stage >= 6 && stage <= 8) {
          const scale = stage === 6 ? 10 : 100;
          assert.equal(Number(q.choices[q.correctIndex]), Math.round(numbers[0] * scale), 'Decimal reviews connect the value with tenths or hundredths');
        }
      }
    }
  }
  console.log('Verified all 120 Easy/Medium paths in three languages: bounded number tasks, unambiguous ranges, visible introductory groups, exact sharing before remainders, operation prerequisites and 22 daily-review variants per lesson.');
}
