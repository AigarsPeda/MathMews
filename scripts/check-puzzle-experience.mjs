/** Exercise production draft readiness, retries, hints and completion without a native renderer. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const cache = new Map();
function loadPure(id) {
  if (cache.has(id)) return cache.get(id);
  if (/\.(png|webp)$/.test(id)) return id;
  const file = id.replace('@/', '') + (id.endsWith('.json') ? '' : '.ts');
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require: loadPure, Set, Map });
  cache.set(id, module.exports);
  return module.exports;
}
const { getPuzzleCoinReward } = loadPure('@/constants/game');
const { getPuzzleDraftAnswer, getPuzzleAttemptHint, getPuzzlePosition } = loadPure('@/utils/puzzle-attempt');
const { checkPuzzleAnswer } = loadPure('@/utils/puzzle-type');
const { isOptionalChallengePuzzle } = loadPure('@/utils/challenge-puzzles');
const { buildFractionMatchCards } = loadPure('@/utils/fraction-match');
const curriculum = loadPure('@/constants/curriculum');
const catalog = JSON.parse(fs.readFileSync('data/puzzle-curriculum.json', 'utf8'));
const allPuzzles = ['easy', 'medium', 'hard'].flatMap(level => JSON.parse(fs.readFileSync(`assets/puzzles/${level}.json`, 'utf8')));
const empty = { choice: null, operators: [], shaded: 0, numberLine: null, pairIndices: [], order: [], matchedCount: 0, pairs: [], challenge: null };
const en = JSON.parse(fs.readFileSync('locales/en.json', 'utf8'));
const lv = JSON.parse(fs.readFileSync('locales/lv.json', 'utf8'));
const t = (key, values = {}) => {
  let text = key.split('.').reduce((value, part) => value?.[part], en) ?? key;
  for (const [name, value] of Object.entries(values)) text = text.replaceAll(`{{${name}}}`, String(value));
  return text;
};
const json = value => JSON.parse(JSON.stringify(value));
function ready(puzzle, patch) { return getPuzzleDraftAnswer(puzzle, { ...empty, ...patch }); }
for (const puzzle of allPuzzles) {
  const blank = ready(puzzle, {});
  assert.equal(blank, null, `${puzzle.id}: incomplete drafts cannot submit`);
  if (puzzle.type === 'fraction_build') {
    assert.ok(puzzle.payload.numerator > 0, 'Every authored fraction requires a shaded piece');
    const answer = ready(puzzle, { shaded: puzzle.payload.numerator });
    assert.equal(checkPuzzleAnswer(puzzle, answer), true);
    const hint = getPuzzleAttemptHint(puzzle, { kind: 'fraction', shaded: puzzle.payload.numerator + 1 });
    assert.equal(hint.key, 'fractionTooMany');
  }
  if (puzzle.type === 'operation_path' || puzzle.type === 'target_build') {
    const operators = puzzle.type === 'operation_path' ? puzzle.payload.steps.map(step => step.operator) : puzzle.payload.solution;
    assert.equal(ready(puzzle, { operators: operators.map(() => null) }), null);
    assert.equal(checkPuzzleAnswer(puzzle, ready(puzzle, { operators })), true);
  }
  if (puzzle.type === 'order_numbers') assert.equal(checkPuzzleAnswer(puzzle, ready(puzzle, { order: puzzle.payload.correctOrder })), true);
  if (puzzle.type === 'number_line') assert.equal(checkPuzzleAnswer(puzzle, ready(puzzle, { numberLine: puzzle.payload.correctValue })), true);
  if (puzzle.type === 'fraction_match') {
    assert.equal(ready(puzzle, { matchedCount: puzzle.payload.pairs.length - 1 }), null);
    assert.equal(checkPuzzleAnswer(puzzle, ready(puzzle, { matchedCount: puzzle.payload.pairs.length })), true);
  }
}
for (const key of Object.keys(en.play.attemptHints)) {
  assert.equal(typeof lv.play.attemptHints[key], 'string', `Latvian hint ${key}`);
  assert.ok(en.play.attemptHints[key].length < 150);
}
for (const lesson of catalog.lessons) {
  const practices = lesson.levels.filter(level => level.kind === 'practice');
  for (const [index, level] of practices.entries()) {
    assert.deepEqual(json(getPuzzlePosition(lesson, level, 0)), { current: index + 1, total: practices.length });
  }
  for (const level of lesson.levels.filter(level => level.kind === 'boss')) {
    for (let phase = 0; phase < level.puzzleIds.length; phase++) assert.deepEqual(json(getPuzzlePosition(lesson, level, phase)), { current: phase + 1, total: level.puzzleIds.length });
  }
}

function renderHarness(file, exportName, mocks = {}) {
  let cursor = 0, effects = [];
  const slots = [];
  const same = (a, b) => a && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) {
        const slot = { value: typeof initial === 'function' ? initial() : initial };
        slot.set = value => { slot.value = typeof value === 'function' ? value(slot.value) : value; };
        slots[index] = slot;
      }
      return [slots[index].value, slots[index].set];
    },
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useMemo(fn, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = { deps, value: fn() };
      return slots[index].value;
    },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) effects.push(() => {
        slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: fn() };
      });
    },
  };
  const jsx = (type, props) => ({ type, props });
  const native = Object.fromEntries(['View', 'Text', 'Pressable', 'ScrollView', 'ActivityIndicator'].map(name => [name, name]));
  const base = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { ...native, Platform: { OS: 'ios' }, StyleSheet: { create: value => value } },
    'react-i18next': { useTranslation: () => ({ t }) },
    '@/utils/scale': { moderateScale: value => value },
    '@/constants/game': { GameColors: {}, MAX_LIVES: 3, getPuzzleCoinReward, getVisualHelpCost: () => 0 },
    '@/hooks/use-world-clock-now': { useWorldClockNow: () => Date.now() },
    ...mocks,
  };
  const module = { exports: {} };
  const source = fs.readFileSync(file, 'utf8') + `\nexport { ${exportName} as TestComponent };`;
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require: id => {
    if (id in base) return base[id];
    if (id.startsWith('@/components/')) return new Proxy({}, { get: (_, name) => String(name) });
    return loadPure(id);
  } });
  return props => {
    cursor = 0;
    const tree = module.exports.TestComponent(props);
    const pending = effects; effects = []; pending.forEach(effect => effect());
    return tree;
  };
}
function nodes(node) { return Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : []; }
function screen(puzzle, { final = false, hasBoss = false, hasChallenge = false, replay = false, kind = 'practice', lifeCount = 3, completedIds = [] } = {}) {
  const level = { id: 'practice', kind, puzzleIds: [puzzle.id], title: { en: 'Practice' }, description: { en: 'Complete the mission.' } };
  const lesson = { id: 'lesson', difficulty: puzzle.difficulty, title: { en: 'Fractions' }, levels: [level] };
  if (kind !== 'practice') lesson.levels.unshift({ ...level, id: 'earlier-practice', kind: 'practice', puzzleIds: ['earlier-puzzle'] });
  if (!final) lesson.levels.push({ ...level, id: 'next', puzzleIds: ['next-puzzle'] });
  if (hasChallenge) lesson.levels.push({ id: 'challenge', kind: 'challenge', puzzleIds: ['challenge-puzzle'] });
  if (hasBoss) lesson.levels.push({ id: 'boss', kind: 'boss', puzzleIds: ['boss-puzzle'] });
  const attempts = [], routes = [];
  const game = { pet: { name: 'Minka', type: 'cat' }, wallet: { coins: 100 }, progress: { completedPuzzleIds: [...completedIds, ...(kind !== 'practice' ? ['earlier-puzzle'] : []), ...(replay ? [puzzle.id] : [])], puzzleStreak: 0, lives: {current:lifeCount,nextRegenAt:lifeCount<3 ? Date.now()+1800000 : null} }, isReady: true, hasCompletedOnboarding: true,
    answerPuzzle: (p, correct, id) => { if(game.progress.lives.current===0) return null; attempts.push({ puzzle: p.id, correct, id }); if(!correct) game.progress.lives.current--; return correct ? getPuzzleCoinReward(p.difficulty, replay, kind) : 0; }, buyLife:async()=>{game.progress.lives.current=Math.min(3,game.progress.lives.current+1); return true;}, recordInteraction() {}, recordLearningHelp(id) {game.progress.learningSupportIds=[...(game.progress.learningSupportIds??[]),id];}, purchaseVisualHelp() {} };
  const router = { push: route => routes.push(['push',route]), prefetch: route => routes.push(['prefetch', route]), dismissTo: route => routes.push(['path', route]) };
  const render = renderHarness('app/play.tsx', 'PlaySession', {
    '@/contexts/GameProvider': { useGame: () => game },
    '@/contexts/LocaleProvider': { useLocale: () => ({ locale: 'en' }) },
    '@/constants/curriculum': { ...curriculum, getLevelPuzzles: () => [puzzle] },
    '@/constants/visual-explanations': { hasVisualExplanation: () => true },
    '@/utils/puzzle-practice': { shufflePuzzleChoices: value => value },
    'expo-router': { useRouter: () => router, useNavigation: () => ({ replace: (...args) => routes.push(['replace', ...args]) }) },
    'expo-haptics': { ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' }, impactAsync() {} },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
  });
  let tree;
  function refresh() { tree = render({ session: { lesson, level, phase: 0 } }); return tree; }
  refresh();
  const scroll = nodes(tree).find(node => node.type === 'ScrollView');
  assert.ok(scroll);
  assert.equal(nodes(scroll).some(node => node.type === 'Pressable' && node.props.accessibilityLabel === t('play.checkAnswer')), false, 'The shared Check action stays outside scrolling puzzle content');
  assert.equal(nodes(tree).filter(node => node.type === 'Pressable' && node.props.accessibilityLabel === t('play.checkAnswer')).length, 1);
  return { refresh, attempts, routes, game, tree:()=>tree,
    task: () => nodes(tree).find(node => node.type === 'PuzzleTaskView').props,
    check: () => nodes(tree).find(node => node.type === 'Pressable' && node.props.accessibilityLabel === t('play.checkAnswer')).props,
    card: () => nodes(tree).find(node => node.type === 'PuzzleCard').props,
    result: () => nodes(tree).find(node => node.type === 'ResultOverlay')?.props,
    text: () => nodes(tree).filter(node => ['Text', 'IconText'].includes(node.type)).map(node => node.props.children).join(' '),
  };
}
const base = { id: 'test', hint: 'Count carefully.', explanation: 'A worked answer.', difficulty: 'easy', topic: 'fractions' };
const pie = screen({ ...base, type: 'fraction_build', payload: { numerator: 2, denominator: 6 } });
assert.equal(pie.check().disabled, true);
pie.task().onToggleFractionSlice(1); pie.refresh();
pie.task().onToggleFractionSlice(4); pie.refresh();
pie.task().onToggleFractionSlice(5); pie.refresh();
const duplicatePress = pie.check().onPress;
duplicatePress(); duplicatePress(); pie.refresh();
assert.equal(pie.attempts.length, 1, 'A rapid double submission records one attempt');
assert.equal(pie.attempts[0].correct, false);
assert.equal(pie.result(), undefined, 'Mistakes are handled in place, without opening a result sheet');
assert.equal(pie.task().answered, false);
assert.deepEqual(json(pie.task().fractionSelectedSlices), [1, 4, 5], 'Incorrect answers preserve exact slice selection');
assert.equal(pie.check().disabled, true, 'Checking the unchanged wrong draft is disabled');
assert.ok(pie.text().includes(en.play.attemptHints.fractionTooMany));
pie.task().onToggleFractionSlice(4); pie.refresh();
assert.equal(pie.check().disabled, false);
assert.ok(!pie.text().includes(en.play.attemptHints.fractionTooMany), 'The old hint disappears when the draft changes');
pie.check().onPress(); pie.refresh();
assert.equal(pie.attempts.length, 2);
assert.notEqual(pie.attempts[0].id, pie.attempts[1].id, 'Correction receives a fresh attempt ID');
assert.equal(pie.attempts[1].correct, true);
assert.equal(pie.result().coinsEarned, 4);
assert.equal(pie.task().answered, true);
assert.deepEqual(json(pie.task().fractionSelectedSlices), [1, 5]);
assert.equal(pie.routes.filter(([kind]) => kind === 'replace').length, 0, 'Success cannot navigate before sheet dismissal');

const choice = screen({ ...base, type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 1 });
choice.task().onSelectChoice(0); choice.refresh(); choice.check().onPress(); choice.refresh();
assert.equal(choice.task().selectedIndex, 0, 'An incorrect choice stays selected');
assert.equal(choice.result(), undefined);
choice.task().onSelectChoice(1); choice.refresh(); choice.check().onPress(); choice.refresh();
assert.equal(choice.result().correct, true);

const operators = screen({ ...base, type: 'target_build', payload: { numbers: [8, 2], target: 4, solution: ['÷'] } });
operators.task().onSelectOperator(0, '+'); operators.refresh(); operators.check().onPress(); operators.refresh();
assert.deepEqual(json(operators.task().selectedOperators), ['+'], 'An incorrect operation remains editable');
assert.ok(operators.text().includes(en.play.attemptHints.totalTooHigh));
operators.task().onSelectOperator(0, '÷'); operators.refresh(); operators.check().onPress(); operators.refresh();
assert.equal(operators.result().correct, true);

const ordering = screen({ ...base, type: 'order_numbers', payload: { numbers: [3, 1, 2], correctOrder: [1, 2, 3] } });
ordering.task().onSwapOrder(0, 2); ordering.refresh();
const beforeRetry = json(ordering.task().numberOrder);
ordering.check().onPress(); ordering.refresh();
assert.deepEqual(json(ordering.task().numberOrder), beforeRetry, 'Retry never reshuffles number tiles');
assert.equal(ordering.task().answered, false);

const line = screen({ ...base, type: 'number_line', payload: { start: 2, jump: 3, min: 0, max: 10, correctValue: 5 } });
line.task().onSelectNumberLineValue(0); line.refresh();
assert.equal(line.check().disabled, false, 'Zero is a valid selected draft');
line.check().onPress(); line.refresh();
assert.equal(line.task().numberLineValue, 0, 'The number-line dot stays where the learner left it');
assert.ok(line.text().includes(en.play.attemptHints.moveRight));

for (const puzzle of allPuzzles.filter(isOptionalChallengePuzzle)) {
  const view = screen(puzzle);
  const wrong = puzzle.type === 'sort_buckets' ? { kind: 'sort', buckets: [-1] }
    : puzzle.type === 'repair_pattern' ? { kind: 'sequence', values: [-1] }
      : puzzle.type === 'route_grid' ? { kind: 'route', cells: [0] } : { kind: 'budget', indices: [0] };
  view.task().onChallengeAnswerChange(wrong); view.refresh(); view.check().onPress(); view.refresh();
  assert.equal(view.task().answered, false, `${puzzle.type}: a wrong attempt does not unmount or lock the challenge`);
  assert.equal(view.result(), undefined);
}
const matching = screen({ ...base, type: 'fraction_match', payload: { pairs: [{ numerator: 1, denominator: 4, visual: 'pie' }, { numerator: 2, denominator: 4, visual: 'grid' }] } });
const cards = buildFractionMatchCards(matching.task().puzzle);
for (const numerator of [1, 2]) for (const card of cards.filter(card => card.numerator === numerator)) { matching.task().onTapFractionMatchCard(card.id); matching.refresh(); }
assert.equal(matching.result(), undefined, 'Completing matches waits for the same explicit Check action');
assert.equal(matching.check().disabled, false);
matching.check().onPress(); matching.refresh(); assert.equal(matching.result().correct, true);

for (const hasBoss of [false, true]) {
  const final = screen({ ...base, choices: ['A', 'B'], correctIndex: 0 }, { final: true, hasBoss });
  final.task().onSelectChoice(0); final.refresh(); final.check().onPress(); final.refresh();
  assert.equal(final.result().message, hasBoss ? en.learning.practiceComplete : en.learning.lessonComplete);
  assert.ok(final.result().summary);
  assert.equal(final.result().continueLabel, hasBoss ? en.learning.start_boss : en.learning.backToLesson);
}

for (const options of [
  { hasChallenge: true, hasBoss: true, destination: 'challenge' },
  { hasBoss: true, kind: 'challenge', destination: 'boss' },
  { hasChallenge: true, hasBoss: true, replay: true, destination: 'challenge' },
  { hasChallenge: true, hasBoss: true, completedIds: ['challenge-puzzle'], destination: 'boss' },
]) {
  const final = screen({ ...base, choices: ['A', 'B'], correctIndex: 0 }, { ...options, final: true });
  final.task().onSelectChoice(0); final.refresh(); final.check().onPress(); final.refresh();
  assert.equal(final.result().continueLabel, en.learning[`start_${options.destination}`]);
  assert.equal(final.result().secondaryLabel, en.learning.backToLesson);
  assert.equal(final.routes.some(([action]) => action === 'replace'), false, 'Success presents the choice before navigating');
  final.result().onContinue();
  const route = final.routes.find(([action]) => action === 'replace');
  assert.deepEqual(json(route), ['replace', 'play', { difficulty: 'easy', lesson: 'lesson', level: options.destination }], 'Special levels open directly without forcing a boss checkpoint');
  final.result().onGoHome();
  assert.equal(final.routes.at(-1)[0], 'path');
  assert.equal(final.routes.at(-1)[1].pathname, '/puzzles', 'The secondary action lets the player return to the lesson');
}

const completedSpecials = screen({ ...base, choices: ['A', 'B'], correctIndex: 0 }, {
  final: true, hasChallenge: true, hasBoss: true, completedIds: ['challenge-puzzle', 'boss-puzzle'],
});
completedSpecials.task().onSelectChoice(0); completedSpecials.refresh(); completedSpecials.check().onPress(); completedSpecials.refresh();
assert.equal(completedSpecials.result().continueLabel, en.learning.backToLesson, 'Completed special levels are not offered again');

const replay = screen({ ...base, choices: ['A', 'B'], correctIndex: 0 }, { final: true, replay: true });
replay.task().onSelectChoice(0); replay.refresh(); replay.check().onPress(); replay.refresh();
assert.equal(replay.result().message, en.play.crackedAgain, 'A replay does not announce a new lesson completion');
assert.equal(replay.result().summary, undefined);

const pairPuzzle = { ...base, type: 'pair_sum', payload: { numbers: [2, 8, 4, 6], target: 10, correctIndices: [0, 1] } };
const pair = screen(pairPuzzle);
pair.task().onTogglePairIndex(0); pair.refresh(); assert.equal(pair.check().disabled, true);
pair.task().onTogglePairIndex(2); pair.refresh(); pair.check().onPress(); pair.refresh();
assert.deepEqual(json(pair.task().pairIndices), [0, 2]);
assert.ok(pair.text().includes(en.play.attemptHints.totalTooLow));
pair.task().onTogglePairIndex(0); pair.refresh(); pair.task().onTogglePairIndex(3); pair.refresh();
pair.check().onPress(); pair.refresh(); assert.equal(pair.result().correct, true, 'Alternative valid pairs still earn success');

const matchingTask = renderHarness('components/puzzle/FractionMatchTask.tsx', 'FractionMatchTask');
const matchingProps = { puzzle: matching.task().puzzle, matchedIds: [], selectedId: null, wrongIds: [cards[0].id, cards[1].id], answered: false, isCorrect: false, onTapCard() {} };
const mismatchTree = matchingTask(matchingProps);
const mismatchedCards = nodes(mismatchTree).filter(node => node.type === 'Pressable' && node.props.style.some(style => style?.borderColor === '#FF9F43'));
assert.equal(mismatchedCards.length, 2, 'Only the two chosen mismatched cards receive feedback');
assert.ok(nodes(mismatchTree).some(node => node.props.children === en.puzzleTypes.fractionMatchTryAgain));

// The task's tap selection is independent of the actual number order.
let swaps = [], moves = [];
const renderOrder = renderHarness('components/puzzle/OrderNumbersTask.tsx', 'OrderNumbersTask', {
  './PuzzleDragBoard': { PuzzleDragBoard: 'PuzzleDragBoard', PuzzleDragTile: 'PuzzleDragTile', PuzzleDropArea: 'PuzzleDropArea' },
});
const orderProps = { puzzle: { payload: { correctOrder: [1, 2, 3] } }, order: [3, 2, 1], answered: false, isCorrect: false,
  onMove: (...args) => moves.push(args), onSwap: (...args) => swaps.push(args), onDragStateChange() {} };
let orderTree = renderOrder(orderProps);
const tiles = () => nodes(orderTree).filter(node => node.type === 'PuzzleDragTile');
tiles()[0].props.onPress(); orderTree = renderOrder(orderProps);
assert.equal(tiles()[0].props.selected, true);
tiles()[0].props.onPress(); orderTree = renderOrder(orderProps); assert.equal(swaps.length, 0, 'Tapping the same tile cancels');
tiles()[0].props.onPress(); orderTree = renderOrder(orderProps);
tiles()[2].props.onPress(); orderTree = renderOrder(orderProps); assert.deepEqual(json(swaps), [[0, 2]]);
nodes(orderTree).find(node => node.type === 'PuzzleDragBoard').props.onDrop('2', '1'); orderTree = renderOrder(orderProps);
assert.deepEqual(json(moves), [[1, 2]], 'Dragging retains insert behavior while tapping swaps');
assert.ok(tiles().every(tile => !tile.props.selected));
orderTree = renderOrder({ ...orderProps, order: [1, 3, 2] });
nodes(orderTree).find(node => node.type === 'PuzzleDragBoard').props.onDrop('2', '1');
assert.deepEqual(json(moves.at(-1)), [2, 0], 'A repeated drag follows the number identities after reordering');
orderTree = renderOrder({ ...orderProps, answered: true }); tiles()[0].props.onPress();
assert.equal(swaps.length, 1, 'Answered boards ignore taps');
// Hard inference tasks must not print a target or counterexample before success.
const renderFractionBuild = renderHarness('components/puzzle/FractionBuildTask.tsx', 'FractionBuildTask');
const garden = allPuzzles.find(p => p.id === 'v2-hard-fractions-garden-2');
assert.equal(garden.payload.hideTarget, true);
const fractionProps = { puzzle: garden, shadedPieces: 0, selectedSlices: [], onChangeShaded() {}, onToggleSlice() {} };
for (const state of [{ answered: false, isCorrect: false }, { answered: true, isCorrect: false }]) {
  assert.ok(!nodes(renderFractionBuild({ ...fractionProps, ...state })).some(node => node.type === 'Text' && node.props.children === 1), 'The unknown fraction numerator stays hidden before success');
}
assert.ok(nodes(renderFractionBuild({ ...fractionProps, answered: true, isCorrect: true })).some(node => node.props.children === 1), 'Successful fraction feedback may show the answer');
assert.ok(nodes(renderFractionBuild({ ...fractionProps, puzzle: { ...garden, payload: { numerator: 1, denominator: 4 } }, answered: false, isCorrect: false })).some(node => node.props.children === 1), 'A copying task still displays the fraction it asks for');
const renderTrueFalse = renderHarness('components/puzzle/TrueFalseTask.tsx', 'TrueFalseTask');
const claim = allPuzzles.find(p => p.id === 'v2-hard-logic-clues-2');
const claimProps = { puzzle: claim, selectedIndex: null, onSelect() {} };
for (const state of [{ answered: false, isCorrect: false }, { answered: true, isCorrect: false }]) {
  assert.ok(!nodes(renderTrueFalse({ ...claimProps, ...state })).some(node => node.props.children === claim.payload.statement), 'A counterexample must not give away the truth of a claim');
}
const visibleStatement = { ...claim, payload: { statement: '25% × 80 = 20' } };
assert.ok(nodes(renderTrueFalse({ ...claimProps, puzzle: visibleStatement, answered: false, isCorrect: false })).some(node => node.props.children === visibleStatement.payload.statement), 'Ordinary true/false questions retain the statement being judged');
const renderStory = renderHarness('components/puzzle/MultipleChoiceTask.tsx', 'MultipleChoiceTask');
const area = allPuzzles.find(p => p.id === 'v2-hard-measurement-area-1');
const storyProps = { puzzle: area, selectedIndex: null, answered: false, isCorrect: false, onSelect() {} };
assert.equal(nodes(renderStory(storyProps)).find(node => node.type === 'QuantityTaskScene').props.showExpression, false, 'Hard story pictures do not supply the arithmetic operation');
assert.equal(nodes(renderStory({ ...storyProps, puzzle: { ...area, difficulty: 'easy' } })).find(node => node.type === 'QuantityTaskScene').props.showExpression, true, 'Easy story models keep their equation support');
const hardOperations = screen(allPuzzles.find(p => p.id === 'v2-hard-operations-connected-2'));
assert.ok(hardOperations.text().includes(en.play.mechanicIntro.target_buildHard));
assert.ok(!hardOperations.text().includes(en.play.mechanicIntro.target_build), 'The live Hard screen must not teach the operation order before a choice');
console.log(`Puzzle experience checks passed across ${allPuzzles.length} authored puzzles: readiness, correction, hints, progress, matching, completion, tap-to-swap and Hard answer visibility.`);

// Child-owned challenge drafts report readiness without resetting their local work.
let challengeDraft;
const controls = { answered: false, onAnswerChange: answer => { challengeDraft = answer; }, onDragStateChange() {} };
const renderSort = renderHarness('components/puzzle/ChallengeTasks.tsx', 'SortBucketsTask');
const sortProps = { ...controls, puzzle: { type: 'sort_buckets', payload: { rule: 'range', numbers: [1, 6], boundary: 5 } } };
let challengeTree = renderSort(sortProps);
assert.equal(challengeDraft, null);
let board = () => nodes(challengeTree).find(node => node.type === 'PuzzleDragBoard').props;
board().onDrop('0', 'bucket-0'); challengeTree = renderSort(sortProps); assert.equal(challengeDraft, null);
board().onDrop('1', 'bucket-0'); challengeTree = renderSort(sortProps);
assert.deepEqual(json(challengeDraft), { kind: 'sort', buckets: [0, 0] });
assert.equal(checkPuzzleAnswer(sortProps.puzzle, challengeDraft), false);
challengeTree = renderSort(sortProps);
assert.deepEqual(json(challengeDraft.buckets), [0, 0], 'Incorrect sorting remains placed');
board().onDrop('1', 'bucket-1'); challengeTree = renderSort(sortProps);
assert.equal(checkPuzzleAnswer(sortProps.puzzle, challengeDraft), true);

const renderPattern = renderHarness('components/puzzle/ChallengeTasks.tsx', 'RepairPatternTask');
const patternProps = { ...controls, puzzle: { type: 'repair_pattern', payload: { sequence: [1, null, 3, null], tiles: [2, 4, 9], solution: [2, 4] } } };
challengeTree = renderPattern(patternProps); assert.equal(challengeDraft, null);
board().onDrop('2', 'gap-0'); challengeTree = renderPattern(patternProps);
board().onDrop('1', 'gap-1'); challengeTree = renderPattern(patternProps);
assert.equal(checkPuzzleAnswer(patternProps.puzzle, challengeDraft), false);
board().onDrop('0', 'gap-0'); challengeTree = renderPattern(patternProps);
assert.equal(checkPuzzleAnswer(patternProps.puzzle, challengeDraft), true);
board().onDrop('0', 'bank'); challengeTree = renderPattern(patternProps);
assert.equal(challengeDraft, null, 'Returning a tile disables Check again');

const renderRoute = renderHarness('components/puzzle/ChallengeTasks.tsx', 'RouteGridTask');
const routeProps = { ...controls, puzzle: { type: 'route_grid', payload: { columns: 2, moves: 2, start: 1, target: 3,
  cells: [null, { operator: '+', operand: 1 }, { operator: '+', operand: 10 }, { operator: '+', operand: 1 }] } } };
challengeTree = renderRoute(routeProps); assert.equal(challengeDraft, null);
let cells = () => nodes(challengeTree).filter(node => node.type === 'Pressable' && node.props.accessibilityRole === 'button');
cells()[1].props.onPress(); challengeTree = renderRoute(routeProps); assert.equal(challengeDraft, null);
cells()[3].props.onPress(); challengeTree = renderRoute(routeProps); assert.equal(checkPuzzleAnswer(routeProps.puzzle, challengeDraft), true);
nodes(challengeTree).find(node => node.props.label === t('challenges.undoStep')).props.onPress(); challengeTree = renderRoute(routeProps);
assert.equal(challengeDraft, null, 'Undoing a route disables Check until it reaches the exit again');

const renderBudget = renderHarness('components/puzzle/ChallengeTasks.tsx', 'BudgetPlanTask');
const budgetProps = { ...controls, puzzle: { type: 'budget_plan', payload: { budget: 10, remaining: 2, pickCount: 2,
  items: [{ label: 'A', price: 4, discountPercent: 0 }, { label: 'B', price: 8, discountPercent: 50 }, { label: 'C', price: 6, discountPercent: 0 }] } } };
challengeTree = renderBudget(budgetProps); assert.equal(challengeDraft, null);
let items = () => nodes(challengeTree).filter(node => node.type === 'Pressable' && node.props.accessibilityRole === 'checkbox');
items()[0].props.onPress(); challengeTree = renderBudget(budgetProps); assert.equal(challengeDraft, null);
items()[2].props.onPress(); challengeTree = renderBudget(budgetProps); assert.equal(checkPuzzleAnswer(budgetProps.puzzle, challengeDraft), false);
items()[2].props.onPress(); challengeTree = renderBudget(budgetProps); assert.equal(challengeDraft, null);
items()[1].props.onPress(); challengeTree = renderBudget(budgetProps); assert.equal(checkPuzzleAnswer(budgetProps.puzzle, challengeDraft), true);
assert.equal(getPuzzleAttemptHint(budgetProps.puzzle, { kind: 'budget', indices: [0, 2] }).key, 'budgetTooMuch');
console.log('All four challenge types preserve local work, update the shared action, disable incomplete drafts and grade corrections.');

for (const difficulty of ['easy', 'medium', 'hard']) {
  const puzzle = allPuzzles.find(p => p.difficulty === difficulty && curriculum.getPuzzleLevelKind(p.id) === 'boss');
  for (const replay of [false, true]) {
    const boss = screen(puzzle, { final: true, kind: 'boss', replay });
    assert.equal(boss.card().coinReward, 2 * getPuzzleCoinReward(difficulty, replay), 'The boss question badge advertises the actual increased reward');
    assert.equal(getPuzzleCoinReward(difficulty, replay, 'challenge'), getPuzzleCoinReward(difficulty, replay), 'Optional challenge rates stay unchanged');
  }
}
console.log('Boss question badges advertise double first-clear and replay rewards on every difficulty.');
const threeLives=screen({...base,type:'multiple_choice',choices:['4','5','6'],correctIndex:0});
for(const [index,left] of [[1,2],[2,1],[1,0]]) {
  threeLives.task().onSelectChoice(index);threeLives.refresh();
  const submit=threeLives.check().onPress;submit();submit();threeLives.refresh();
  assert.equal(threeLives.game.progress.lives.current,left,'A submitted mistake uses exactly one life');
  assert.equal(threeLives.card().coinReward,4,'Coin values stay fixed');
}
assert.equal(threeLives.attempts.length,3);
assert.ok(threeLives.text().includes(en.lives.outOfLives));
assert.equal(threeLives.task().hasLives,false);
threeLives.task().onSelectChoice(0);threeLives.refresh();
assert.equal(threeLives.check().disabled,true);
threeLives.check().onPress();threeLives.refresh();
assert.equal(threeLives.result(),undefined,'No success sheet can appear at zero lives');
const workedExample=nodes(threeLives.tree()).find(n=>n.type==='Pressable'&&nodes(n).some(child=>child.props.children===en.lives.workedExample));
assert.ok(workedExample,'Help remains available without lives');workedExample.props.onPress();threeLives.refresh();
assert.ok(nodes(threeLives.tree()).some(n=>n.type==='VisualHelpSheet'));
assert.equal(threeLives.game.progress.lives.current,0,'Opening help costs no life');
assert.ok(threeLives.game.progress.learningSupportIds.includes(base.id),'Picture help records support for the source puzzle');
assert.equal(threeLives.game.progress.lives.current,0);

const reopenedNoLives=screen({...base,type:'multiple_choice',choices:['4','5'],correctIndex:0},{lifeCount:0});
reopenedNoLives.task().onSelectChoice(0);reopenedNoLives.refresh();
assert.equal(reopenedNoLives.check().disabled,true,'Reopening cannot bypass the life gate');
const staleLife=screen({...base,type:'multiple_choice',choices:['4','5'],correctIndex:0});
staleLife.task().onSelectChoice(0);staleLife.refresh();
const staleCheck=staleLife.check().onPress;staleLife.game.progress.lives.current=0;
staleCheck();staleLife.refresh();
assert.equal(staleLife.result(),undefined,'A rejected atomic submission cannot display success');
const mismatchLife=screen({...base,type:'fraction_match',payload:{pairs:[{numerator:1,denominator:4,visual:'pie'},{numerator:2,denominator:4,visual:'grid'}]}});
const mismatchCards=buildFractionMatchCards(mismatchLife.task().puzzle);
for(let i=0;i<3;i++) {
  mismatchLife.task().onTapFractionMatchCard(mismatchCards.find(c=>c.numerator===1).id);mismatchLife.refresh();
  const wrongTap=mismatchLife.task().onTapFractionMatchCard;
  const other=mismatchCards.find(c=>c.numerator===2).id;
  wrongTap(other);wrongTap(other);mismatchLife.refresh();
  assert.equal(mismatchLife.game.progress.lives.current,2-i,'An instant mismatched pair costs one life, including rapid duplicate callbacks');
}
assert.equal(mismatchLife.task().hasLives,false);
for(const key of ['mistakeCost','checkPaused','nextLifeIn','openRefill','workedExample']) assert.equal(typeof lv.lives[key],'string');
console.log('Three-life UI, full rewards, stale submissions, matching mistakes, reopen and zero-life help pass.');
let instantWrong=0, instantPairs=[];
const pairHuntProps={puzzle:{...base,type:'find_all_pairs',payload:{numbers:[1,2,3,7,8,9],target:10}},pairs:[],answered:false,canAttempt:true,
 onChange:pairs=>{instantPairs=pairs;},onIncorrectAttempt:()=>{instantWrong++;return true;}};
const renderHunt=renderHarness('components/puzzle/FindAllPairsTask.tsx','FindAllPairsTask');
let huntTree=renderHunt(pairHuntProps);
const huntButton=label=>nodes(huntTree).find(n=>n.type==='Pressable'&&nodes(n).some(c=>c.props.children===label));
const huntTile=index=>nodes(huntTree).find(n=>n.props.accessibilityLabel===t('learning.numberTile',{number:pairHuntProps.puzzle.payload.numbers[index],position:index+1}));
function selectHunt(index){huntTile(index).props.onPress();huntTree=renderHunt(pairHuntProps);}
selectHunt(0);selectHunt(1);
const submitPair=huntButton(en.learning.savePair).props.onPress;
submitPair();submitPair();huntTree=renderHunt(pairHuntProps);
assert.equal(instantWrong,1,'An invalid pair submission uses one life, even on a double tap');
assert.equal(instantPairs.length,0);
selectHunt(1);selectHunt(5);huntButton(en.learning.savePair).props.onPress();huntTree=renderHunt(pairHuntProps);
assert.deepEqual(json(instantPairs),[[0,5]]);
assert.equal(instantWrong,1,'A valid pair costs no life');
pairHuntProps.pairs=instantPairs;selectHunt(0);selectHunt(5);huntButton(en.learning.savePair).props.onPress();huntTree=renderHunt(pairHuntProps);
assert.equal(instantWrong,1,'Repeating a previously found correct pair is not a mathematical mistake');
pairHuntProps.canAttempt=false;huntTree=renderHunt(pairHuntProps);
assert.ok(pairHuntProps.puzzle.payload.numbers.every((_,i)=>huntTile(i).props.disabled));
assert.equal(huntButton(en.learning.savePair).props.disabled,true);
const lockedMatch=matchingTask({...matchingProps,canAttempt:false});
assert.ok(nodes(lockedMatch).filter(n=>n.type==='Pressable').every(n=>n.props.disabled),'Instant matching checks pause at zero lives');
console.log('Instant pair checks charge mistakes once, preserve correct collections, and pause without lives.');

// Render the real review screen with an isolated save and real submission operation.
const { applyLearningReview } = loadPure('@/utils/learning-review');
const { getLearningReview } = loadPure('@/constants/learning-review');
const reviewLesson = catalog.lessons[0], reviewDay = Math.floor(Date.now()/86400000);
const reviewQuestion = getLearningReview(reviewLesson, reviewDay);
let reviewSave = {progress:{lives:{current:3,nextRegenAt:null},completedPuzzleIds:[],reviewAttemptKeys:[]},wallet:{coins:42}};
const reviewRoutes=[];
const reviewGame={isReady:true,hasCompletedOnboarding:true,progress:reviewSave.progress,
  answerLearningReview(lessonId,day,selected){const result=applyLearningReview(reviewSave,lessonId,day,selected);reviewSave=result.save;reviewGame.progress=reviewSave.progress;return result.accepted?result.correct:null;}};
const renderReview=renderHarness('app/review.tsx','ReviewScreen',{
  '@/contexts/GameProvider':{useGame:()=>reviewGame},
  '@/contexts/LocaleProvider':{useLocale:()=>({locale:'en'})},
  'expo-router':{useLocalSearchParams:()=>({lesson:reviewLesson.id}),useRouter:()=>({canGoBack:()=>false,replace:route=>reviewRoutes.push(route),push:route=>reviewRoutes.push(route)})},
  'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},
});
let reviewTree=renderReview({});
const reviewButton=label=>nodes(reviewTree).find(n=>n.type==='Pressable'&&nodes(n).some(child=>child.props.children===label));
assert.equal(reviewButton(en.play.checkAnswer).props.disabled,true,'Review requires a selected answer');
reviewButton(reviewQuestion.choices[(reviewQuestion.correctIndex+1)%3]).props.onPress();reviewTree=renderReview({});
assert.equal(reviewButton(en.play.checkAnswer).props.disabled,false);
reviewButton(en.play.checkAnswer).props.onPress();reviewTree=renderReview({});
assert.equal(reviewSave.progress.lives.current,2,'The real review screen charges one life for a mistake');
assert.equal(reviewSave.wallet.coins,42);
assert.equal(reviewButton(en.play.checkAnswer),undefined,'A submitted review cannot be checked again');
reviewButton(en.learning.backToLesson).props.onPress();
assert.equal(reviewRoutes.at(-1).pathname,'/puzzles','Review feedback returns to the lesson');
assert.equal(reviewRoutes.at(-1).params.lesson,reviewLesson.id);
console.log('Review screen requires selection, submits once, charges one life on error and returns to the lesson.');
