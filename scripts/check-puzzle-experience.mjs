import { readPuzzles } from './puzzles/catalog.mjs';
/** Exercise production draft readiness, retries, hints and completion without a native renderer. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createInstance } from 'i18next';

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
const { puzzleQADraft } = loadPure('@/utils/puzzle-qa-draft');
const { buildFractionMatchCards } = loadPure('@/utils/fraction-match');
const curriculum = loadPure('@/constants/curriculum');
const catalog = JSON.parse(fs.readFileSync('data/puzzle-curriculum.json', 'utf8'));
const allPuzzles = ['easy', 'medium', 'hard'].flatMap(level => readPuzzles('en', level));
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
const { percentageRevealPlan, percentageAmount, percentageFraction } = loadPure('@/utils/percentage-reveal');
for (const p of allPuzzles.filter(p => p.percentageExample || p.helpTemplate?.startsWith('percent_'))) {
  assert.ok(p.percentageExample, p.id);
  const [part] = percentageRevealPlan(p, null).parts;
  assert.ok(Number.isInteger(part.percent) && part.percent >= 0 && part.percent <= 100, p.id);
  const amount = percentageAmount(part);
  const [n, d] = percentageFraction(part.percent).split('/').map(Number);
  assert.equal(n * 100, part.percent * (d ?? 1), p.id);
  if (p.type === 'true_false') {
    const [percent, whole, claim] = p.payload.statement.match(/\d+/g).map(Number);
    assert.deepEqual([part.percent, part.whole], [percent, whole]);
    assert.equal(amount === claim, p.isTrue, p.id);
  } else {
    const choices = p.choices ?? p.payload.choices;
    assert.equal(part.kind === 'sale' ? part.whole - amount : amount, Number(choices[p.correctIndex]), p.id);
  }
}
for (const p of allPuzzles.filter(p => p.type === 'budget_plan')) {
  assert.equal(percentageRevealPlan(p, null), null);
  for (let a = 0; a < p.payload.items.length; a++) for (let b = a + 1; b < p.payload.items.length; b++) {
    const picks = [a, b].map(i => p.payload.items[i]);
    const spent = picks.reduce((sum, item) => sum + item.price * (100 - item.discountPercent) / 100, 0);
    const plan = percentageRevealPlan(p, { kind: 'budget', indices: [a, b] });
    if (p.payload.budget - spent !== p.payload.remaining) assert.equal(plan, null, p.id);
    else {
      assert.deepEqual(json(plan.parts.map(i => i.label)), picks.map(i => i.label), p.id);
      assert.equal(plan.budget - plan.parts.reduce((sum, part) => sum + part.whole - percentageAmount(part), 0), p.payload.remaining);
    }
  }
}
const { numberLineRoute, landingEquation } = loadPure('@/utils/number-line-reveal');
for (const p of allPuzzles.filter(p => ['number_line', 'signed_line', 'fraction_number_line'].includes(p.type))) {
  const route = numberLineRoute(p), { stops, min, max, divisions } = route;
  const q = p.payload;
  // A "start at n, then move" alternate question walks from its stated start to the chosen landing.
  const choice = q.mode === 'place' && p.response?.kind === 'choose' ? Number(p.response.options[p.response.correctIndex]?.replace('−', '-')) : NaN;
  const relative = Number.isFinite(choice) && choice >= q.min && choice <= q.max;
  const start = divisions ? 0 : q.mode === 'place' ? (relative ? q.start : 0) : q.start;
  const target = divisions ? q.numerator * divisions / q.denominator : q.correctValue ?? (q.mode === 'place' ? (relative ? choice : q.start) : q.start + q.delta);
  assert.equal(stops[0], start); assert.equal(stops.at(-1), target);
  assert.ok(stops.every(n => Number.isInteger(n) && n >= min && n <= max), p.id);
  assert.ok(stops.slice(1).every((n, i) => Math.sign(n - stops[i]) === Math.sign(target - start)), p.id);
  if (start * target < 0) assert.ok(stops.includes(0), p.id);
  if (divisions && divisions !== q.denominator) assert.equal(landingEquation(route, stops.length - 1), `${target}/${divisions} = ${q.numerator}/${q.denominator}`);
}
const { fractionRevealPlan } = loadPure('@/utils/fraction-reveal');
for (const p of allPuzzles) {
  const plan = fractionRevealPlan(p);
  if ((p.type?.startsWith('fraction_') && p.type !== 'fraction_number_line') || p.fractionExample || p.payload?.rule === 'fractions') assert.ok(plan, p.id);
  if (!plan) continue;
  for (const { numerator, denominator } of plan.diagrams) {
    assert.ok(Number.isInteger(numerator) && Number.isInteger(denominator) && numerator >= 0 && numerator <= denominator && denominator > 0, p.id);
  }
  if (p.type === 'fraction_equivalent') {
    const [a,b] = plan.diagrams;
    assert.equal(a.numerator * b.denominator, b.numerator * a.denominator, p.id);
    assert.equal(`${b.numerator}/${b.denominator}`, p.payload.choices[p.correctIndex], p.id);
  }
  if (p.fractionExample?.whole) {
    const [set] = plan.diagrams;
    assert.equal(set.denominator * set.groupSize, p.fractionExample.whole, p.id);
    assert.equal(set.numerator * set.groupSize, Number(p.choices[p.correctIndex]), p.id);
  }
}
const equivalentStrip = { type: 'fraction_strip', payload: { numerator: 1, denominator: 2, partitions: [4, 6, 8], mode: 'equivalent' } };
for (const parts of equivalentStrip.payload.partitions) {
  assert.equal(fractionRevealPlan(equivalentStrip, { parts, shaded: parts / 2 }).equation, `1/2 = ${parts / 2}/${parts}`);
}
const { clockTravel, clockTime } = loadPure('@/utils/puzzle-clock');
for (const puzzle of allPuzzles.filter(p => p.everyday?.model.kind === 'clock')) {
  const model = puzzle.everyday.model, delta = clockTravel(model);
  const correct = puzzle.choices[puzzle.correctIndex];
  if (model.task === 'elapsed') {
    assert.equal(clockTime(model.minutes + delta), clockTime(model.end), puzzle.id);
    assert.equal(delta, Number(correct) * (puzzle.difficulty === 'easy' ? 60 : 1), puzzle.id);
  } else {
    assert.equal(clockTime(model.minutes + delta), correct, puzzle.id);
  }
}
const { volumeLayers, landedVolumeRows } = loadPure('@/utils/puzzle-volume');
for (const puzzle of allPuzzles.filter(p => p.everyday?.model.kind === 'solid')) {
  const box = puzzle.everyday.model;
  const { rows, perLayer, total } = volumeLayers(box);
  assert.equal(box.answerUnit === 'cubes', puzzle.question.includes('unit cubes'), puzzle.id);
  assert.equal(landedVolumeRows(-.01, box.depth, box.height), 0);
  rows.forEach((row, i) => {
    assert.equal(landedVolumeRows(row.lands - .0001, box.depth, box.height), i);
    assert.equal(landedVolumeRows(row.lands, box.depth, box.height), i + 1);
  });
  assert.equal(landedVolumeRows(box.height + .01, box.depth, box.height), rows.length);
  assert.equal(total, Number(puzzle.choices[puzzle.correctIndex]), puzzle.id);
  assert.equal(rows.length * box.width, total, puzzle.id);
  for (let layer = 0; layer < box.height; layer++) {
    const face = rows.filter(row => row.layer === layer);
    assert.equal(face.length * box.width, perLayer);
    face.forEach((row, i) => {
      assert.equal(row.depthIndex, box.depth - 1 - i);
      assert.ok(layer <= row.begins && row.begins < row.lands && row.lands < layer + 1);
    });
  }
}
const { gridPose, gridSteps, gridStops } = loadPure('@/utils/puzzle-grid');
for (const puzzle of allPuzzles.filter(p => p.everyday?.model.kind === 'grid')) {
  const m = puzzle.everyday.model;
  const stops = gridStops(m);
  let col = (m.start - 1) % m.size, row = Math.floor((m.start - 1) / m.size);
  for (let step = 1; step <= gridSteps(m); step++) {
    if (m.task === 'rotate') [col, row] = [m.size - 1 - row, col];
    else if (m.task === 'reflect') col = m.size - 1 - col;
    else if (step <= Math.abs(m.dx)) col += Math.sign(m.dx);
    else row += Math.sign(m.dy);
    const pose = gridPose(m, step);
    assert.ok(Math.abs(pose.x - col - .5) < 1e-6 && Math.abs(pose.y - row - .5) < 1e-6, puzzle.id);
  }
  assert.equal(stops[0].square, m.start);
  assert.equal(stops.at(-1).square, Number(puzzle.choices[puzzle.correctIndex]), puzzle.id);
  if (m.task === 'reflect') {
    assert.equal(gridPose(m, .5).x, m.size / 2);
    assert.equal(gridPose(m, 1).scaleX, -1);
  }
}
const { shapeGeometry } = loadPure('@/utils/puzzle-shapes');
for (const puzzle of allPuzzles.filter(p => p.everyday?.model.kind === 'shapes')) {
  const model = puzzle.everyday.model;
  const total = model.sides.reduce((sum, n) => {
    const { edges, axes } = shapeGeometry(n, model.rectangle);
    return sum + (model.task === 'symmetry' ? axes : edges).length;
  }, 0);
  assert.equal(total, Number(puzzle.choices[puzzle.correctIndex]), puzzle.id);
}
// Reflect every vertex across each displayed axis; its image must land on another vertex.
for (const [n, rectangle] of [[4, true], ...Array.from({ length: 8 }, (_, i) => [i + 3, false])]) {
  const { edges, axes } = shapeGeometry(n, rectangle);
  assert.equal(axes.length, rectangle ? 2 : n);
  for (const { from, to } of axes) {
    const dx = to.x - from.x, dy = to.y - from.y;
    for (const { from: p } of edges) {
      const projection = ((p.x - from.x) * dx + (p.y - from.y) * dy) / (dx * dx + dy * dy);
      const x = 2 * (from.x + projection * dx) - p.x, y = 2 * (from.y + projection * dy) - p.y;
      assert.ok(edges.some(({ from: q }) => Math.hypot(q.x - x, q.y - y) < 1e-6));
    }
  }
}
const { moneyPurchase } = loadPure('@/utils/puzzle-money');
for (const puzzle of allPuzzles.filter(p => p.everyday?.model.kind === 'money')) {
  const model = puzzle.everyday.model;
  const { price, priceCoins, changeCoins, itemCount, change } = moneyPurchase(model);
  const sum = coins => coins.reduce((a, b) => a + b, 0);
  assert.equal(sum(priceCoins), price, puzzle.id);
  if (model.coins) assert.deepEqual(Array.from(priceCoins), Array.from(model.prices), puzzle.id);
  if (change !== null) assert.equal(price + sum(changeCoins), model.paid, puzzle.id);
  const amount = model.task === 'change' ? change : price;
  const answer = model.task === 'afford' ? itemCount : amount / (model.unit === 'euros' ? 100 : 1);
  assert.equal(answer, Number(puzzle.choices[puzzle.correctIndex]), puzzle.id);
}
const { barAnswer } = loadPure('@/utils/puzzle-bars');
for (const puzzle of allPuzzles.filter(p => p.everyday?.model.kind === 'bars')) {
  const model = puzzle.everyday.model, reveal = barAnswer(model);
  assert.equal(reveal.answer, puzzle.choices[puzzle.correctIndex], puzzle.id);
  assert.ok(reveal.columns.length && reveal.columns.every(i => i >= 0 && i < model.values.length), puzzle.id);
  assert.ok(reveal.marks.every(v => v >= 0 && v <= Math.max(...model.values)), puzzle.id);
}
const { jugMeasure } = loadPure('@/utils/puzzle-capacity');
for (const puzzle of allPuzzles.filter(p => p.everyday?.model.kind === 'capacity')) {
  const model = puzzle.everyday.model;
  const { start, end, capacity, full, portions, remainder } = jugMeasure(model);
  assert.ok(start <= end && end <= capacity, puzzle.id);
  assert.equal(full * model.portion + remainder, end, puzzle.id);
  const result = { space: end - start, litres: end / 1000, servings: portions, containers: portions, total: end, read: end };
  assert.equal(result[model.task], Number(puzzle.choices[puzzle.correctIndex]), puzzle.id);
}
const { balanceLeftValue } = loadPure('@/utils/balance-value');
for (const puzzle of allPuzzles.filter(p => p.type === 'balance')) {
  puzzle.payload.choices.forEach((choice, index) => {
    const total = balanceLeftValue(puzzle.payload.leftDisplay, choice);
    assert.ok(Number.isFinite(total), puzzle.id);
    assert.equal(total === puzzle.payload.rightValue, index === puzzle.correctIndex, puzzle.id);
  });
}
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
    if (!puzzle.response) {
      for (const outcome of ['correct', 'wrong']) {
        const fixture = puzzleQADraft(puzzle, outcome);
        assert.ok(fixture, `${puzzle.id}: missing ${outcome} wedge fixture`);
        assert.equal(fixture.draft.selectedByPair.length, puzzle.payload.pairs.length);
        assert.equal(checkPuzzleAnswer(puzzle, fixture.answer), outcome === 'correct');
      }
    }
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
  for (const level of lesson.levels.filter(level => level.kind !== 'practice')) {
    for (let phase = 0; phase < level.puzzleIds.length; phase++) assert.deepEqual(json(getPuzzlePosition(lesson, level, phase)), { current: phase + 1, total: level.puzzleIds.length });
  }
}

function renderHarness(file, exportName, mocks = {}, fontScale = 1) {
  let cursor = 0, effects = [], dirty = false;
  const slots = [];
  const same = (a, b) => a && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    memo: component => component,
    useContext: context => context.defaultValue,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) {
        const slot = { value: typeof initial === 'function' ? initial() : initial };
        slot.set = value => { const next = typeof value === 'function' ? value(slot.value) : value; dirty ||= !Object.is(next, slot.value); slot.value = next; };
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
  react.useLayoutEffect = react.useEffect;
  const jsx = (type, props, key) => {
    if (type === 'ScrollView' && props.ref && !props.ref.current) props.ref.current = {
      scrollCalls: [], scrollTo(options) { this.scrollCalls.push(options); },
      scrollToEnd(options) { this.scrollCalls.push({ ...options, end: true }); },
    };
    return { type, props, key };
  };
  const native = Object.fromEntries(['View', 'Text', 'Pressable', 'ScrollView', 'ActivityIndicator'].map(name => [name, name]));
  const base = {
    './kit/HelpProofContext': { HelpProofContext: { defaultValue: false } },
    '@shopify/react-native-skia': { makeImageFromView: async () => null },
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { ...native, useWindowDimensions: () => ({ width: 393, height: 852, fontScale }), Platform: { OS: 'ios' }, StyleSheet: { create: value => value } },
    'react-native-reanimated': { useReducedMotion: () => false, __esModule: true, default: { ScrollView: 'ScrollView', View: 'AnimatedView' },
      useSharedValue: value => ({ value }), withTiming: value => value,
      useDerivedValue: compute => ({ get value() { return compute(); } }), useAnimatedStyle: compute => compute(),
      FadeInRight: { duration: duration => ({
        easing(easing) { return { withInitialValues: initialValues => ({ reduceMotion: reduceMotion => ({ duration, easing, initialValues, reduceMotion }) }) }; },
      }) }, Easing: { cubic: 'cubic', out: curve => `out-${curve}` }, ReduceMotion: { System: 'system' } },
    'react-i18next': { useTranslation: () => ({ t }) },
    '@/utils/scale': { moderateScale: value => value },
    'expo-font': { useFonts: () => [true, null] },
    '@/constants/puzzle-fonts': { PuzzleFontAssets: {} },
    '@/constants/game': { GameColors: {}, MAX_LIVES: 3, getPuzzleCoinReward, getVisualHelpCost: () => 0 },
    '@/hooks/use-world-clock-now': { useWorldClockNow: () => Date.now() },
    '@/contexts/LocaleProvider': { useLocale: () => ({ locale: 'en' }) },
    ...mocks,
  };
  // Layout hooks use the same React slots and native dimensions as the component.
  const choiceLayoutModule = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/puzzle/useChoiceLayout.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: choiceLayoutModule, exports: choiceLayoutModule.exports, require: id => base[id] });
  base['@/components/puzzle/useChoiceLayout'] = choiceLayoutModule.exports;
  const module = { exports: {} };
  const source = fs.readFileSync(file, 'utf8') + `\nexport { ${exportName} as TestComponent };`;
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require: id => {
    if (id in base) return base[id];
    // Components render as named stubs; lower-case exports (helpers such as hasStoryReveal) are predicates that return false.
    if (id.startsWith('@/components/') || /^\.\.?\//.test(id)) return new Proxy({}, { get: (_, name) => /^[a-z]/.test(String(name)) ? () => false : String(name) });
    return loadPure(id);
  } });
  return props => {
    let tree, renders = 0;
    do {
      assert.ok(++renders < 10, 'Render-time state adjustments must settle');
      cursor = 0; dirty = false; effects = [];
      tree = module.exports.TestComponent(props);
    } while (dirty);
    const pending = effects; effects = []; pending.forEach(effect => effect());
    return tree;
  };
}
function nodes(node) { return Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : []; }
const storyGivensModule = 'components/puzzle/glyphs/StoryGivens.tsx';
const storyHelpers = {
  splitNumberSequence: renderHarness(storyGivensModule, 'splitNumberSequence'),
  isLimitStory: renderHarness(storyGivensModule, 'isLimitStory'),
};
function screen(puzzle, { proofAudit, fontScale = 1, final = false, hasFollowingTask = false, hasChallenge = false, replay = false, kind = 'practice', lifeCount = 3, completedIds = [], nextPuzzles = [], locale = 'en', lessonOverride, claimedRewards = [] } = {}) {
  const strings = JSON.parse(fs.readFileSync(`locales/${locale}.json`));
  const tr = (key, values = {}) => {
    let text = key.split('.').reduce((value, part) => value?.[part], strings) ?? key;
    for (const [name, value] of Object.entries(values)) text = text.replaceAll(`{{${name}}}`, String(value));
    return text;
  };
  const level = lessonOverride?.levels.at(-1) ?? { id: 'practice', kind, puzzleIds: [puzzle.id], title: { en: 'Practice' }, description: { en: 'Complete the mission.' } };
  const lesson = lessonOverride ?? { id: 'lesson', difficulty: puzzle.difficulty, title: { en: 'Fractions' }, levels: [level] };
  if (kind !== 'practice') lesson.levels.unshift({ ...level, id: 'earlier-practice', kind: 'practice', puzzleIds: ['earlier-puzzle'] });
  if (!final) lesson.levels.push({ ...level, id: 'next', puzzleIds: ['next-puzzle'] });
  if (hasChallenge) lesson.levels.push({ id: 'challenge', kind: 'challenge', puzzleIds: ['challenge-puzzle'] });
  if (hasFollowingTask) lesson.levels.push({ id: 'following', kind: 'practice', puzzleIds: ['following-puzzle'] });
  for (const next of nextPuzzles) lesson.levels.push({ ...level, id: next.id, puzzleIds: [next.id] });
  let session = { lesson, level, phase: 0 };
  const attempts = [], routes = [];
  const game = { pet: { name: 'Minka', type: 'cat' }, wallet: { coins: 100 }, progress: { decorationsUnlocked: [], decorationQuantities: {}, catPlanRewardsClaimed: claimedRewards, unlockedPathLessonIds: ['lesson'], completedPuzzleIds: [...completedIds, ...(kind !== 'practice' ? ['earlier-puzzle'] : []), ...(replay ? [puzzle.id] : [])], puzzleStreak: 0, lives: {current:lifeCount,nextRegenAt:lifeCount<3 ? Date.now()+1800000 : null} }, isReady: true, hasCompletedOnboarding: true,
    answerPuzzle: (p, correct, id) => { if(game.progress.lives.current===0) return null; attempts.push({ puzzle: p.id, correct, id }); if(!correct) game.progress.lives.current--; else game.progress.completedPuzzleIds = [...new Set([...game.progress.completedPuzzleIds, p.id])]; if (correct && lessonOverride) game.progress = loadPure('@/utils/cat-plan-rewards').grantCatPlanRewards(game).progress; return correct ? getPuzzleCoinReward(p.difficulty, replay) : 0; }, requestRoomDecoration: target => routes.push(['decorate', target]), buyLife:async()=>{game.progress.lives.current=Math.min(3,game.progress.lives.current+1); return true;}, recordInteraction() {}, recordLearningHelp(id) {game.progress.learningSupportIds=[...(game.progress.learningSupportIds??[]),id];}, purchaseVisualHelp() {} };
  const router = { push: route => routes.push(['push',route]), dismissTo: route => routes.push(['path', route]),
    setParams: params => { routes.push(['params', params]); session = { lesson, level: lesson.levels.find(item => item.id === params.level), phase: 0 }; } };
  const render = renderHarness('app/play.tsx', 'PlaySession', {
    '@/components/puzzle/glyphs/StoryGivens': storyHelpers,
    'react-i18next': { useTranslation: () => ({ t: tr }) },
    '@/contexts/GameProvider': { useGame: () => game },
    '@/contexts/LocaleProvider': { useLocale: () => ({ locale }) },
    '@/constants/curriculum': { ...curriculum, getLevelPuzzles: (_, __, step) => [nextPuzzles.find(item => item.id === step.id) ?? puzzle] },
    '@/constants/help-examples': { helpKeyFor: () => 'add' },
    '@/utils/puzzle-practice': { shufflePuzzleChoices: value => value },
    'expo-router': { useRouter: () => router },
    'expo-haptics': { ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' }, impactAsync() {} },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
  }, fontScale);
  let tree;
  function refresh() { tree = render({ session: { ...session }, proofAudit }); return tree; }
  refresh();
  const scroll = nodes(tree).find(node => node.type === 'ScrollView');
  assert.ok(scroll);
  assert.equal(nodes(scroll).some(node => node.type === 'PuzzleButton' && node.props.accessibilityLabel === tr('play.checkAnswer')), false, 'The shared Check action stays outside scrolling puzzle content');
  assert.equal(nodes(tree).filter(node => node.type === 'PuzzleButton' && node.props.accessibilityLabel === tr(lifeCount === 0 ? 'lives.refillToRetry' : 'play.checkAnswer')).length, 1);
  return { refresh, attempts, routes, game, tr, tree:()=>tree,
    proof: () => {
      const task = nodes(tree).find(node => node.type === 'PuzzleTaskView')?.props;
      const dedicated = nodes(tree).find(node => node.type === 'CheckedPuzzleReveal')?.props ?? task?.checkedModel?.props;
      if (dedicated) return dedicated;
      if (task?.checkedAttempt) return { snapshot: task.checkedAttempt, mode: task.checkedAttempt.correct ? 'worked' : 'attempt', onSolutionShown: task.onSolutionShown };
    },
    task: () => nodes(tree).find(node => node.type === 'PuzzleTaskView')?.props,
    primary: () => nodes(tree).find(node => node.type === 'PuzzleButton').props,
    check: () => nodes(tree).find(node => node.type === 'PuzzleButton' && node.props.accessibilityLabel === tr('play.checkAnswer')).props,
    card: () => nodes(tree).find(node => node.type === 'PuzzleCard').props,
    result: () => nodes(tree).find(node => node.type === 'ResultOverlay')?.props,
    text: () => nodes(tree).filter(node => ['Text', 'IconText', 'PuzzleText'].includes(node.type)).map(node => node.props.children).join(' '),
  };
}
function seeResult(view) {
  assert.equal(view.result(), undefined, 'Playback waits for explicit dismissal');
  assert.equal(view.proof().mode, 'worked');
  assert.equal(view.primary().accessibilityLabel, view.tr('play.seeResult'));
  view.primary().onPress();
  view.refresh();
}
function retry(view) {
  const before = view.attempts.length, lives = view.game.progress.lives.current;
  if (view.task()) {
    assert.equal(view.task().answered, true, 'The submitted response is locked during playback');
    assert.equal(view.task().checkedAttempt.correct, false);
  }
  assert.equal(view.primary().label, view.tr('play.tryAgain'));
  assert.equal(view.primary().disabled, false, 'A mistake offers an actionable retry');
  view.primary().onPress(); view.refresh();
  assert.equal(view.attempts.length, before, 'Retry does not submit the unchanged answer');
  assert.equal(view.game.progress.lives.current, lives, 'Retry does not spend a life');
}
const base = { id: 'test', hint: 'Count carefully.', explanation: 'A worked answer.', difficulty: 'easy', topic: 'fractions' };
const { PUZZLE_PATHS } = loadPure('@/constants/puzzle-path');
const gateLesson = PUZZLE_PATHS.find(lesson => lesson.difficulty === 'easy');
const gateGame = { isReady: true, hasCompletedOnboarding: true, progress: { completedPuzzleIds: [], unlockedPathLessonIds: [gateLesson.id] } };
let gateParams = { difficulty: 'easy', lessonId: gateLesson.id, levelId: gateLesson.levels[0].id };
const gateMocks = {
  '@/contexts/GameProvider': { useGame: () => gateGame },
  '@/contexts/LocaleProvider': { useLocale: () => ({ locale: 'en' }) },
  'expo-haptics': {},
  'react-native-safe-area-context': {},
  'expo-router': { useLocalSearchParams: () => ({ difficulty: gateParams.difficulty, lesson: gateParams.lessonId, level: gateParams.levelId }) },
};
const renderGate = renderHarness('app/play.tsx', 'LearningPlayGate', gateMocks);
const renderScreen = renderHarness('app/play.tsx', 'PlayScreen', gateMocks);
const initialGate = renderGate(gateParams), initialScreen = renderScreen();
gateGame.progress.completedPuzzleIds = [gateLesson.levels[0].puzzleIds[0]];
assert.equal(renderGate(gateParams).props.session, initialGate.props.session, 'Saving completion cannot replace the puzzle beneath its result');
gateParams = { ...gateParams, levelId: gateLesson.levels[1].id };
assert.equal(renderScreen().key, initialScreen.key, 'Advancing retains the same gate and screen mount');
assert.equal(renderGate(gateParams).props.session.level.id, gateParams.levelId, 'Route updates resolve the new puzzle without remounting');
const continuation = screen({ ...base, type: 'multiple_choice', choices: ['1', '2'], correctIndex: 1 }, {
  final: true, nextPuzzles: [
    { ...base, id: 'second', type: 'multiple_choice', choices: ['3', '4'], correctIndex: 0 },
    { ...base, id: 'third', type: 'order_numbers', payload: { numbers: [3, 1, 2], correctOrder: [1, 2, 3] } },
  ],
});
let shell = continuation.tree();
const persistentScroller = nodes(shell).find(node => node.type === 'ScrollView').props.ref.current;
for (const [index, choice] of [1, 0].entries()) {
  continuation.task().onSelectChoice(choice);
  continuation.task().onGeometryChange(12);
  continuation.task().onResponseChange('42');
  continuation.task().onDecimalGridChange(15);
  continuation.task().onFoundPairsChange([[1, 2]]);
  continuation.task().onSelectNumberLineValue(7);
  continuation.task().onTogglePairIndex(1);
  continuation.task().onDragStateChange(true);
  continuation.refresh();
  continuation.check().onPress(); continuation.refresh();
  seeResult(continuation);
  assert.ok(continuation.result(), 'Recording progress holds the completed puzzle until dismissal');
  continuation.result().onContinue(); continuation.refresh();
  const task = continuation.task();
  assert.equal(task.puzzle.id, index === 0 ? 'second' : 'third');
  assert.equal(task.selectedIndex, null, 'Same-type puzzles cannot inherit a selected answer');
  assert.equal(task.answered, false);
  assert.equal(task.geometry, null);
  assert.equal(task.responseValue, null, 'A new puzzle clears the alternate answer draft');
  assert.equal(task.decimalGrid, null);
  assert.equal(task.numberLineValue, null);
  assert.equal(task.foundPairs.length, 0);
  assert.equal(task.pairIndices.length, 0);
  assert.equal(continuation.result(), undefined, 'A subsequent puzzle unmounts its dismissed result');
  assert.equal(continuation.check().disabled, index === 0, 'Choice drafts start empty; ordering drafts start with movable pieces');
  const tree = continuation.tree();
  assert.equal(tree.type, shell.type, 'The screen shell keeps its component type');
  assert.equal(nodes(tree).find(node => node.type === 'ScrollView').props.scrollEnabled, true);
  assert.equal(nodes(tree).find(node => node.type === 'ScrollView').key, undefined, 'The native scroll view stays mounted between puzzles');
  assert.equal(nodes(tree).find(node => node.type === 'ScrollView').props.ref.current, persistentScroller);
  assert.equal(persistentScroller.scrollCalls.at(-1).y, 0);
  assert.equal(persistentScroller.scrollCalls.at(-1).animated, false, 'The next question starts at the top without a scroll animation');
  assert.equal(nodes(tree).find(node => node.type === 'PuzzleContentTransition').key, task.puzzle.id);
  assert.notEqual(nodes(tree).find(node => node.type === 'PuzzleProgress').props.animated, false, 'The persistent play header animates each progress update');
  assert.equal(nodes(tree).find(node => node.type === 'PuzzleProgress').props.steps.filter(Boolean).length, index + 1);
  shell = tree;
}
assert.notEqual(continuation.attempts[0].id, continuation.attempts[1].id, 'Each puzzle receives a fresh reward attempt ID');
assert.deepEqual([...continuation.task().numberOrder].sort(), [1, 2, 3], 'A different puzzle type initializes its own pieces');
assert.notDeepEqual(json(continuation.task().numberOrder), [1, 2, 3], 'Number ordering starts shuffled');
continuation.task().onSwapOrder(0, continuation.task().numberOrder.indexOf(1)); continuation.refresh();
continuation.task().onSwapOrder(1, continuation.task().numberOrder.indexOf(2)); continuation.refresh();
continuation.check().onPress(); continuation.refresh();
seeResult(continuation);
assert.equal(continuation.result().continueLabel, en.puzzlePathDesign.viewPath);
assert.equal(continuation.result().onGoHome, undefined, 'The end of a path has just one View path action');
continuation.result().onContinue();
assert.equal(continuation.routes.at(-1)[0], 'path', 'The final puzzle still returns to its path');
assert.ok(continuation.routes.every(([action]) => ['params', 'path'].includes(action)), 'Advancing never replaces or pushes the screen');
const percentageWrite = screen(allPuzzles.find(p => p.percentageExample && p.response?.kind === 'write'));
const rightPrice = percentageWrite.task().puzzle.response.answer;
percentageWrite.task().onResponseChange('999'); percentageWrite.refresh();
percentageWrite.check().onPress(); percentageWrite.refresh();
assert.equal(percentageWrite.proof().mode, 'attempt');
assert.equal(percentageWrite.result(), undefined);
retry(percentageWrite);
percentageWrite.task().onResponseChange(rightPrice); percentageWrite.refresh();
percentageWrite.check().onPress(); percentageWrite.refresh();
assert.equal(typeof percentageWrite.proof().onSolutionShown, 'function');
assert.equal(percentageWrite.result(), undefined);
assert.equal(percentageWrite.primary().label, en.play.seeResult);
percentageWrite.primary().onPress(); percentageWrite.refresh();
assert.equal(percentageWrite.result().correct, true);

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
retry(pie);
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
assert.equal(pie.result(), undefined);
assert.deepEqual(json(pie.proof().snapshot.arrangement.selectedSlices), [1, 5]);
pie.primary().onPress(); pie.refresh();
assert.equal(pie.result().coinsEarned, 4);
assert.equal(pie.task(), undefined);
assert.equal(pie.routes.filter(([kind]) => kind === 'replace').length, 0, 'Success cannot navigate before sheet dismissal');

const choice = screen({ ...base, type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 1 });
choice.task().onSelectChoice(0); choice.refresh(); choice.check().onPress(); choice.refresh();
retry(choice);
assert.equal(choice.task().selectedIndex, 0, 'An incorrect choice stays selected');
assert.equal(choice.result(), undefined);
assert.equal(choice.task().incorrectAttempt, true, 'A checked wrong choice receives incorrect feedback while editable');
assert.equal(choice.task().answered, false);
choice.task().onSelectChoice(1); choice.refresh();
assert.equal(choice.task().incorrectAttempt, false, 'Changing the choice clears stale incorrect feedback');
choice.task().onSelectChoice(1); choice.refresh(); choice.check().onPress(); choice.refresh();
seeResult(choice);
assert.equal(choice.result().correct, true);

const operators = screen({ ...base, type: 'target_build', payload: { numbers: [8, 2], target: 4, solution: ['÷'] } });
operators.task().onSelectOperator(0, '+'); operators.refresh(); operators.check().onPress(); operators.refresh();
retry(operators);
assert.deepEqual(json(operators.task().selectedOperators), ['+'], 'An incorrect operation remains editable');
assert.ok(operators.text().includes(en.play.attemptHints.totalTooHigh));
operators.task().onSelectOperator(0, '÷'); operators.refresh(); operators.check().onPress(); operators.refresh();
seeResult(operators);
assert.equal(operators.result().correct, true);

for (const puzzle of [
  allPuzzles.find(p => p.type === 'fair_share' && !p.response),
  allPuzzles.find(p => p.type === 'multiple_choice' && p.taskVisual?.kind === 'share' && !p.response),
]) {
  const view = screen(puzzle, { fontScale: 2.64 });
  const items = puzzle.type === 'fair_share' ? puzzle.payload.items : puzzle.taskVisual.items;
  const locations = Array.from({ length: items }, (_, i) => i === 0 ? 1 : 0);
  view.task().onDistributionChange(locations);
  if (puzzle.type !== 'fair_share') view.task().onSelectChoice(puzzleQADraft(puzzle, 'wrong').answer.index);
  view.refresh(); view.check().onPress(); view.refresh();
  if (puzzle.type === 'multiple_choice') {
    assert.equal(view.task().answered, true);
    assert.deepEqual(json(view.task().initialDistribution), locations);
    assert.equal(view.task().checkedModel, undefined);
    assert.equal(view.task().onSolutionShown, undefined);
    const transition = nodes(view.tree()).find(n => n.type?.name === 'CheckedDrawingTransition');
    assert.equal(transition.props.checked, false);
  } else assert.equal(view.proof().mode, 'attempt');
  retry(view);
  assert.deepEqual(json(view.task().initialDistribution), locations);
  assert.equal(view.task().incorrectAttempt, false, 'The XL retry choice does not retain the old cross');
  const labels = nodes(view.tree()).map(node => node.props.children);
  for (const extra of [en.play.adjustAnswer, en.play.backToPath, en.lives.workedExample]) assert.ok(!labels.includes(extra));
  assert.equal(view.primary().label, en.play.shortCheck);
  assert.equal(view.primary().accessibilityLabel, en.play.checkAnswer);
  assert.equal(view.task().answered, false);
  if (puzzle.type === 'fair_share') {
    assert.equal(view.check().disabled, true, 'An unchanged deal cannot cost another life');
    view.task().onDistributionChange(puzzleQADraft(puzzle, 'correct').answer.locations);
  } else view.task().onSelectChoice(puzzle.correctIndex);
  view.refresh();
  assert.equal(view.check().disabled, false);
  view.check().onPress(); view.refresh();
  assert.equal(view.proof().mode, 'worked');
  const dock = nodes(view.tree()).find(node => node.props.testID === 'play-answer-dock');
  const [caption, submission] = nodes(dock).filter(node => node.type?.name === 'PlaybackDock' || node.props.testID === 'play-submitted-response');
  assert.equal(submission?.props.testID, 'play-submitted-response', 'The XL dock hosts the caption before the answer');
  assert.ok(nodes(view.tree()).some(node => node.props.value === caption.props.host.publish), 'The visible dock uses the caption publisher');
  view.primary().onPress(); view.refresh();
  assert.equal(view.result().correct, true);
}

const ordering = screen({ ...base, type: 'order_numbers', payload: { numbers: [3, 1, 2], correctOrder: [1, 2, 3] } });
ordering.task().onSwapOrder(0, 2); ordering.refresh();
const beforeRetry = json(ordering.task().numberOrder);
ordering.check().onPress(); ordering.refresh();
retry(ordering);
assert.deepEqual(json(ordering.task().numberOrder), beforeRetry, 'Retry never reshuffles number tiles');
assert.equal(ordering.task().answered, false);

const line = screen({ ...base, type: 'number_line', payload: { start: 2, jump: 3, min: 0, max: 10, correctValue: 5 } });
line.task().onSelectNumberLineValue(0); line.refresh();
assert.equal(line.check().disabled, false, 'Zero is a valid selected draft');
line.check().onPress(); line.refresh();
const lineHint = nodes(line.tree()).find(node => node.props.accessibilityLabel === en.play.hintButton);
assert.equal(lineHint.props.accessibilityHint, en.play.attemptHints.moveRight);
assert.equal(typeof lineHint.props.onPress, 'function');

assert.equal(line.proof().mode, 'attempt');
retry(line);
assert.equal(line.task().numberLineValue, 0);
line.task().onSelectNumberLineValue(5); line.refresh(); line.check().onPress(); line.refresh();
assert.equal(line.result(), undefined);
assert.equal(typeof line.proof().onSolutionShown, 'function');
line.primary().onPress(); line.refresh();
assert.equal(line.result().correct, true);

for (const puzzle of allPuzzles.filter(isOptionalChallengePuzzle)) {
  const view = screen(puzzle);
  const wrong = puzzle.type === 'sort_buckets' ? { kind: 'sort', buckets: [-1] }
    : puzzle.type === 'repair_pattern' ? { kind: 'sequence', values: [-1] }
      : puzzle.type === 'route_grid' ? { kind: 'route', cells: [0] } : { kind: 'budget', indices: [0] };
  view.task().onChallengeAnswerChange(wrong); view.refresh(); view.check().onPress(); view.refresh();
  if (puzzle.type === 'budget_plan') {
    const transition = () => nodes(view.tree()).find(node => node.type?.name === 'CheckedDrawingTransition').props;
    const host = nodes(view.tree()).find(node => node.props.value?.onInitialModelPainted).props.value;
    assert.equal(host.attemptKey, view.attempts[0].id);
    assert.equal(transition().preparing, true, 'The frozen basket stays until the checked model has painted');
    host.onInitialModelPainted(0); view.refresh();
    assert.equal(transition().preparing, false, 'The acknowledgement retires the frozen basket in the same update');
  }
  retry(view);
  assert.deepEqual(json(view.task().initialChallengeAnswer), wrong);
  assert.equal(view.result(), undefined);
}
const matching = screen({ ...base, type: 'fraction_match', payload: { pairs: [{ numerator: 1, denominator: 4, visual: 'pie' }, { numerator: 2, denominator: 4, visual: 'grid' }] } });
const cards = buildFractionMatchCards(matching.task().puzzle);
function toggleWedge(board, pair, wedge) {
  board.task().onToggleWedge(pair, wedge);
  board.refresh();
}
toggleWedge(matching, 0, 3);
assert.equal(matching.check().disabled, true, 'Both pies need a selection');
toggleWedge(matching, 1, 1);
matching.check().onPress(); matching.refresh();
const frozenMasks = matching.proof().snapshot.answer.selectedByPair;
assert.deepEqual(json(frozenMasks), [[3], [1]], 'The second pie is checked independently');
retry(matching);
assert.deepEqual(json(matching.task().selectedByPair), [[3], [1]]);
toggleWedge(matching, 1, 2);
assert.deepEqual(json(frozenMasks), [[3], [1]], 'Editing after retry cannot change the submitted drawing');
assert.equal(matching.check().disabled, false);
matching.check().onPress(); matching.refresh(); assert.equal(matching.result(), undefined);
matching.primary().onPress(); matching.refresh(); assert.equal(matching.result().correct, true);

for (const hasFollowingTask of [false, true]) {
  const final = screen({ ...base, choices: ['A', 'B'], correctIndex: 0 }, { final: true, hasFollowingTask });
  final.task().onSelectChoice(0); final.refresh(); final.check().onPress(); final.refresh(); seeResult(final);
  assert.equal(final.result().message, hasFollowingTask ? en.play.greatJob : en.puzzlePathDesign.levelComplete);
  assert.equal(final.result().summary, undefined, 'Path completion keeps the result concise');
  assert.equal(final.result().continueLabel, hasFollowingTask ? en.play.nextPuzzle : en.puzzlePathDesign.viewPath);
}

for (const options of [
  { hasChallenge: true, hasFollowingTask: true, destination: 'challenge' },
  { hasFollowingTask: true, kind: 'challenge', destination: 'following' },
  { hasChallenge: true, hasFollowingTask: true, replay: true, destination: 'challenge' },
  { hasChallenge: true, hasFollowingTask: true, completedIds: ['challenge-puzzle'], destination: 'following' },
]) {
  const final = screen({ ...base, choices: ['A', 'B'], correctIndex: 0 }, { ...options, final: true });
  final.task().onSelectChoice(0); final.refresh(); final.check().onPress(); final.refresh(); seeResult(final);
  assert.equal(final.result().continueLabel, en.play.nextPuzzle);
  assert.equal(final.result().secondaryLabel, en.play.backToPath);
  assert.equal(final.routes.some(([action]) => action === 'params'), false, 'Success presents the choice before advancing');
  final.result().onContinue();
  const route = final.routes.find(([action]) => action === 'params');
  assert.deepEqual(json(route), ['params', { difficulty: 'easy', lesson: 'lesson', level: options.destination }], 'Special levels open in place without forcing a task checkpoint');
  final.result().onGoHome();
  assert.equal(final.routes.at(-1)[0], 'path');
  assert.equal(final.routes.at(-1)[1].pathname, '/puzzles', 'The secondary action lets the player return to the lesson');
}

const completedSpecials = screen({ ...base, choices: ['A', 'B'], correctIndex: 0 }, {
  final: true, hasChallenge: true, hasFollowingTask: true, completedIds: ['challenge-puzzle', 'following-puzzle'],
});
completedSpecials.task().onSelectChoice(0); completedSpecials.refresh(); completedSpecials.check().onPress(); completedSpecials.refresh(); seeResult(completedSpecials);
assert.equal(completedSpecials.result().continueLabel, en.puzzlePathDesign.viewPath, 'Completed special levels are not offered again');

const replay = screen({ ...base, choices: ['A', 'B'], correctIndex: 0 }, { final: true, replay: true });
replay.task().onSelectChoice(0); replay.refresh(); replay.check().onPress(); replay.refresh(); seeResult(replay);
assert.equal(replay.result().message, en.puzzlePathDesign.levelComplete, 'The last question ends a replayed level too');
assert.equal(replay.result().summary, undefined);

const pairPuzzle = { ...base, type: 'pair_sum', payload: { numbers: [2, 8, 4, 6], target: 10, correctIndices: [0, 1] } };
const pair = screen(pairPuzzle);
pair.task().onTogglePairIndex(0); pair.refresh(); assert.equal(pair.check().disabled, true);
pair.task().onTogglePairIndex(2); pair.refresh(); pair.check().onPress(); pair.refresh();
retry(pair);
assert.deepEqual(json(pair.task().pairIndices), [0, 2]);
assert.ok(pair.text().includes(en.play.attemptHints.totalTooLow));
pair.task().onTogglePairIndex(0); pair.refresh(); pair.task().onTogglePairIndex(3); pair.refresh();
pair.check().onPress(); pair.refresh(); seeResult(pair); assert.equal(pair.result().correct, true, 'Alternative valid pairs still earn success');

const matchingTask = renderHarness('components/puzzle/FractionMatchTask.tsx', 'FractionMatchTask');
const matchingProps = { puzzle: matching.proof().snapshot.puzzle, matchedIds: [], selectedId: null, wrongIds: [cards[0].id, cards[1].id], answered: false, isCorrect: false, onTapCard() {} };
const mismatchTree = matchingTask(matchingProps);
// Cards render through a child component; its showWrong prop drives the red outline and ✗ mark.
const mismatchedCards = nodes(mismatchTree).filter(node => node.props.showWrong === true
  || node.type === 'Pressable' && [node.props.style].flat(Infinity).some(style => style?.borderColor === loadPure('@/constants/puzzle-theme').PuzzleColors.incorrect));
assert.equal(mismatchedCards.length, 2, 'Only the two chosen mismatched cards receive feedback');
assert.ok(nodes(mismatchTree).some(node => node.props.children === en.puzzleTypes.fractionMatchTryAgain));

// The task's tap selection is independent of the actual number order.
const moves = [];
const renderOrder = renderHarness('components/puzzle/OrderNumbersTask.tsx', 'OrderNumbersTask', {
  './PuzzleDragBoard': { numberTileFaces: { resting: {}, lifted: {} }, PuzzleDragBoard: 'PuzzleDragBoard', PuzzleDragTile: 'PuzzleDragTile', PuzzleDropArea: 'PuzzleDropArea' },
});
const orderProps = { puzzle: { payload: { correctOrder: [1, 2, 3] } }, order: [3, 2, 1], answered: false, isCorrect: false,
  onMove: (...args) => moves.push(args), onDragStateChange() {} };
let orderTree = renderOrder(orderProps);
const tiles = () => nodes(orderTree).filter(node => node.type === 'PuzzleDragTile');
tiles()[0].props.onPress(); orderTree = renderOrder(orderProps);
assert.equal(tiles()[0].props.selected, true);
tiles()[0].props.onPress(); orderTree = renderOrder(orderProps); assert.equal(moves.length, 0, 'Tapping the same tile cancels');
tiles()[0].props.onPress(); orderTree = renderOrder(orderProps);
tiles()[2].props.onPress(); orderTree = renderOrder(orderProps); assert.deepEqual(json(moves), [[0, 2]]);
nodes(orderTree).find(node => node.type === 'PuzzleDragBoard').props.onDrop('2', '1'); orderTree = renderOrder(orderProps);
assert.deepEqual(json(moves), [[0, 2], [1, 2]], 'Tap and drag both insert the tile at its destination');
assert.ok(tiles().every(tile => !tile.props.selected));
orderTree = renderOrder({ ...orderProps, order: [1, 3, 2] });
nodes(orderTree).find(node => node.type === 'PuzzleDragBoard').props.onDrop('2', '1');
assert.deepEqual(json(moves.at(-1)), [2, 0], 'A repeated drag follows the number identities after reordering');
orderTree = renderOrder({ ...orderProps, answered: true }); tiles()[0].props.onPress();
orderTree = renderOrder({ ...orderProps, answered: true }); tiles()[2].props.onPress();
assert.equal(moves.length, 3, 'Answered boards ignore taps');
// Hard inference tasks must not print a target or counterexample before success.
const renderFractionBuild = renderHarness('components/puzzle/FractionBuildTask.tsx', 'FractionBuildTask');
const garden = allPuzzles.find(p => p.id === 'v2-hard-fractions-garden-2');
assert.equal(garden.payload.hideTarget, true);
const fractionProps = { puzzle: garden, shadedPieces: 0, selectedSlices: [], onChangeShaded() {}, onToggleSlice() {} };
for (const state of [{ answered: false, isCorrect: false }, { answered: true, isCorrect: false }]) {
  assert.ok(!nodes(renderFractionBuild({ ...fractionProps, ...state })).some(node => ['Text', 'PuzzleText'].includes(node.type) && node.props.children === 1 || node.props.numerator === 1), 'The unknown fraction numerator stays hidden before success');
}
assert.ok(nodes(renderFractionBuild({ ...fractionProps, answered: true, isCorrect: true })).some(node => node.props.children === 1 || node.props.numerator === 1), 'Successful fraction feedback may show the answer');
const renderTrueFalse = renderHarness('components/puzzle/TrueFalseTask.tsx', 'TrueFalseTask');
const claim = allPuzzles.find(p => p.id === 'v2-hard-logic-clues-2');
const claimProps = { puzzle: claim, selectedIndex: null, onSelect() {} };
for (const state of [{ answered: false, isCorrect: false }, { answered: true, isCorrect: false }]) {
  assert.ok(!nodes(renderTrueFalse({ ...claimProps, ...state })).some(node => node.props.children === claim.payload.statement), 'A counterexample must not give away the truth of a claim');
}
const visibleStatement = { ...claim, payload: { statement: '25% × 80 = 20' } };
assert.ok(nodes(renderTrueFalse({ ...claimProps, puzzle: visibleStatement, answered: false, isCorrect: false })).some(node => node.props.children === visibleStatement.payload.statement), 'Ordinary true/false questions retain the statement being judged');
const renderTaskView = renderHarness('components/puzzle/PuzzleTaskView.tsx', 'PuzzleTaskView');
for (const type of ['balance', 'function_machine', 'find_all_pairs', 'pair_sum', 'operation_path', 'target_build']) {
  const puzzle = allPuzzles.find(p => p.type === type && !p.response);
  const task = screen(puzzle).task();
  assert.equal(typeof task.AnswerRow, 'function');
  assert.equal(renderTaskView(task).props.AnswerRow, task.AnswerRow, `${type} forwards the Play answer dock to the editor`);
}
for (const correct of [false, true]) {
  const native = screen({ ...visibleStatement, response: undefined });
  native.task().onSelectChoice(correct === visibleStatement.isTrue ? 0 : 1);
  native.refresh(); native.check().onPress(); native.refresh();
  const checked = nodes(renderTaskView(native.task()));
  const editor = checked.find(node => node.type === 'TrueFalseTask');
  assert.equal(checked.filter(node => node.type === 'CheckedPuzzleReveal').length, 1);
  assert.equal(editor.props.hasHostedProof, true);
  assert.equal(renderTrueFalse(editor.props), null, 'The hosted proof owns the only signed claim');
}
const judgePuzzle = allPuzzles.find(p => p.type === 'signed_line' && p.response?.kind === 'judge');
const judgeView = screen(judgePuzzle);
const renderResponse = renderHarness('components/puzzle/PuzzleResponseTask.tsx', 'PuzzleResponseTask', {
  'react-i18next': { useTranslation: () => ({ t, i18n: { language: 'en' } }) },
});
const judgeEditor = nodes(renderResponse(renderTaskView(judgeView.task()).props)).find(node => node.type === 'TrueFalseTask');
assert.equal(judgeEditor.props.hasHostedProof, undefined);
assert.ok(nodes(renderTrueFalse(judgeEditor.props)).some(node => node.props.children === judgePuzzle.response.proposed));
judgeView.task().onResponseChange(!judgePuzzle.response.isCorrect);
judgeView.refresh(); judgeView.check().onPress(); judgeView.refresh();
const submittedJudge = nodes(judgeView.tree()).find(node => node.type === 'ChoiceButton' && node.props.result === 'wrong');
assert.ok(submittedJudge.props.label.includes(judgePuzzle.response.proposed), 'The checked judge alternate retains the submitted proposal');
// A miss must reach the family renderer through Play's real host, with the checked quantity.
{
  const evidence = renderHarness('components/puzzle/CheckedPuzzleReveal.tsx', 'Evidence');
  function miss(puzzle, renderer, submit) {
    const play = screen(puzzle);
    submit(play.task());
    play.refresh();
    assert.equal(play.check().disabled, false);
    play.check().onPress();
    play.refresh();
    const proof = nodes(play.tree()).find(node => node.type === 'CheckedPuzzleReveal') ?? play.task()?.checkedModel;
    assert.equal(proof?.props.mode, 'attempt', puzzle.id);
    const model = evidence(proof.props);
    assert.equal(model.type, renderer, puzzle.id);
    return model.props;
  }
  for (const mode of ['bundle', 'split']) {
    const puzzle = allPuzzles.find(p => p.type === 'place_value' && p.payload.mode === mode && p.response?.kind === 'choose');
    const index = (puzzle.response.correctIndex + 1) % puzzle.response.options.length;
    const [tens, ones] = puzzle.response.options[index].split('+').map(term => parseInt(term.trim(), 10));
    const model = miss(puzzle, 'PlaceValueBuildReveal', task => task.onResponseChange(String(index)));
    assert.deepEqual(json(model.answer.state), { tens, ones, added: false });
  }
  const decimal = allPuzzles.find(p => p.type === 'decimal_place_value' && p.response?.kind === 'judge' && p.response.isCorrect);
  const counts = decimal.response.proposed.split('+').map(term => parseInt(term.trim(), 10));
  assert.deepEqual(json(miss(decimal, 'DecimalReveal', task => task.onResponseChange(false)).submitted),
    { ones: counts[0], tenths: counts[1], hundredths: counts[2] });
  for (const [type, renderer] of [['ratio_table', 'RatioReveal'], ['signed_line', 'NumberLineReveal']]) {
    const puzzle = allPuzzles.find(p => p.type === type && p.response?.kind === 'judge' && p.response.isCorrect);
    assert.equal(miss(puzzle, renderer, task => task.onResponseChange(false)).submitted, Number(puzzle.response.proposed));
  }
  const percentage = allPuzzles.find(p => p.percentageExample && p.response?.kind === 'write' && p.response.answer !== '0');
  assert.equal(miss(percentage, 'PercentageReveal', task => task.onResponseChange('0')).submitted, 0);
  const line = allPuzzles.find(p => p.type === 'number_line' && !p.response && p.payload.correctValue !== p.payload.min);
  assert.equal(miss(line, 'NumberLineReveal', task => task.onSelectNumberLineValue(line.payload.min)).submitted, line.payload.min);
  for (const puzzle of [allPuzzles.find(p => p.type === 'fraction_equivalent'),
    allPuzzles.find(p => p.type === 'multiple_choice' && !p.response && p.fractionExample?.numerator === 2 && p.fractionExample.denominator === 2 && !p.fractionExample.whole)]) {
    const choices = puzzle.payload?.choices ?? puzzle.choices;
    const index = (puzzle.correctIndex + 1) % choices.length;
    const value = choices[index].split('/').map(Number);
    const submitted = puzzle.type === 'fraction_equivalent' ? value[0] * Number(choices[puzzle.correctIndex].split('/')[1]) / value[1] : value[0];
    assert.equal(miss(puzzle, 'FractionReveal', task => task.onSelectChoice(index)).plan.submitted, submitted);
  }
}
const renderStory = renderHarness('components/puzzle/MultipleChoiceTask.tsx', 'MultipleChoiceTask');
{
  const puzzle = allPuzzles.find(p => p.everyday?.model.kind === 'money' && !p.response);
  let choice = 0;
  const props = { puzzle, selectedIndex: choice, onSelect: index => { choice = index; }, onClear: () => { choice = null; }, answered: false, isCorrect: false };
  const diagrams = extra => nodes(renderStory({ ...props, ...extra })).filter(node => node.type === 'EverydayDiagram');
  const input = diagrams({})[0].props.moneyInput;
  input.onSelect(1);
  assert.equal(choice, 1);
  input.onClear();
  assert.equal(choice, null);
  const checked = diagrams({ answered: true, playbackOwnsControls: true, retainPracticeDrawing: true, onSolutionShown() {} });
  assert.ok(checked[0].props.moneyInput, 'The outgoing purse keeps the editable drawing until paint');
  assert.equal(checked[1].props.moneyAttempt.choice, puzzle.choices[0]);
  assert.equal(checked[1].props.moneyInput.selectedIndex, props.selectedIndex);
  assert.deepEqual(checked[1].props.moneyInput.choices, puzzle.choices);
}

const area = allPuzzles.find(p => p.difficulty === 'hard' && p.type === 'multiple_choice' && p.taskVisual?.kind === 'array');
const storyProps = { puzzle: area, selectedIndex: null, answered: false, isCorrect: false, onSelect() {} };
assert.equal(nodes(renderStory(storyProps)).find(node => node.type === 'QuantityTaskScene').props.showExpression, false, 'Hard story pictures do not supply the arithmetic operation');
assert.equal(nodes(renderStory({ ...storyProps, puzzle: { ...area, difficulty: 'easy' } })).find(node => node.type === 'QuantityTaskScene').props.showExpression, true, 'Easy story models keep their equation support');
for (const [mechanic, example] of [['groups-choice', { numerator: 1, denominator: 3, whole: 12 }], ['whole-choice', { numerator: 2, denominator: 2 }]]) {
  const puzzle = { ...area, taskVisual: undefined, fractionExample: example };
  const cue = props => nodes(renderStory({ ...storyProps, puzzle, ...props })).find(n => n.type === 'FractionChoiceHint');
  assert.equal(cue({}).props.mechanic, mechanic);
  assert.equal(cue({ selectedIndex: 0 }).props.interacted, true);
  assert.equal(cue({ answered: true }), undefined);
  assert.equal(cue({ puzzle: { ...puzzle, taskVisual: { kind: 'share', items: 12, groups: 3 } } }), undefined);
}
for (const difficulty of ['easy', 'medium']) {
  const clock = allPuzzles.find(p => p.difficulty === difficulty && p.everyday?.model.kind === 'clock' && p.everyday.model.task === 'elapsed' && !p.response);
  assert.ok(clock, `Missing ${difficulty} elapsed clock`);
  const clockScreen = screen(clock);
  const opening = nodes(clockScreen.tree());
  const helpButton = node => node.props.testID === 'puzzle-picture-help';
  assert.equal(opening.filter(helpButton).length, 1);
  assert.ok(nodes(opening.find(helpButton)).some(node => node.props.children === '?'));
  assert.equal(opening.find(helpButton).props.accessibilityLabel, clockScreen.tr('visualHelp.a11yOpen'));
  assert.ok(!nodes(opening.find(node => node.type === 'ScrollView')).some(helpButton), 'Clock help stays beside Check, outside the scrolling model');
  const index = (clock.correctIndex + 1) % clock.choices.length;
  const props = { ...storyProps, puzzle: clock, selectedIndex: index };
  const elapsedUnit = difficulty === 'easy' ? 'hours' : 'minutes';
  const diagrams = state => nodes(renderStory({ ...props, ...state })).filter(node => node.type === 'EverydayDiagram').map(node => node.props);
  const [editing] = diagrams({});
  assert.equal(editing.clockInput.onSelect, props.onSelect);
  assert.deepEqual([...editing.clockInput.choices], clock.choices);
  assert.equal(editing.clockInput.selectedIndex, index);
  assert.equal(editing.clockInput.elapsedUnit, elapsedUnit);
  assert.equal(editing.clockAttempt, undefined);
  assert.equal(diagrams({ answered: true })[0].clockInput, undefined);
  assert.equal(diagrams({ playbackOwnsControls: true })[0].clockInput, undefined);
  const [retained, attempted] = diagrams({ answered: true, incorrectAttempt: true, playbackOwnsControls: true, retainPracticeDrawing: true, onSolutionShown() {} });
  assert.equal(retained.clockInput, undefined);
  assert.equal(retained.clockAttempt, undefined);
  assert.equal(attempted.clockInput, undefined);
  assert.equal(attempted.clockAttempt.choice, clock.choices[index]);
  assert.equal(attempted.clockAttempt.elapsedUnit, elapsedUnit);
  const [worked] = diagrams({ answered: true, isCorrect: true, playbackOwnsControls: true, onSolutionShown() {} });
  assert.equal(worked.clockInput, undefined);
  assert.equal(worked.clockAttempt, undefined);
  assert.equal(worked.elapsedUnit, elapsedUnit);
  const displayedClock = clockScreen.task().puzzle;
  const wrongIndex = (displayedClock.correctIndex + 1) % displayedClock.choices.length;
  clockScreen.task().onSelectChoice(wrongIndex);
  clockScreen.refresh(); clockScreen.check().onPress(); clockScreen.refresh();
  const checkedTask = clockScreen.task();
  const proof = nodes(renderStory(renderTaskView(checkedTask).props)).find(n => n.type === 'EverydayDiagram').props;
  assert.equal(typeof checkedTask.onSolutionShown, 'function');
  assert.equal(proof.onSolutionShown, checkedTask.onSolutionShown);
  assert.equal(proof.clockAttempt.choice, displayedClock.choices[wrongIndex]);
  assert.equal(proof.clockAttempt.elapsedUnit, elapsedUnit);
  assert.ok(nodes(clockScreen.tree()).some(n => n.type?.name === 'CheckedDrawingTransition' && n.props.preparing));
}
// A phase change must preserve the XL prompt slot that anchors the fraction drawing.
for (const id of ['v2-easy-fractions-explore-6-2', 'v2-medium-fractions-explore-6-4',
  'v2-easy-fractions-lesson-1-boss-2', 'v2-hard-fractions-explore-10-1']) {
  const puzzle = allPuzzles.find(p => p.id === id);
  const play = screen(puzzle, { fontScale: 2.64 });
  const assertPrompt = () => {
    const tree = nodes(play.tree());
    const slot = tree.find(n => n.props.testID === 'play-full-question');
    assert.ok(nodes(slot).some(n => (n.props.text ?? n.props.children) === puzzle.question), id);
    const header = tree.find(n => n.props.testID === 'puzzle-question');
    assert.equal(header.props.accessibilityLabel, puzzle.question);
    if (puzzle.fractionExample) {
      assert.ok(nodes(header).some(n => n.props.testID === 'play-question-cat' && n.props.accessibilityElementsHidden));
    }
  };
  assertPrompt();
  if (puzzle.type === 'fraction_equivalent') {
    assert.ok(!play.text().includes(play.tr('play.mechanicIntro.fraction_equivalent')));
  }
  if (puzzle.type === 'fraction_number_line') {
    play.task().onSelectNumberLineValue(puzzleQADraft(puzzle, 'correct').draft.numberLine);
    play.refresh();
    play.check().onPress();
    play.refresh();
    assert.equal(play.proof().mode, 'worked');
    assertPrompt();
  }
}
for (const id of ['v2-easy-addition-ten-2', 'v2-easy-subtraction-take-3']) {
  const puzzle = allPuzzles.find(p => p.id === id);
  const view = screen(puzzle, { fontScale: 2.64 });
  const question = nodes(view.tree()).filter(node => node.props.testID === 'puzzle-question');
  assert.equal(question.length, 1);
  assert.equal(question[0].props.accessibilityRole, 'button');
  assert.equal(question[0].props.accessibilityLabel, puzzle.question);
  assert.ok(!nodes(nodes(view.tree()).find(node => node.type === 'ScrollView')).includes(question[0]));
}
{
  const picnic = allPuzzles.find(p => p.id === 'v2-easy-cat-plans-picnic-8');
  const play = screen(picnic, { fontScale: 2.64 });
  for (const locale of ['en', 'lv', 'ru']) {
    const localPlay = screen(picnic, { locale, fontScale: 2.64 });
    const { tr } = localPlay;
    assert.equal(localPlay.check().label, tr('play.shortCheck'));
    assert.equal(localPlay.check().accessibilityLabel, tr('play.checkAnswer'));
    const render = renderHarness('components/puzzle/PuzzleResponseTask.tsx', 'PuzzleResponseTask', {
      'react-i18next': { useTranslation: () => ({ t: tr, i18n: { language: locale } }) },
    }, 2.64);
    const editor = () => nodes(render(renderTaskView(localPlay.task()).props));
    const labels = ['trueLabel', 'falseLabel'].map(key => tr(`puzzleTypes.${key}`).replace(/\s*[✓✔✗✘]\s*$/u, ''));
    const buttons = editor().filter(n => n.type === 'Pressable' && labels.includes(n.props.accessibilityLabel));
    assert.deepEqual(buttons.map(n => n.props.accessibilityLabel), labels);
    assert.deepEqual(buttons.map(n => n.props.children.props.children), ['✓', '×']);
    assert.equal(editor().find(n => n.type === 'TrueFalseTask').props.puzzle.payload.statement, picnic.response.proposed);
    buttons[1].props.onPress();
    localPlay.refresh();
    assert.equal(localPlay.task().responseValue, false);
    assert.equal(localPlay.check().disabled, false);
  }
  const element = id => nodes(play.tree()).find(n => n.props.testID === id).props;
  const layout = y => ({ nativeEvent: { layout: { y, width: 348, height: 240 } } });
  element('play-full-question').onLayout(layout(0));
  element('play-proof-area').onLayout(layout(280));
  play.refresh();
  const scroll = element('play-model-scroll');
  assert.equal(scroll.ref.current.scrollCalls.at(-1).y, 280, 'The XL clock judge focuses the dial after the entire card');
  scroll.onScrollBeginDrag();
  element('play-proof-area').onLayout(layout(305));
  play.refresh();
  assert.equal(scroll.ref.current.scrollCalls.at(-1).y, 280, 'Manual scrolling keeps control after a later layout');
}
for (const correct of [false, true]) {
  const clock = allPuzzles.find(p => p.everyday?.model.kind === 'clock' && p.everyday.model.task === 'finish' && !p.response && p.choices.includes('05:00'));
  const play = screen(clock, { fontScale: 2.64 });
  const displayed = play.task().puzzle;
  const buttons = nodes(renderStory(renderTaskView(play.task()).props)).filter(n => n.type === 'ChoiceButton');
  const five = buttons[displayed.choices.indexOf('05:00')];
  assert.equal(five.props.label, '5:00');
  assert.equal(five.props.accessibilityAnswer ?? five.props.label, '5:00');
  buttons[correct ? displayed.correctIndex : (displayed.correctIndex + 1) % displayed.choices.length].props.onPress();
  play.refresh();
  const element = id => nodes(play.tree()).find(n => n.props.testID === id).props;
  const promptHeight = 240;
  element('play-full-question').onLayout({ nativeEvent: { layout: { y: 0, height: promptHeight } } });
  play.refresh();
  const scroll = element('play-model-scroll');
  scroll.onScrollBeginDrag();
  const calls = scroll.ref.current.scrollCalls.length;
  play.check().onPress();
  assert.equal(scroll.ref.current.scrollCalls.length, calls + 1, 'Check positions the clock before the checked render');
  const offset = scroll.ref.current.scrollCalls.at(-1).y;
  if (correct) assert.ok(offset >= promptHeight);
  else assert.equal(offset, 0, 'A miss restores the full question above the clock');
  play.refresh();
  assert.equal(element('play-full-question').children.type, 'StoryHost', 'The checked clock keeps the measured prompt layout');
}

// Large checked boards share a scroll with their controls when the countable model needs the stage.
for (const id of ['v2-medium-fractions-explore-9-4', 'v2-easy-fractions-lesson-7-challenge-1']) {
  const puzzle = allPuzzles.find(p => p.id === id);
  for (const fontScale of [1, 2.64]) {
    const play = screen(puzzle, { fontScale });
    const dockInScroll = () => nodes(nodes(play.tree()).find(n => n.props.testID === 'play-model-scroll'))
      .some(n => n.props.testID === 'play-answer-dock');
    assert.equal(dockInScroll(), false);
    const { draft } = puzzleQADraft(puzzle, 'correct');
    if (puzzle.type === 'decimal_grid') play.task().onDecimalGridChange(draft.decimalGrid);
    else play.task().onChallengeAnswerChange(draft.challenge);
    play.refresh();
    assert.equal(play.check().disabled, false);
    play.check().onPress();
    play.refresh();
    assert.equal(dockInScroll(), fontScale >= 2);
    assert.equal(nodes(play.tree()).filter(n => n.props.testID === 'play-answer-dock').length, 1);
    seeResult(play);
    assert.equal(play.result().correct, true);
  }
}
{
  const capacityPuzzles = allPuzzles.filter(p => p.everyday?.model.kind === 'capacity');
  const native = new Map(capacityPuzzles.filter(p => !p.response).map(p => [p.everyday.model.task, p]));
  assert.equal(native.size, 6);
  const bowls = capacityPuzzles.find(p => !p.response && p.everyday.model.task === 'servings' && p.everyday.model.portionContainer === 'bowl');
  assert.ok(bowls);
  for (const puzzle of new Set([...native.values(), bowls])) {
    const play = screen(puzzle, { fontScale: 2.64 });
    const opening = nodes(play.tree());
    assert.ok(opening.some(n => n.props.testID === 'puzzle-question' && n.props.accessibilityLabel === puzzle.question));
    const question = opening.find(n => n.props.testID === 'puzzle-question');
    const prompt = opening.find(n => n.props.testID === 'play-full-question');
    assert.ok(nodes(prompt).some(n => n.props.children === puzzle.question));
    const nav = opening.find(n => n.props.testID === 'play-navigation');
    assert.ok(!nodes(nav).some(n => n === question || n.props.testID === 'puzzle-picture-help'));
    assert.equal(typeof question.props.onPress, 'function');
    const help = opening.find(n => n.props.testID === 'puzzle-picture-help');
    assert.ok(nodes(help).some(n => n.props.children === '?' && n.props.allowFontScaling === false));
    const helpStyle = Object.assign({}, ...[help.props.style].flat());
    assert.equal(helpStyle.width, 48);
    assert.equal(helpStyle.height, 48);
    const diagram = () => nodes(renderStory(renderTaskView(play.task()).props)).find(n => n.type === 'EverydayDiagram').props;
    const index = puzzleQADraft(puzzle, 'wrong').answer.index;
    const input = diagram().capacityInput;
    assert.deepEqual([...input.choices], puzzle.choices);
    input.onSelect(index); play.refresh(); assert.equal(diagram().capacityInput.selectedIndex, index);
    play.check().onPress(); play.refresh();
    assert.ok(!nodes(play.tree()).some(n => n.props.testID === 'puzzle-picture-help'));
    assert.equal(diagram().capacityInput, undefined);
    assert.equal(diagram().capacityAttempt.choice, puzzle.choices[index]);
    assert.equal(typeof diagram().onSolutionShown, 'function');
    assert.ok(nodes(play.tree()).some(n => n.type?.name === 'CheckedDrawingTransition' && n.props.preparing));
    assert.ok(nodes(play.tree()).some(n => n.props.testID === 'play-submitted-response'));
    assert.ok(!play.text().includes(en.play.adjustAnswer));
  }
  const alternate = renderHarness('components/puzzle/PuzzleResponseTask.tsx', 'PuzzleResponseModel');
  const written = capacityPuzzles.find(p => p.response?.kind === 'write');
  const judged = capacityPuzzles.find(p => p.response?.kind === 'judge' && !p.response.isCorrect);
  const attempt = (puzzle, value, solved = false) => nodes(alternate({ puzzle, value, checked: true, solved, onSolutionShown() {} }))
    .find(n => n.type === 'EverydayDiagram').props.capacityAttempt;
  assert.deepEqual(json(attempt(written, '2,5')), { choice: '2,5' });
  assert.deepEqual(json(attempt(written, '')), {});
  assert.deepEqual(json(attempt(judged, true)), { choice: judged.response.proposed });
  assert.deepEqual(json(attempt(judged, false)), {});
  assert.deepEqual(json(attempt({ ...judged, response: { ...judged.response, proposed: 'unknown' } }, true)), {});
  assert.equal(attempt(written, written.response.answer, true), undefined);
}
const hardOperations = screen(allPuzzles.find(p => p.id === 'v2-hard-operations-connected-2'));
const compareEntry = screen(allPuzzles.find(p => p.type === 'compare' && !p.response));
assert.ok(!compareEntry.text().includes(en.play.mechanicIntro.compare), 'The compare trays supply the answer controls');
{
  const sequence = allPuzzles.find(p => p.id === 'v2-easy-patterns-jumps-3');
  const entry = nodes(screen(sequence, { fontScale: 2.64 }).tree());
  const heading = entry.find(n => n.props.testID === 'play-full-question');
  assert.equal(heading.props.children.props.children, 'Which number belongs in the gap?');
  assert.equal(entry.find(n => n.props.testID === 'puzzle-question').props.accessibilityLabel, sequence.question);
}
assert.ok(!hardOperations.text().includes(en.play.mechanicIntro.target_buildHard), 'The target builder supplies its own first-encounter cue');
assert.ok(!/multiplication and division come first|multiply and divide before/i.test(hardOperations.text()), 'The live Hard screen must not teach the operation order before a choice');
console.log(`Puzzle experience checks passed across ${allPuzzles.length} authored puzzles: readiness, correction, hints, progress, matching, completion, tap-to-insert and Hard answer visibility.`);

// A measured model starts its paint animation once, even across later layout changes.
for (const reduced of [false, true]) {
  const writes = [];
  const scale = { set: value => writes.push(value), get: () => 1 };
  const entry = renderHarness('components/puzzle/kit/PracticeAffordances.tsx', 'EntryBuild', {
    '@expo/vector-icons/MaterialCommunityIcons': 'Icon',
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, useReducedMotion: () => reduced,
      useSharedValue: () => scale, useAnimatedStyle: fn => fn(), withTiming: n => n,
      withSequence: (...frames) => frames, withDelay: (delay, frames) => ({ delay, frames }), cancelAnimation() {} },
  });
  entry({ ready: false, index: 2 });
  assert.ok(writes.every(value => value === 1));
  entry({ ready: true, index: 2 });
  entry({ ready: false, index: 3 });
  entry({ index: 1 });
  const animations = writes.filter(value => typeof value === 'object');
  assert.equal(animations.length, reduced ? 0 : 1);
  if (!reduced) assert.deepEqual(animations[0], { delay: 70, frames: [1.04, 1] });
  else assert.ok(writes.length && writes.every(value => value === 1));
}
const renderPuzzleCard = renderHarness('components/puzzle/PuzzleCard.tsx', 'PuzzleCard');
const renderStoryQuestion = renderHarness('components/puzzle/PuzzleCard.tsx', 'StoryQuestion');
function puzzleCardNodes(props) {
  return nodes(renderPuzzleCard(props)).flatMap(node =>
    node.type?.name === 'StoryQuestion' ? nodes(renderStoryQuestion(node.props)) : [node]);
}
for (const puzzle of [allPuzzles.find(p => p.everyday?.model.kind === 'money' && !p.response), allPuzzles.find(p => p.type === 'budget_plan')]) {
  const heading = checked => puzzleCardNodes({ puzzle, checked }).find(node => node.type === 'StoryHost');
  assert.ok(heading(false));
  assert.equal(heading(true)?.props.text, heading(false).props.text, 'Shopping keeps the same cat and full heading after Check');
  for (const fontScale of [1, 2.64]) {
    const view = screen(puzzle, { fontScale, proofAudit: { record() {} } });
    if (fontScale >= 2) {
      const entry = nodes(view.tree());
      const question = entry.find(node => node.props.testID === 'puzzle-question');
      assert.ok(question.props.accessibilityLabel && typeof question.props.onPress === 'function');
      assert.ok(nodes(question).some(node => node.props.testID === 'play-question-cat'));
      assert.ok(entry.some(node => node.props.testID === 'play-full-question'), 'The complete XL question shares the shelf scroll');
    }
    if (puzzle.type === 'budget_plan') view.task().onChallengeAnswerChange({ kind: 'budget', indices: [0] });
    else view.task().onSelectChoice(puzzle.correctIndex);
    view.refresh(); view.check().onPress(); view.refresh();
    const tree = nodes(view.tree());
    const host = tree.find(node => node.props.value?.onInitialModelPainted).props.value;
    const hasDockedCaption = () => nodes(view.tree()).some(node => node.props.nativeID === 'play-proof-caption');
    assert.equal(hasDockedCaption(), false, 'The retained shop has no incoming caption');
    host.onInitialModelPainted(0); view.refresh();
    assert.equal(hasDockedCaption(), true, 'The proof can show its current caption as soon as the retained shop exits');
  }
}
for (const task of ['read', 'elapsed', 'start', 'finish']) {
  const puzzle = allPuzzles.find(p => p.everyday?.model.kind === 'clock' && p.everyday.model.task === task && !p.response);
  const story = task === 'start' || task === 'finish';
  const storyHost = node => node.type === 'StoryHost';
  assert.equal(puzzleCardNodes({ puzzle }).some(storyHost), story);
  const xl = nodes(screen(puzzle, { fontScale: 2.64 }).tree());
  assert.equal(xl.some(storyHost), story);
  const questionButton = xl.find(n => n.props.testID === 'puzzle-question');
  assert.equal(nodes(questionButton).some(n => n.type === 'DiagramIcon' && n.props.name === 'cat'), story);
  assert.equal(questionButton.props.accessibilityLabel, puzzle.question);
  assert.equal(puzzleCardNodes({ puzzle, checked: true }).some(storyHost), false);
  const cue = props => nodes(renderStory({ ...storyProps, puzzle, ...props })).find(n => n.type === 'ClockResponseHint');
  assert.equal(!!cue({}), task === 'read');
  if (task === 'read') assert.equal(cue({ selectedIndex: 0 }).props.interacted, true);
  assert.equal(cue({ answered: true }), undefined);
}
for (const kind of ['judge', 'write']) {
  const puzzle = allPuzzles.find(p => p.everyday?.model.kind === 'clock' && p.response?.kind === kind);
  const play = screen(puzzle);
  const cue = () => {
    const tree = kind === 'judge' ? play.tree() : renderResponse(renderTaskView(play.task()).props);
    return nodes(tree).find(n => n.type === 'ClockResponseHint' && n.props.kind === kind);
  };
  assert.equal(cue().props.interacted, false);
  play.task().onResponseChange(kind === 'judge' ? false : '0');
  play.refresh();
  assert.equal(cue().props.interacted, true);
  if (kind === 'write') {
    play.task().onResponseChange(puzzle.response.answer);
    play.refresh();
  }
  assert.equal(play.check().disabled, false);
  play.check().onPress();
  play.refresh();
  assert.equal(cue(), undefined);
}
for (const puzzle of allPuzzles.filter(p => p.type === 'fraction_build' && !p.payload.hideTarget)) {
  const heading = puzzleCardNodes({ puzzle }).find(node => node.props.testID === 'puzzle-question');
  const givens = String(heading?.props.children).match(/\d+/g) ?? [];
  for (const value of [puzzle.payload.numerator, puzzle.payload.denominator]) {
    assert.ok(givens.includes(String(value)), `${puzzle.id}: the copying prompt must give both the number of parts to shade and the whole`);
  }
}
for (const puzzle of allPuzzles.filter(p => p.type === 'budget_plan')) {
  const heading = puzzleCardNodes({ puzzle }).find(node => node.type === 'StoryHost').props.text;
  for (const number of [puzzle.payload.budget, puzzle.payload.pickCount, puzzle.payload.remaining]) {
    assert.ok(heading.includes(String(number)), `${puzzle.id}: the budget, item count and required remainder stay visible`);
  }
}

// Child-owned challenge drafts report readiness without resetting their local work.
let challengeDraft = null;
const controls = { answered: false, onAnswerChange: answer => { challengeDraft = answer; }, onDragStateChange() {} };
const renderSort = renderHarness('components/puzzle/SortBucketsTask.tsx', 'SortBucketsTask');
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
challengeDraft = null;
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

const renderBudget = renderHarness('components/puzzle/BudgetPlanTask.tsx', 'BudgetPlanTask');
const budgetProps = { ...controls, puzzle: { type: 'budget_plan', payload: { budget: 10, remaining: 2, pickCount: 2,
  items: [{ label: 'A', price: 4, discountPercent: 0 }, { label: 'B', price: 8, discountPercent: 50 }, { label: 'C', price: 6, discountPercent: 0 }] } } };
challengeTree = renderBudget(budgetProps); assert.equal(challengeDraft, null);
const items = () => nodes(challengeTree).filter(node => node.type === 'PuzzleDragTile')
  .sort((a, b) => Number(a.props.id) - Number(b.props.id));
items()[0].props.onPress(); challengeTree = renderBudget(budgetProps); assert.equal(challengeDraft, null);
items()[2].props.onPress(); challengeTree = renderBudget(budgetProps); assert.equal(checkPuzzleAnswer(budgetProps.puzzle, challengeDraft), false);
items()[2].props.onPress(); challengeTree = renderBudget(budgetProps); assert.equal(challengeDraft, null);
items()[1].props.onPress(); challengeTree = renderBudget(budgetProps); assert.equal(checkPuzzleAnswer(budgetProps.puzzle, challengeDraft), true);
assert.equal(getPuzzleAttemptHint(budgetProps.puzzle, { kind: 'budget', indices: [0, 2] }).key, 'budgetTooMuch');
console.log('All four challenge types preserve local work, update the shared action, disable incomplete drafts and grade corrections.');

const threeLives=screen({...base,type:'multiple_choice',choices:['4','5','6'],correctIndex:0});
for(const [index,left] of [[1,2],[2,1],[1,0]]) {
  threeLives.task().onSelectChoice(index);threeLives.refresh();
  const submit=threeLives.check().onPress;submit();submit();threeLives.refresh();
  assert.equal(threeLives.game.progress.lives.current,left,'A submitted mistake uses exactly one life');
  assert.equal(getPuzzleCoinReward(base.difficulty),4,'Coin values stay fixed');
  if (left) retry(threeLives);
}
assert.equal(threeLives.attempts.length,3);
assert.ok(threeLives.text().includes(en.lives.outOfLives));
assert.equal(threeLives.task().answered, true);
assert.equal(threeLives.primary().label,en.lives.refillToRetry);
assert.equal(threeLives.primary().disabled,false);
threeLives.primary().onPress();threeLives.refresh();
assert.ok(nodes(threeLives.tree()).some(n=>n.type==='BuyLifeSheet'),'The empty-life primary action opens refill');
assert.equal(threeLives.attempts.length,3,'Refill never submits an answer');
assert.equal(threeLives.result(),undefined,'No success sheet can appear at zero lives');
const workedExample=nodes(threeLives.tree()).find(n=>n.type==='Pressable'&&nodes(n).some(child=>child.props.children===en.lives.workedExample));
assert.ok(workedExample,'Help remains available without lives');workedExample.props.onPress();threeLives.refresh();
assert.ok(nodes(threeLives.tree()).some(n=>n.type==='VisualHelpSheet'));
assert.equal(threeLives.game.progress.lives.current,0,'Opening help costs no life');
assert.ok(threeLives.game.progress.learningSupportIds.includes(base.id),'Picture help records support for the source puzzle');
assert.equal(threeLives.game.progress.lives.current,0);

const reopenedNoLives=screen({...base,type:'multiple_choice',choices:['4','5'],correctIndex:0},{lifeCount:0});
reopenedNoLives.task().onSelectChoice(0);reopenedNoLives.refresh();
assert.equal(reopenedNoLives.primary().label,en.lives.refillToRetry,'Reopening offers refill without bypassing the life gate');
reopenedNoLives.primary().onPress();reopenedNoLives.refresh();
const refill = nodes(reopenedNoLives.tree()).find(n=>n.type==='BuyLifeSheet');
assert.ok(refill); await refill.props.onBuyLife();reopenedNoLives.refresh();
assert.equal(reopenedNoLives.task().selectedIndex,0,'Refill preserves the draft');
assert.equal(reopenedNoLives.check().disabled,false,'A refilled life restores checking');
reopenedNoLives.check().onPress();reopenedNoLives.refresh();seeResult(reopenedNoLives);
assert.equal(reopenedNoLives.result().correct,true);
const pathExit=nodes(threeLives.tree()).find(n=>n.type==='Pressable'&&nodes(n).some(child=>child.props.children===en.play.backToPath));
assert.ok(pathExit,'An empty-life puzzle offers a path exit');pathExit.props.onPress();
assert.equal(threeLives.routes.at(-1)[1].pathname,'/puzzles');
const staleLife=screen({...base,type:'multiple_choice',choices:['4','5'],correctIndex:0});
staleLife.task().onSelectChoice(0);staleLife.refresh();
const staleCheck=staleLife.check().onPress;staleLife.game.progress.lives.current=0;
staleCheck();staleLife.refresh();
assert.equal(staleLife.result(),undefined,'A rejected atomic submission cannot display success');
const mismatchLife=screen({...base,type:'fraction_match',payload:{pairs:[{numerator:1,denominator:4,visual:'pie'},{numerator:2,denominator:4,visual:'grid'}]}});
toggleWedge(mismatchLife, 1, 0);
for (let i = 0; i < 3; i++) {
  toggleWedge(mismatchLife, 0, i);
  const submit = mismatchLife.check().onPress;
  submit(); submit(); mismatchLife.refresh();
  assert.equal(mismatchLife.game.progress.lives.current, 2 - i, 'One life per checked mismatch');
  if (i < 2) retry(mismatchLife);
}
assert.equal(mismatchLife.primary().accessibilityLabel, en.lives.refillToRetry);
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

const { decimalRevealModel, decimalFillAt, decimalEquation } = loadPure('@/utils/decimal-reveal');
const { decimalTotal, checkDecimalPlace } = loadPure('@/utils/decimal-models');
for (const p of allPuzzles.filter(p => p.type === 'decimal_grid' || p.type === 'decimal_place_value')) {
  const model = decimalRevealModel(p);
  assert.equal(decimalFillAt(model.steps, -.01), 0);
  assert.equal(decimalFillAt(model.steps, model.steps.length), p.payload.hundredths);
  assert.equal(model.plates, Math.max(1, Math.ceil(p.payload.hundredths / 100)));
  for (let i = 1; i < model.steps.length; i++) {
    // Beats move wholes, one or two tenths, then the leftover hundredths in small groups (≤ 4) at the end.
    const delta = model.steps[i] - model.steps[i - 1];
    assert.ok([10, 20, 100].includes(delta) || delta > 0 && delta <= 4 && model.steps.slice(i).every((n, k, a) => k === 0 || n - a[k - 1] <= 4), p.id);
    // Fill is continuous between beats (driven by the shared reveal clock) and exact on each beat.
    assert.equal(decimalFillAt(model.steps, i), model.steps[i], p.id);
    const mid = decimalFillAt(model.steps, i - .5);
    assert.ok(mid > model.steps[i - 1] && mid < model.steps[i], p.id);
  }
  if (model.exchange) {
    assert.equal(decimalTotal(model.exchange.before), p.payload.hundredths, p.id);
    assert.equal(decimalTotal(model.exchange.after), p.payload.hundredths, p.id);
    assert.ok(checkDecimalPlace(p, model.exchange.after), p.id);
    assert.notEqual(decimalEquation(model, model.total, false, 'en'), decimalEquation(model, model.total, true, 'en'));
  }
}
const trailingZero = decimalRevealModel({ type: 'decimal_grid', payload: { hundredths: 80, scale: 100, digits: 1 } });
assert.equal(decimalEquation(trailingZero, 80, true, 'lv'), '80/100 = 0,80 = 0,8');
assert.equal(decimalEquation(trailingZero, 6, false, 'en'), '6/100 = 0.06');

// Decimal drafts use the production screen's Check, life costs and result flow.
for (const kind of ['decimal_grid','decimal_place_value']) {
  const puzzle=allPuzzles.find(p=>p.type===kind && !p.response && (kind==='decimal_grid'||p.payload.mode==='build'));
  const state=screen(puzzle), grid=kind==='decimal_grid';
  const update=value=>{state.task()[grid?'onDecimalGridChange':'onDecimalPlaceChange'](value);state.refresh();};
  assert.equal(state.check().disabled,true);
  const wrong=grid?0:{ones:0,tenths:0,hundredths:0};
  update(wrong);state.check().onPress();state.refresh();
  assert.equal(state.attempts.length,1);assert.equal(state.attempts[0].correct,false);
  assert.equal(state.game.progress.lives.current,2);retry(state);assert.equal(state.check().disabled,true);
  assert.deepEqual(json(state.task()[grid?'decimalGrid':'decimalPlace']),wrong);
  update(null);assert.equal(state.check().disabled,true,'Reset clears readiness without spending a life');
  const n=puzzle.payload.hundredths;
  update(grid?n*puzzle.payload.scale/100:{ones:Math.floor(n/100),tenths:Math.floor(n%100/10),hundredths:n%10});
  const submit=state.check().onPress;submit();submit();state.refresh();
  assert.equal(state.attempts.length,2);assert.equal(state.attempts[1].correct,true);
  assert.equal(state.result(), undefined);
  assert.equal(state.primary().label, en.play.seeResult);
  state.primary().onPress();state.refresh();
  assert.equal(state.result().coinsEarned,getPuzzleCoinReward(puzzle.difficulty));assert.equal(state.task(), undefined);
}
const gesture = new Proxy({}, { get: () => () => gesture });
const decimalRender=renderHarness('components/puzzle/DecimalGridTask.tsx','DecimalGridTask',{
  './counting/QuantityPractice': { useFirstQuantityEncounter: () => false },
  'react-native-reanimated': { useSharedValue: initial => ({ get: () => initial, set() {} }) },
  'react-native-gesture-handler': { GestureDetector: 'GestureDetector', Gesture: { Pan: () => gesture } },
  'react-i18next':{useTranslation:()=>({t,i18n:{language:'lv'}})},
});
const decimalPuzzle=allPuzzles.find(p=>p.type==='decimal_grid'&&p.payload.scale===100&&p.payload.digits===1);
const decimalTree=decimalRender({puzzle:decimalPuzzle,value:81,onChange(){},answered:false});
const shadedReadout = nodes(decimalTree).find(node => node.props.testID === 'decimal-grid-value');
assert.equal(shadedReadout, undefined, 'The editable grid has no duplicate answer chip');
const gridInput = nodes(decimalTree).find(node => node.props.testID === 'decimal-grid');
assert.equal(gridInput.props.accessibilityValue.now, 81, 'VoiceOver retains the exact editable count');
console.log('Decimal screen checks passed: correction, one-life costs, resets, duplicate submission, rewards and localized precision.');

for (const mode of ['area','perimeter','compare','missing_area','missing_perimeter']) {
  // Exercise each original board control separately from alternate response formats.
  const puzzle={...allPuzzles.find(p=>p.type==='geometry_measure'&&p.payload.mode===mode),response:undefined};
  const target=loadPure('@/utils/geometry-models').geometryTarget(puzzle), state=screen(puzzle);
  assert.equal(state.check().disabled,true);
  state.task().onGeometryChange(0);state.refresh();state.check().onPress();state.refresh();
  assert.equal(state.game.progress.lives.current,2);assert.equal(state.attempts[0].correct,false);
  retry(state);assert.equal(state.task().geometry,0);assert.equal(state.check().disabled,true,'Same wrong answer cannot spend another life');
  state.task().onGeometryChange(null);state.refresh();assert.equal(state.check().disabled,true);
  state.task().onGeometryChange(target);state.refresh();const submit=state.check().onPress;submit();submit();state.refresh();
  assert.equal(state.result(), undefined);
  assert.equal(state.primary().label, en.play.seeResult);
  state.primary().onPress(); state.refresh();
  assert.equal(state.attempts.length,2);assert.equal(state.result().correct,true);
  assert.equal(state.result().coinsEarned,getPuzzleCoinReward(puzzle.difficulty));
}
// Checked Play must be able to name each submitted draft, including a retryable miss.
{
  const { submittedLabel } = loadPure('@/utils/submitted-response');
  for (const locale of ['en', 'lv', 'ru']) {
    const strings = JSON.parse(fs.readFileSync(`locales/${locale}.json`));
    const language = createInstance();
    await language.init({ lng: locale, resources: { [locale]: { translation: strings } }, interpolation: { escapeValue: false } });
    const translate = language.getFixedT(locale);
    for (const level of ['easy', 'medium', 'hard']) {
      for (const puzzle of readPuzzles(locale, level)) {
        for (const outcome of ['correct', 'wrong']) {
          const attempt = puzzleQADraft(puzzle, outcome);
          if (!attempt) continue; // Match boards check each pair immediately.
          const label = submittedLabel({ puzzle, answer: attempt.answer }, translate, locale);
          assert.ok(typeof label === 'string' && label.trim(), `${locale}/${puzzle.id}/${outcome}: empty submission`);
          assert.doesNotMatch(label, /undefined|NaN|\{\{|(?:geometryModels|placeValue|decimalModels|jugSolution)\./, `${locale}/${puzzle.id}: ${label}`);
          if (puzzle.everyday?.model.kind === 'grid' && (attempt.answer.kind === 'choice' || puzzle.response?.kind === 'choose')) {
            const native = attempt.answer.kind === 'choice';
            const index = native ? attempt.answer.index : Number(attempt.answer.value);
            const cell = (native ? puzzle.choices : puzzle.response.options)[index];
            assert.equal(label, `${String.fromCharCode(65 + index)} · ${translate('everyday.gridSquare', { number: cell })}`);
          }
          if (puzzle.response?.kind === 'judge') {
            const expected = translate(attempt.answer.value ? 'puzzleTypes.trueLabel' : 'puzzleTypes.falseLabel').replace(/\s*[✓✔✗✘]\s*$/u, '');
            assert.ok(label === expected || label.endsWith(` · ${expected}`), `${locale}/${puzzle.id}: the mark belongs to the child's verdict`);
            if (puzzle.type === 'coordinate_map') assert.ok(label.startsWith(puzzle.response.proposed + ' · '));
          }
        }
      }
    }
    const { compactPlaceValue, placeValueWords } = loadPure('@/utils/place-value-words');
    const decimal = locale === 'en' ? '.' : ',';
    const terms = ['2 × 10 + 11 × 1', '3 × 10 + 1 × 1', '0 × 1 + 4 × 0.1 + 6 × 0.01'];
    const symbols = ['2×10 + 11', '3×10 + 1', `4×0${decimal}1 + 6×0${decimal}01`];
    for (const [index, term] of terms.entries()) {
      const puzzle = { type: 'place_value', response: { kind: 'choose', options: terms } };
      const attempt = { puzzle, answer: { kind: 'response', value: String(index) } };
      assert.equal(compactPlaceValue(term, locale), symbols[index]);
      assert.equal(submittedLabel(attempt, translate, locale, true), symbols[index]);
      assert.equal(submittedLabel(attempt, translate, locale), placeValueWords(term, translate, locale));
    }
    const money = { type: 'multiple_choice', choices: ['13', '9'], everyday: { model: { kind: 'money', task: 'change', unit: 'euros' } } };
    for (const [index, amount] of ['13', '9'].entries()) {
      assert.equal(submittedLabel({ puzzle: money, answer: { kind: 'choice', index } }, translate, locale), `€${amount}${locale === 'en' ? '.' : ','}00`);
    }
  }
}
// An attempted comparison names the selected rectangle (or equality) in the child's language.
{
  const puzzle = allPuzzles.find(p => p.type === 'geometry_measure' && p.payload.mode === 'compare');
  for (const locale of ['en', 'lv', 'ru']) {
    const strings = JSON.parse(fs.readFileSync(`locales/${locale}.json`));
    const caption = renderHarness('components/puzzle/CheckedPuzzleReveal.tsx', 'AnswerCaption', {
      'react-i18next': { useTranslation: () => ({ t: (key, args) => key === 'geometryModels.equal'
        ? strings.geometryModels.equal : strings.play.answerLabel.replace('{{answer}}', args.answer) }) },
      './kit/useRevealBeats': { useRevealBeats: () => ({ landed: 1 }) },
    });
    for (const [value, label] of ['A', 'B', strings.geometryModels.equal].entries()) {
      const tree = caption({ snapshot: { puzzle, answer: { kind: 'geometry', value }, correct: false }, mode: 'attempt' });
      assert.equal(nodes(tree).find(n => n.type === 'ProofCaption').props.text, strings.play.answerLabel.replace('{{answer}}', label));
    }
  }
}
const renderGeometry=renderHarness('components/puzzle/GeometryMeasureTask.tsx','GeometryMeasureTask');
for (const mode of ['area', 'perimeter']) {
  const render = renderHarness('components/puzzle/GeometryMeasureTask.tsx', 'GeometryMeasureTask');
  const puzzle = allPuzzles.find(p => p.type === 'geometry_measure' && p.payload.guided && p.payload.mode === mode);
  const props = { puzzle, value: null, onChange() {}, answered: false };
  if (mode === 'area') {
    const grid = nodes(render(props)).find(n => n.type === 'CoverGrid');
    assert.ok(grid, 'The learner covers squares directly on the model');
    const last = puzzle.payload.width * puzzle.payload.height - 1;
    grid.props.onChange(new Set([1, last]));
    assert.deepEqual([...nodes(render(props)).find(n => n.type === 'CoverGrid').props.covered], [1, last]);
    const miss = render({ ...props, value: 3, answered: true, checkedResult: 'wrong' });
    const rows = nodes(miss).filter(n => n.type === 'UnitRun');
    assert.equal(rows.length, puzzle.payload.height);
    assert.ok(rows.every(row => row.props.filled === puzzle.payload.width), 'An area miss keeps every square visible');
    const amber = rows.flatMap((row, i) => Array.from({ length: row.props.count }, (_, col) =>
      row.props.hue(col) === 'amber' ? i * row.props.count + col : -1)).filter(id => id >= 0);
    assert.deepEqual(amber, [0, 1, last], 'Tint the submitted count, keeping the squares the learner actually covered');
    continue;
  }
  for (let i = 0; i < 2; i++) nodes(render(props)).find(n => n.props.testID === 'geometry-mark').props.onPress();
  const solved = render({ ...props, answered: true, onSolutionShown() {} });
  assert.equal(nodes(solved).find(n => n.type === 'GeometryMeasureReveal').props.marked, 2,
    'The automatic count continues from the learner’s manual marks');
}
const hiddenSides=allPuzzles.filter(p=>p.type==='geometry_measure'&&p.payload.mode.startsWith('missing'));
for(const puzzle of hiddenSides){
  const tree=renderGeometry({puzzle,value:null,onChange(){},answered:false});
  const shape=nodes(tree).find(n=>n.props.testID==='geometry-shape-main');
  const size=json(shape.props.style);
  assert.ok(size.width > 0 && size.height > 0);
  // Missing-side rectangles are drawn to true proportions; only the unit grid is hidden (council decision).
  const ratio = size.width / size.height, trueRatio = puzzle.payload.width / puzzle.payload.height;
  assert.ok(Math.abs(ratio - trueRatio) / trueRatio < 0.02, `${puzzle.id}: missing-side rectangle keeps its true proportions`);
  assert.equal(shape.props.accessibilityLabel,t('geometryModels.unknownShape',{width:puzzle.payload.width}));
  assert.ok(!nodes(tree).some(n=>n.props.children===en.geometryModels.notToScale),'A to-scale drawing is not labelled "not to scale"');
  assert.ok(!nodes(tree).some(n=>n.props.children===en.geometryModels.unitSquare),'Schematic diagrams are not described as countable unit grids');
}
console.log('Geometry screen checks passed: all five modes, empty drafts, correction, lives, duplicate submission, rewards and missing-side answer concealment.');

// Tapping a spatial position must round-trip through each authored answer format.
{
  const path = 'components/puzzle/everyday/GridAnswerChoices.tsx';
  const board = renderHarness(path, 'GridAnswerChoices');
  const alternate = renderHarness(path, 'GridResponseChoices');
  const evidence = renderHarness('components/puzzle/CheckedPuzzleReveal.tsx', 'Evidence');
  const { gridPose, gridSteps } = loadPure('@/utils/puzzle-grid');
  const grids = allPuzzles.filter(p => p.everyday?.model.kind === 'grid');
  // Follow a miss through the live PlaySession, including its separate inline board path.
  const liveVariants = new Map(grids.map(puzzle => [`${puzzle.everyday.model.task}/${puzzle.response?.kind ?? 'choice'}`, puzzle]));
  for (const puzzle of liveVariants.values()) {
    const play = screen(puzzle);
    const displayed = play.task().puzzle;
    const { answer } = puzzleQADraft(displayed, 'wrong');
    if (answer.kind === 'choice') play.task().onSelectChoice(answer.index);
    else play.task().onResponseChange(answer.value);
    play.refresh(); play.check().onPress(); play.refresh();
    const task = play.task();
    const editor = renderTaskView(task);
    assert.ok(!play.text().includes(en.play.adjustAnswer), 'The checked grid keeps the space needed for the submitted cell');
    const checked = (displayed.response ? renderResponse : renderStory)(editor.props);
    assert.equal(checked.props.mode, 'attempt');
    assert.equal(typeof task.onSolutionShown, 'function');
    assert.equal(checked.props.onSolutionShown, task.onSolutionShown);
    const boardProps = checked.type === 'GridResponseChoices' ? alternate(checked.props).props : checked.props;
    assert.ok(Number.isInteger(board(boardProps).props.attemptedCell), `${displayed.id}: retry plays the submitted geometry`);
    if (answer.kind === 'choice' || displayed.response?.kind === 'choose') {
      const label = nodes(play.tree()).find(node => node.type === 'ChoiceButton' && node.props.result === 'wrong').props.label;
      const index = answer.kind === 'choice' ? answer.index : Number(answer.value);
      const options = displayed.response?.options ?? displayed.choices;
      assert.equal(label, `${String.fromCharCode(65 + index)} · ${play.tr('everyday.gridSquare', { number: options[index] })}`);
    }
  }
  for (const puzzle of grids) {
    for (const outcome of ['wrong', 'correct']) {
      const correct = outcome === 'correct';
      const mode = correct ? 'worked' : 'attempt';
      const snapshot = { puzzle, ...puzzleQADraft(puzzle, outcome), correct };
      const onSolutionShown = () => {};
      const judge = puzzle.response?.kind === 'judge';
      const usesResponseBoard = puzzle.response && !judge;
      for (const modelOnly of [false, true]) {
        const checked = nodes(evidence({ snapshot, mode, onSolutionShown, modelOnly }));
        const frozen = checked.find(n => n.type === (usesResponseBoard ? 'GridResponseChoices' : 'GridAnswerChoices')).props;
        assert.equal(frozen.answered, true);
        assert.equal(frozen.isCorrect, correct);
        if (judge) assert.deepEqual([...frozen.choices], [puzzle.response.proposed]);
        else assert.equal(frozen.choices, puzzle.choices);
        assert.equal(frozen.mode, mode);
        assert.equal(frozen.onSolutionShown, onSolutionShown);
        const boardProps = usesResponseBoard ? alternate(frozen).props : frozen;
        const diagram = board(boardProps).props;
        let cell;
        if (judge) cell = puzzle.response.proposed;
        else if (puzzle.response?.kind === 'write') cell = snapshot.answer.value;
        else if (puzzle.response?.kind === 'choose') cell = puzzle.response.options[Number(snapshot.answer.value)];
        else cell = puzzle.choices[snapshot.answer.index];
        assert.ok(Number.isInteger(Number(cell)) && Number(cell) >= 1 && Number(cell) <= puzzle.everyday.model.size ** 2);
        assert.equal(diagram.attemptedCell, correct ? undefined : Number(cell), 'The miss guide uses the submitted or judged cell');
        assert.equal(diagram.onSolutionShown, onSolutionShown);
        assert.equal(checked.some(n => n.type?.name === 'GridAttemptCaption' && n.props.snapshot === snapshot), !correct && !modelOnly);
      }
    }
    const model = puzzle.everyday.model;
    const end = gridPose(model, gridSteps(model));
    const destination = String(Math.floor(end.y) * model.size + Math.floor(end.x) + 1);
    let submitted;
    const state = { model, choices: puzzle.choices, answered: false, isCorrect: false, incorrectAttempt: false };
    const alt = puzzle.response && alternate({ ...state, response: puzzle.response, value: null, onChange: v => { submitted = v; } });
    if (puzzle.response?.kind === 'judge') {
      const claim = nodes(alt).find(n => n.props.claim);
      assert.equal(claim.props.choices[0], puzzle.response.proposed);
      const buttons = nodes(alt).filter(n => n.type === 'ChoiceButton');
      for (const [index, button] of buttons.entries()) {
        button.props.onPress();
        assert.equal(submitted, index === 0);
        assert.equal(checkPuzzleAnswer(puzzle, {kind:'response',value:submitted}), (puzzle.response.proposed === destination) === submitted);
      }
      continue;
    }
    const tree = board(alt ? alt.props : { ...state, correctIndex: puzzle.correctIndex, selectedIndex: null, onSelect: index => { submitted = index; } });
    const cells = tree.props.renderCells({pad: 3, pitch: 48});
    assert.equal(cells.length, puzzle.response?.kind === 'write' ? model.size ** 2 : puzzle.choices.length);
    for (const [index, cell] of cells.entries()) {
      const square = puzzle.response ? String(index + 1) : puzzle.choices[index];
      const placement = cell.props.style[1];
      assert.equal(placement.left, 3 + 48 * ((Number(square) - 1) % model.size));
      assert.equal(placement.top, 3 + 48 * Math.floor((Number(square) - 1) / model.size));
      cell.props.onPress();
      assert.equal(submitted, puzzle.response ? square : index);
      assert.equal(puzzle.response ? checkPuzzleAnswer(puzzle, {kind:'response',value:submitted}) : submitted === puzzle.correctIndex, square === destination);
    }
  }
  console.log(`Verified tapped positions, transformations and answer contracts for ${grids.length} spatial grids.`);
}

for(const type of ['ratio_table','signed_line','equation_board','coordinate_map'])for(const tier of ['easy','medium','hard']) {
 const puzzle=allPuzzles.find(p=>p.type===type&&p.difficulty===tier);
 const target=loadPure('@/utils/bridge-models').bridgeTarget(puzzle),state=screen(puzzle);
 const wrong=type==='equation_board'?{equation:{a:1,b:0,c:999}}:typeof target==='number'?{value:999}:{point:{x:99,y:99}};
 const right=type==='equation_board'?{equation:{a:1,b:0,c:target}}:typeof target==='number'?{value:target}:{point:target};
 assert.equal(state.check().disabled,true);
 state.task().onBridgeChange(wrong);state.refresh();state.check().onPress();state.refresh();
 assert.equal(state.game.progress.lives.current,2);assert.equal(state.attempts[0].correct,false);retry(state);assert.equal(state.check().disabled,true);
 state.task().onBridgeChange(null);state.refresh();assert.equal(state.check().disabled,true);assert.equal(state.game.progress.lives.current,2);
 state.task().onBridgeChange(right);state.refresh();const submit=state.check().onPress;submit();submit();state.refresh();
 seeResult(state);
 assert.equal(state.attempts.length,2);assert.equal(state.result().correct,true);assert.equal(state.result().coinsEarned,getPuzzleCoinReward(tier));
}
console.log('Bridge screen checks passed in every difficulty: empty drafts, correction, reset, one-life mistakes, duplicate submissions and rewards.');

for (const kind of ['write', 'choose', 'judge']) {
  const puzzle = allPuzzles.find(p => p.response?.kind === kind), r = puzzle.response;
  const state = screen(puzzle), right = kind === 'write' ? r.answer : kind === 'choose' ? String(r.correctIndex) : r.isCorrect;
  const wrong = kind === 'write' ? '999' : kind === 'choose' ? String((r.correctIndex + 1) % r.options.length) : !r.isCorrect;
  assert.equal(state.check().disabled, true);
  state.task().onResponseChange(wrong); state.refresh(); state.check().onPress(); state.refresh();
  assert.equal(state.game.progress.lives.current, 2); assert.equal(state.attempts.length, 1);
  assert.equal(state.proof().snapshot.draft.response, wrong);
  retry(state); assert.equal(state.check().disabled, true);
  if (kind === 'write') {
    assert.equal(state.task().responseValue, wrong, 'Retry restores the submitted written answer');
    const scroll = nodes(state.tree()).find(node => node.type === 'ScrollView').props.ref.current;
    assert.equal(scroll.scrollCalls.at(-1).y, 0, 'Retry restores the model at the top while the keypad stays in the fixed dock');
    state.task().onResponseChange(wrong); state.refresh();
    assert.equal(state.task().incorrectAttempt, false, 'Retyping the rejected value does not interrupt editing');
    assert.equal(state.check().disabled, true, 'Retyping the same value cannot spend another life');
  }
  state.task().onResponseChange(null); state.refresh(); assert.equal(state.check().disabled, true);
  state.task().onResponseChange(right); state.refresh(); const submit = state.check().onPress;
  submit(); submit(); state.refresh();
  if (state.proof()) {
    assert.equal(state.result(), undefined, 'The result sheet leaves the accepted solution visible');
    assert.equal(state.primary().label, en.play.seeResult);
    state.primary().onPress(); state.refresh();
  }
  assert.equal(state.attempts.length, 2); assert.equal(state.result().correct, true);
  assert.equal(state.result().coinsEarned, getPuzzleCoinReward(puzzle.difficulty));
}
console.log('All alternate activities use the real shared Check, preserve drafts, charge one life per accepted mistake and prevent duplicate rewards.');

const { checkBridgeFeedback } = await import('./puzzles/check-bridge-feedback.mjs');
checkBridgeFeedback({ load: loadPure });

// Real PlaySession: hints escalate only on accepted distinct mistakes, with drafts intact.
for (const locale of ['en','lv','ru']) for (const type of ['ratio_table','signed_line','equation_board','coordinate_map']) {
  const puzzle=allPuzzles.find(p=>p.type===type&&p.difficulty==='medium');
  const target=loadPure('@/utils/bridge-models').bridgeTarget(puzzle), state=screen(puzzle,{locale});
  const strings=JSON.parse(fs.readFileSync(`locales/${locale}.json`)).play.attemptHints;
  const wrongs=type==='equation_board'
    ? [{equation:{...puzzle.payload}}, {equation:loadPure('@/utils/bridge-models').transformEquation(puzzle.payload,'add',1)}]
    : typeof target==='number' ? [{value:target+2},{value:target+3}] : [{point:{x:target.y,y:target.x}},{point:{x:target.x,y:target.y+1}}];
  for (let i=0;i<2;i++) {
    const draft=wrongs[i]; state.task().onBridgeChange(draft);state.refresh();
    const check=state.check().onPress; check();check();state.refresh();
    assert.equal(state.attempts.length,i+1,'Duplicate taps do not escalate feedback or charge twice');
    assert.equal(state.game.progress.lives.current,2-i);
    const host = nodes(state.tree()).find(node => node.props?.value?.onInitialModelPainted)?.props.value;
    assert.equal(host?.attemptKey, state.attempts[i].id, 'The proof uses the identity of this accepted submission');
    if (i > 0) assert.notEqual(host.attemptKey, state.attempts[i - 1].id);
    retry(state);
    assert.deepEqual(json(state.task().bridge),json(draft),'The child keeps the work that needs correcting');
    if (type === 'equation_board') {
      state.task().onBridgeChange({ ...draft, equationMoves: [{ operation: 'add', amount: 1 }, { operation: 'add', amount: -1 }] });
      state.refresh();
      assert.equal(state.check().disabled, true, 'A different history reaching the same equation cannot spend another life');
    }
    const hint=getPuzzleAttemptHint(puzzle,{kind:'bridge',state:draft},i+1);
    assert.ok(state.text().includes(strings[hint.key]),`${locale}/${type}: actual mistake is shown`);
    if(i===1)assert.ok(state.text().includes(strings[hint.detailKey]),'A repeated mistake adds a strategy');
    assert.equal(state.game.wallet.coins,100);assert.equal(state.game.progress.completedPuzzleIds.length,0);
  }
  const right=type==='equation_board'?{equation:{a:1,b:0,c:target}}:typeof target==='number'?{value:target}:{point:target};
  state.task().onBridgeChange(right);state.refresh();
  assert.ok(!state.text().includes(strings[getPuzzleAttemptHint(puzzle,{kind:'bridge',state:wrongs[1]},2).key]),'Editing removes stale feedback');
  state.check().onPress();state.refresh();
  seeResult(state);
  assert.equal(state.result().correct,true);
  assert.equal(state.result().coinsEarned,getPuzzleCoinReward(puzzle.difficulty));
}
console.log('Localized bridge retry flow passed: specific first hints, expanded second hints, unchanged drafts, duplicate-tap guards, life costs and normal solve rewards.');

// Completion hands the earned inventory item to the existing room placement flow.
{
  const plan = PUZZLE_PATHS.find(lesson => lesson.id === 'easy-cat-plans-picnic');
  const ids = plan.levels.flatMap(level => level.puzzleIds);
  const puzzle = allPuzzles.find(item => item.id === ids.at(-1));
  const state = screen(puzzle, { final: true, lessonOverride: plan, completedIds: ids.slice(0, -1) });
  state.task().onSelectChoice(puzzle.correctIndex); state.refresh(); state.check().onPress(); state.refresh();
  assert.equal(state.result(), undefined, 'The final shopping puzzle shows the purchase before the furnishing');
  assert.equal(state.primary().label, en.play.seeResult);
  state.primary().onPress(); state.refresh();
  assert.equal(state.result().decorationLessonId, plan.id);
  assert.equal(state.game.progress.decorationQuantities.kitchenBreadBasket, 1);
  assert.equal(state.result().secondaryLabel, en.catPlans.placeInHouse);
  assert.equal(state.routes.length, 0, 'Earning a decoration does not force navigation');
  state.result().onGoHome();
  assert.deepEqual(json(state.routes), [['decorate', { kind: 'decoration', id: 'kitchenBreadBasket' }], ['path', '/']], 'Place in house selects the earned item before returning home');
  const replay = screen(puzzle, { final: true, lessonOverride: plan, completedIds: ids, claimedRewards: [plan.id], replay: true });
  replay.task().onSelectChoice(puzzle.correctIndex); replay.refresh(); replay.check().onPress(); replay.refresh();
  replay.primary().onPress(); replay.refresh();
  assert.equal(replay.result().decorationLessonId, undefined, 'Replay does not announce another item');
}
console.log('Cat-plan completion previews its earned furnishing and opens the existing placement flow without a duplicate replay reward.');

// Shopping diagrams identify the objects being priced without revealing a sum.
for (const locale of ['en', 'lv', 'ru']) {
  const model = readPuzzles(locale, 'easy').find(p => p.id === 'v2-easy-cat-plans-picnic-2').everyday.model;
  const strings = JSON.parse(fs.readFileSync(`locales/${locale}.json`, 'utf8'));
  const render = renderHarness('components/puzzle/everyday/MoneyStage.tsx', 'MoneyShelf', {
    '@/contexts/LocaleProvider': { useLocale: () => ({ locale }) },
    'react-i18next': { useTranslation: () => ({ t: key => key.split('.').reduce((value, part) => value[part], strings) }) },
  });
  const tree = nodes(render({ model }));
  assert.deepEqual(tree.filter(n => n.type === 'MoneyDiagramIcon').map(n => n.props.name), ['apple', 'cookie']);
  const text = n => [n.props.children].flat(Infinity).filter(c => typeof c === 'string' || typeof c === 'number').join('');
  for (const label of ['€2', '€3']) {
    assert.ok(tree.some(n => text(n) === label), `Show ${label} in ${locale}`);
  }
  assert.ok(!tree.some(n => ['€5', '€5.00', '€5,00'].includes(text(n))), 'The diagram must not reveal the answer');
  assert.equal(tree[0].props.accessibilityLabel, model.label);
}
console.log('Verified pictured shopping items, compact prices, matching accessible givens and no answer leak.');
