import { readPuzzles } from './catalog.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const fraction = value => value.split('/').map(Number);
const equalFraction = (a, b) => a[0] * b[1] === b[0] * a[1];

/** Regression checks for the November audit, including the pre-edit save identity contract. */
export function checkProgression({ load }) {
  const catalog = read('data/puzzle-curriculum.json'), extras = read('data/puzzle-path-extras.json');
  const tiers = ['easy', 'medium', 'hard'];
  const english = tiers.map(d => readPuzzles('en', d));
  const manifest = { version: catalog.version, lessons: catalog.lessons.map(l => ({ id: l.id, difficulty: l.difficulty,
    topicId: l.topicId, skillId: l.skillId, prerequisiteSkillIds: l.prerequisiteSkillIds,
    levels: l.levels.map(v => ({ id: v.id, kind: v.kind, timeLimitSeconds: v.timeLimitSeconds, puzzleIds: v.puzzleIds })) })),
  extras, puzzles: english.map(list => list.map(p => ({ id: p.id, difficulty: p.difficulty, ageRange: p.ageRange, skillId: p.learning.skillId }))) };
  // Captured before these content revisions. Deliberate future ID changes need a migration review.
  assert.equal(createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),
    '0608f92a590db8ab572dcac746e99f1a7a15c8d4b607e28531c2de2184c1e588',
    'Retain all 1,800 puzzle identities, lesson IDs, skill IDs, reward kinds, timer durations and path ordering');
  const { PUZZLE_CONTENT_VERSION } = load('@/constants/puzzles');
  const { shufflePuzzleChoices } = load('@/utils/puzzle-practice');
  const { checkPuzzleAnswer, getValidPairs } = load('@/utils/puzzle-type');
  assert.equal(PUZZLE_CONTENT_VERSION, 2, 'A content revision must not reset existing learning progress');

  for (const locale of ['en', 'lv', 'ru']) {
    const all = tiers.flatMap(d => readPuzzles(locale, d));
    const byId = new Map(all.map(p => [p.id, p]));
    const hardLogic = catalog.lessons.filter(l => l.difficulty === 'hard' && l.topicId === 'logic');
    const reasoningIds = hardLogic.flatMap(l => [
      l.levels.filter(level => level.kind === 'practice')[2].puzzleIds[0],
      l.levels.find(level => level.kind === 'boss').puzzleIds[2],
    ]);
    assert.equal(reasoningIds.length, 20);
    assert.ok(!all.some(p => p.difficulty === 'hard' && p.type === 'order_numbers'), 'Hard no longer tests basic whole-number sorting');
    for (const id of reasoningIds) {
      const p = byId.get(id), source = english.flat().find(p => p.id === id);
      assert.equal(p.type, 'multiple_choice');
      assert.equal(p.topic, 'logic');
      assert.ok(p.learning.reasoningSteps >= 2);
      const numbers = source.question.match(/\d+/g).map(Number);
      let valid;
      if (source.question.startsWith('The code')) {
        const [lower, upper, divisor] = numbers;
        valid = n => n > lower && n < upper && n % divisor === 0 && n % 2 === 0;
        assert.equal(Array.from({ length: upper - lower - 1 }, (_, i) => lower + i + 1).filter(valid).length, 1, 'All clues together determine one whole number');
      } else if (source.question.startsWith('A machine')) {
        const [factor, extra, result] = numbers;
        valid = n => n * factor + extra === result;
      } else {
        assert.ok(source.question.startsWith('Two boxes'));
        const [total, difference] = numbers;
        valid = n => n + (n + difference) === total;
      }
      assert.equal(new Set(p.choices).size, 3);
      for (let seed = 0; seed < 12; seed++) {
        const shuffled = shufflePuzzleChoices(p, `hard-reasoning/${seed}`);
        shuffled.choices.forEach((value, index) => {
          assert.equal(checkPuzzleAnswer(shuffled, { kind: 'choice', index }), valid(Number(value)), `${id}: accept exactly the mathematically valid choice after shuffling`);
        });
      }
    }
    for (const source of english.flat().filter(p => p.question.startsWith('A box holds fewer than'))) {
      const p = byId.get(source.id), boundary = Number(source.question.match(/\d+/)[0]);
      assert.deepEqual(p.choices.map(Number).map(n => n >= boundary), p.choices.map((_, i) => i === p.correctIndex), `${p.id}: only one amount is impossible`);
    }
    for (const difficulty of tiers) {
      const pairs = all.filter(p => p.difficulty === difficulty && p.type === 'pair_sum');
      if (!pairs.length) continue;
      const positions = new Set();
      for (const p of pairs) {
        const valid = getValidPairs(p.payload.numbers, p.payload.target);
        assert.equal(valid.length, 1, `${p.id}: one pair plus distractors, not a row of ready-made pairs`);
        assert.deepEqual(clone(valid[0]), p.payload.correctIndices);
        positions.add(valid[0].join(','));
      }
      assert.ok(positions.size >= 6, 'Authored pair positions vary across the catalog');
    }
    for (const p of all.filter(p => ['pair_sum', 'find_all_pairs'].includes(p.type))) {
      const original = clone(p), positions = new Set();
      const solutions = q => getValidPairs(q.payload.numbers, q.payload.target)
        .map(pair => pair.map(i => q.payload.numbers[i]).sort((a, b) => a - b).join(',')).sort();
      for (let seed = 0; seed < 64; seed++) {
        const shuffled = shufflePuzzleChoices(p, `${p.id}/pair-test/${seed}`);
        assert.deepEqual(clone(shufflePuzzleChoices(p, `${p.id}/pair-test/${seed}`)), clone(shuffled), 'A board stays stable for the same attempt');
        assert.deepEqual(solutions(shuffled), solutions(p), 'Shuffling preserves every valid pair, including equal-valued tiles');
        if (p.type === 'pair_sum') {
          assert.ok(checkPuzzleAnswer(shuffled, { kind: 'pair', indices: shuffled.payload.correctIndices }));
          positions.add([...shuffled.payload.correctIndices].sort((a, b) => a - b).join(','));
          for (let a = 0; a < shuffled.payload.numbers.length; a++) for (let b = a; b < shuffled.payload.numbers.length; b++) {
            assert.equal(checkPuzzleAnswer(shuffled, { kind: 'pair', indices: [a, b] }),
              a !== b && shuffled.payload.numbers[a] + shuffled.payload.numbers[b] === shuffled.payload.target);
          }
        } else assert.ok(checkPuzzleAnswer(shuffled, { kind: 'pairs', pairs: getValidPairs(shuffled.payload.numbers, shuffled.payload.target) }));
      }
      if (p.type === 'pair_sum') assert.ok(positions.size >= 6, 'No fixed pair of screen positions solves repeated attempts');
      assert.deepEqual(clone(p), original, 'Shuffling does not mutate the shared catalog');
    }
    const path = lesson => [...['practice', 'boss', 'challenge'].flatMap(kind => lesson.levels.filter(l => l.kind === kind).flatMap(l => l.puzzleIds)), ...extras[lesson.id]].map(id => byId.get(id));
    assert.deepEqual(all.map(p => [p.id, p.type, p.correctIndex, p.isTrue, p.learning.skillId]),
      english.flat().map(p => [p.id, p.type, p.correctIndex, p.isTrue, p.learning.skillId]), 'Locales have the same questions, answer keys and skill identities');
    const additions = catalog.lessons.filter(l => l.difficulty === 'easy' && l.topicId === 'addition');
    const firstAddition = path(additions[0]);
    assert.ok(firstAddition.every(p => p.type === 'multiple_choice' && p.taskVisual?.kind === 'join'), 'Every introductory addition step uses familiar visible joining');
    assert.ok(firstAddition.every(p => p.taskVisual.left + p.taskVisual.right <= 10), 'The first addition path never jumps to totals over ten');
    assert.ok(additions.slice(0, 5).every(l => !['find_all_pairs', 'pair_sum'].includes(path(l)[7].type)), 'Pair hunts follow missing-part instruction');
    for (const lesson of additions.slice(0, 5)) {
      const tasks = path(lesson), givens = p => JSON.stringify([p.type, p.payload, p.taskVisual, p.question]);
      assert.ok(tasks.slice(0, 7).every(p => givens(p) !== givens(tasks[7])), 'The challenge uses a fresh example of the taught skill');
    }
    assert.ok(additions.slice(5).filter(l => path(l)[7].type === 'pair_sum' || path(l)[7].type === 'find_all_pairs').every(l => path(l)[7].payload.target <= 15), 'Early pair hunts use the totals practised in the lesson');

    const subtractions = catalog.lessons.filter(l => l.difficulty === 'easy' && l.topicId === 'subtraction');
    for (const lesson of subtractions.slice(0, 2)) for (const p of path(lesson)) {
      assert.ok(['multiple_choice', 'number_line'].includes(p.type), 'No claims or error diagnosis before subtraction is taught');
      const start = p.taskVisual?.left ?? p.payload.start;
      assert.ok(start <= 10, 'Every introductory task, including challenge and reviews, stays within ten');
    }
    for (const p of path(subtractions[2])) {
      const answer = p.type === 'number_line' ? p.payload.correctValue : Number(p.choices[p.correctIndex]);
      assert.equal(answer, 10, 'Reaching ten precedes crossing ten');
    }
    for (const p of path(subtractions[3])) {
      const start = p.taskVisual?.left ?? p.payload.start;
      const answer = p.type === 'number_line' ? p.payload.correctValue : Number(p.choices[p.correctIndex]);
      assert.ok(start > 10 && answer < 10, 'Crossing-ten tasks actually cross ten');
    }
    assert.ok(subtractions.slice(0, 6).every(l => path(l).every(p => !['true_false', 'fix_mistake'].includes(p.type))), 'Judge and repair only after subtraction strategies');

    for (const difficulty of tiers) {
      const tasks = all.filter(p => p.difficulty === difficulty);
      const claims = tasks.filter(p => p.type === 'true_false');
      assert.ok(Math.abs(claims.filter(p => p.isTrue).length - claims.filter(p => !p.isTrue).length) <= 1, 'Truth values are balanced within each difficulty');
      for (const topic of ['subtraction', 'multiplication', 'fractions']) {
        const numeric = claims.filter(p => p.topic === topic && !p.payload.hideStatement);
        assert.ok(Math.abs(numeric.filter(p => p.isTrue).length - numeric.filter(p => !p.isTrue).length) <= 1, `${difficulty}/${topic}: balance factual claims within the topic too`);
      }
      const equivalents = tasks.filter(p => p.type === 'fraction_equivalent');
      const factors = new Set();
      for (const p of equivalents) {
        const source = [p.payload.numerator, p.payload.denominator];
        const matches = p.payload.choices.map(c => equalFraction(source, fraction(c)));
        assert.deepEqual(matches, p.payload.choices.map((_, i) => i === p.correctIndex), `${p.id}: exactly one mathematically equivalent answer`);
        const correct = fraction(p.payload.choices[p.correctIndex]);
        factors.add(correct[0] / source[0]);
      }
      if (difficulty === 'easy') assert.ok(factors.has(2) && [...factors].every(f => f === 2 || f === 0.5), 'Easy equivalence only splits pieces in two or joins pairs');
      else assert.ok(factors.has(3) && factors.has(4), 'Later tiers extend beyond doubling');
      if (difficulty !== 'easy') assert.ok([...factors].some(f => f < 1), 'Later fraction questions include simplifying');
      const comparisons = tasks.filter(p => p.type === 'compare' && p.payload.optionA.includes('/'));
      const unlike = comparisons.filter(p => fraction(p.payload.optionA)[1] !== fraction(p.payload.optionB)[1]);
      if (difficulty === 'easy') assert.equal(unlike.length, 0, 'Easy comparisons use the same-sized pieces');
      else assert.ok(unlike.length >= 8, 'Later tiers compare unlike denominators');
      for (const p of comparisons) {
        const a = fraction(p.payload.optionA), b = fraction(p.payload.optionB);
        assert.notEqual(a[0] * b[1], b[0] * a[1], 'Comparison choices are not equivalent');
        assert.equal(p.correctIndex, a[0] * b[1] > b[0] * a[1] ? 0 : 1, `${p.id}: exact rational comparison`);
      }
    }
    const estimates = all.filter(p => p.type === 'estimate'), ranks = [0, 0, 0], directions = new Set();
    for (const p of estimates) {
      const total = p.payload.expression.split('+').reduce((sum, n) => sum + Number(n), 0);
      const values = p.payload.choices.map(c => Number(c.match(/\d+/)[0]));
      const correct = values[p.correctIndex];
      assert.equal(correct, Math.round(total / 10) * 10);
      assert.ok(values.every(n => n % 10 === 0 && Math.abs(n - correct) <= 20), 'Distractors are plausible nearby multiples of ten');
      ranks[values.filter(n => n < correct).length]++;
      directions.add(Math.sign(correct - total));
    }
    assert.ok(ranks.every(n => n >= 2), 'Choosing the smallest estimate is not a reliable shortcut');
    assert.equal(directions.size, 3, 'Include rounding up, down, and already-exact tens');
  }

  const { createDefaultGameSave, parseGameSaveFromValue } = load('@/utils/game-storage');
  const { getLearningReview } = load('@/constants/learning-review');
  const reviewFactors = new Set();
  for (let day = 20000; day < 20033; day++) {
    for (const lesson of ['addition', 'subtraction'].flatMap(topic => catalog.lessons.filter(l => l.difficulty === 'easy' && l.topicId === topic).slice(0, 2))) {
      const question = getLearningReview(lesson, day);
      const numbers = question.explanation.en.match(/\d+/g).map(Number);
      assert.ok(numbers.every(n => n <= 10), 'Daily introductory reviews also stay within ten');
    }
    const lesson = catalog.lessons.find(l => l.id === 'medium-fractions-explore-10');
    const question = getLearningReview(lesson, day);
    const source = question.prompt.en.match(/(\d+)\/(\d+)/).slice(1).map(Number);
    const answers = question.choices.map(fraction);
    assert.deepEqual(answers.map(a => equalFraction(source, a)), answers.map((_, i) => i === question.correctIndex), 'Daily fraction reviews have exactly one equivalent answer');
    reviewFactors.add(answers[question.correctIndex][0] / source[0]);
  }
  assert.ok(reviewFactors.has(3) && reviewFactors.has(4) && [...reviewFactors].some(n => n < 1), 'Daily reviews vary scaling and simplifying too');
  const { PUZZLE_PATHS, getPathStepState, isPathAvailable } = load('@/constants/puzzle-path');
  const { beginTimedChallenge } = load('@/utils/timed-challenge');
  const { applyPuzzleAnswer } = load('@/utils/game-operations');
  const { getPuzzleCoinReward } = load('@/constants/game');
  const first = PUZZLE_PATHS.find(l => l.id === 'easy-addition-join'), now = Date.now();
  // Check every saved position, including a running old pair-hunt now presented as joining.
  for (let count = 0; count <= 10; count++) {
    const save = createDefaultGameSave();
    save.wallet.coins = 137;
    save.progress.completedPuzzleIds = first.levels.slice(0, count).flatMap(l => l.puzzleIds);
    save.progress.attemptedPuzzleIds = [...save.progress.completedPuzzleIds];
    save.progress.learningSupportIds = [first.levels[0].puzzleIds[0]];
    save.progress.learningEvidence = { [first.skillId]: { independentPuzzleIds: save.progress.completedPuzzleIds.slice(1),
      supportedSuccesses: 1, mistakes: 2, lastPractisedAt: now, lastIndependentAt: now } };
    if (count === 7) save.progress = beginTimedChallenge(save.progress, first.levels[7], 'saved-before-revision', now, 'untimed');
    const before = clone(save), restored = parseGameSaveFromValue(JSON.stringify(save)).save;
    for (const field of ['completedPuzzleIds', 'attemptedPuzzleIds', 'learningSupportIds']) {
      assert.deepEqual(clone(restored.progress[field]), before.progress[field], `Saved ${field} survives content changes`);
    }
    assert.deepEqual(clone(restored.progress.learningEvidence[first.skillId].independentPuzzleIds), before.progress.learningEvidence[first.skillId].independentPuzzleIds);
    assert.equal(restored.progress.learningEvidence[first.skillId].supportedSuccesses, 1);
    assert.equal(restored.wallet.coins, 137);
    assert.deepEqual(first.levels.map(l => getPathStepState(first, l, restored.progress)), first.levels.map(l => getPathStepState(first, l, before.progress)));
    assert.deepEqual(PUZZLE_PATHS.map(l => isPathAvailable(l, restored.progress)), PUZZLE_PATHS.map(l => isPathAvailable(l, before.progress)));
    if (count === 7) {
      assert.deepEqual(clone(restored.progress.challengeAttempt), before.progress.challengeAttempt);
      const puzzle = english.flat().find(p => p.id === first.levels[7].puzzleIds[0]);
      const result = applyPuzzleAnswer(restored, puzzle, true, 'revised-challenge', now + 1);
      assert.equal(result.accepted, true);
      assert.equal(result.coins, getPuzzleCoinReward('easy', false, 'challenge'));
      assert.equal(result.save.progress.challengeAttempt.status, 'completed');
      assert.equal(applyPuzzleAnswer(result.save, puzzle, true, 'revised-challenge', now + 2).accepted, false);
    }
  }
  console.log('Verified bilingual progression, balanced claims and estimates, exact fraction answers, unchanged identity manifest, and saved progress at every introductory step.');
}
