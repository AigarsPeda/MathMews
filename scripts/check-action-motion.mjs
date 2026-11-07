import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const cache = new Map();
function load(id) {
  if (cache.has(id)) return cache.get(id);
  if (/\.(png|webp)$/.test(id)) return id;
  const path = id.replace('@/', '') + (id.endsWith('.json') ? '' : '.ts');
  if (path.endsWith('.json')) return JSON.parse(fs.readFileSync(path));
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,
    { module, exports: module.exports, require: load, Set, Map });
  cache.set(id, module.exports); return module.exports;
}
const clone = value => JSON.parse(JSON.stringify(value));
const { getQuantityTaskTokens } = load('@/utils/quantity-task-scene');
for (const items of [8, 23, 31]) for (const groups of [3, 4, 5]) {
  const model = { kind: 'share', items, groups, object: 'cookie' };
  const limit = Math.floor(items / groups) * groups;
  let previous = getQuantityTaskTokens(model, 0, 0).filter(t => t.id.startsWith('counter-'));
  for (let dealt = 1; dealt <= limit; dealt++) {
    const next = getQuantityTaskTokens(model, dealt, dealt).filter(t => t.id.startsWith('counter-'));
    assert.equal(next.length, items, 'Sharing conserves all objects, including remainders');
    const moved = next.filter((token, i) => token.x !== previous[i].x || token.y !== previous[i].y);
    assert.equal(moved.length, 1, 'Exactly one object moves per learner action');
    assert.equal(moved[0].id, `counter-${dealt - 1}`);
    assert.equal(next.filter(t => t.y >= 70).length, dealt);
    previous = next;
  }
  const over = getQuantityTaskTokens(model, 999, 999).filter(t => t.id.startsWith('counter-'));
  assert.equal(over.filter(t => t.y < 70).length, items % groups, 'Stop before an incomplete round');
}
const { getPlaceValueTokens } = load('@/utils/place-value-tokens');
for (let tens = 0; tens < 9; tens++) for (let ones = 10; ones < 20; ones++) {
  const before = getPlaceValueTokens({ tens, ones, added: false });
  const after = getPlaceValueTokens({ tens: tens + 1, ones: ones - 10, added: false });
  assert.deepEqual(clone(before.map(t => t.id)), clone(after.map(t => t.id)), 'Bundling retains every unit identity');
  assert.equal(before.length, after.length);
  const exchanged = after.filter((t, i) => t.tone !== before[i].tone);
  assert.equal(exchanged.length, 10, 'Exactly ten loose units join the new rod');
  assert.equal(new Set(exchanged.map(t => t.y)).size, 1);
  assert.ok(after.every(t => t.x > 0 && t.x < 300 && t.y > 0 && t.y < 140));
}
const { PUZZLE_PATHS } = load('@/constants/puzzle-path');
const { countFinishedLessons, getNewLearningMilestone, LEARNING_MILESTONES } = load('@/constants/learning-milestones');
const ids = count => PUZZLE_PATHS.slice(0, count).flatMap(l => l.levels.flatMap(v => v.puzzleIds));
for (const milestone of LEARNING_MILESTONES) {
  const finished = ids(milestone.lessons), before = finished.slice(0, -1);
  assert.equal(countFinishedLessons(before), milestone.lessons - 1, 'Nine steps cannot collect a full-lesson milestone');
  assert.equal(getNewLearningMilestone(before, finished)?.lessons, milestone.lessons);
  assert.equal(getNewLearningMilestone(finished, [...finished, finished.at(-1)]), undefined, 'Replays and duplicate callbacks grant no new performance');
  assert.equal(countFinishedLessons(JSON.parse(JSON.stringify(finished))), milestone.lessons, 'Collection survives save/reopen without new save fields');
}
const { getPuzzleCompanionMessage } = load('@/utils/puzzle-companion');
for (const kind of ['practice', 'challenge', 'boss']) assert.equal(getPuzzleCompanionMessage({ correct: true, kind, retries: 1, finalStage: true, practiceFinished: true, replay: false, completedCount: 50, puzzleId: 'correction' }).reaction, 'puzzleProud', 'Correcting a mistake keeps its quiet nod even at an endpoint');
console.log('Verified single-object sharing, visible partial rounds and remainders, ten conserved units per exchange, correction priority and persistent milestone boundaries without replay rewards.');

// Exercise the actual token renderer with native animation calls captured.
const animationCalls = [], shared = []; let cursor = 0, reduceMotion = false, active = true, cleanups = [];
const jsx = (type, props) => ({ type, props });
const reanimated = { __esModule: true, default: { View: 'Animated.View', Text: 'Animated.Text' },
  FadeIn: { duration: () => ({ reduceMotion: () => ({}) }) }, ReduceMotion: { System: 'system' },
  useSharedValue: value => { const i = cursor++; return shared[i] ?? (shared[i] = { value }); },
  useAnimatedStyle: fn => fn(), cancelAnimation: value => animationCalls.push(['cancel', value.value]),
  withTiming: (value, options) => { animationCalls.push(['timing', value, options.duration]); return value; },
  withDelay: (delay, value) => { animationCalls.push(['delay', delay]); return value; }, withSequence: (...values) => values.at(-1),
};
const mocks = {
  'react': { useState: () => [300, () => {}], useRef: value => ({ current: value }), useEffect: fn => cleanups.push(fn()) },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { View: 'View', StyleSheet: { create: x => x, absoluteFill: {} } },
  'react-native-reanimated': reanimated,
  '@/hooks/use-animation-activity': { useAnimationActivity: () => ({ active, reduceMotion }) },
  '@/utils/scale': { moderateScale: x => x },
  './PuzzleObjectImage': { PuzzleObjectImage: 'PuzzleObjectImage' },
};
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/puzzle/VisualPracticeBoard.tsx', 'utf8')+'\nexport { MovingToken };',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
  { module, exports: module.exports, require: id => mocks[id] ?? (id.startsWith('@/components/') ? new Proxy({}, { get: (_, name) => name }) : load(id)) });
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];
for (const state of [{ reduceMotion: false, active: true }, { reduceMotion: true, active: true }, { reduceMotion: false, active: false }]) {
  ({ reduceMotion, active } = state);
  const token = { id: 'unit-10', label: '', shape: 'part', x: 28, y: 26, tone: 'blue', width: 9, height: 9 };
  const tree = module.exports.VisualPracticeBoard({ tokens: [token], durationMs: 400, staggerMs: 0 });
  const moving = nodes(tree).find(n => n.type === module.exports.MovingToken);
  assert.equal(moving.props.motion, active && !reduceMotion);
  cursor = 0; animationCalls.length = 0;
  module.exports.MovingToken(moving.props);
  assert.ok(animationCalls.filter(c => c[0] === 'timing').every(c => c[2] === (active && !reduceMotion ? 400 : 0)), 'Reduce Motion and covered screens settle at the current mathematical state without travel');
  assert.ok(animationCalls.some(c => c[0] === 'cancel'), 'New actions cancel unfinished movement');
  assert.equal(shared[0].value, 28); assert.equal(shared[1].value, 26);
  cleanups.forEach(fn => fn?.()); cleanups = [];
}
console.log('Verified the real token renderer cancels interrupted motion and settles immediately for Reduce Motion and covered/background screens.');
