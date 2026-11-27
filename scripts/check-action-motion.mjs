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
const { getCountingLayout, getPiecePosition } = load('@/utils/puzzle-counting');
for (const kind of ['join', 'take_away']) {
  for (const right of [1, 3, 7]) {
    const { pieces } = getCountingLayout({ kind, left: 9, right, object: kind === 'join' ? 'ribbon' : 'star' });
    const moving = pieces.filter(p => p.turn >= 0).sort((a, b) => a.turn - b.turn);
    assert.equal(moving.length, right);
    for (const piece of moving) {
      const position = getPiecePosition(piece, piece.turn + .5);
      assert.ok(kind === 'join' ? piece.endX < position.x && position.x < piece.x : piece.endY < position.y && position.y < piece.y);
    }
    assert.equal(pieces.filter(p => getPiecePosition(p, right).y >= 0).length, kind === 'join' ? 9 + right : 9 - right);
    assert.ok(pieces.every(p => getPiecePosition(p, 0).x === p.x && getPiecePosition(p, 0).y === p.y));
  }
}
// At the same instant, joining objects should be airborne and departing objects
// should be speeding up. The stationary group anchors the count throughout.
for (const kind of ['join', 'take_away']) {
  const { pieces } = getCountingLayout({ kind, left: 5, right: 1, object: 'star' });
  const moving = pieces.find(p => p.turn === 0);
  const pose = t => getPiecePosition(moving, t);
  assert.ok(pose(.09).squash > 0 && pose(.09).y > moving.y);
  if (kind === 'join') {
    assert.ok(pose(.48).y < moving.y && pose(.48).angle < 0);
    assert.ok(pose(.9).squash > 0 && pose(.9).x === moving.endX);
  } else {
    assert.equal(pose(.90).opacity, 0);
    assert.ok(pose(.55).y - pose(.70).y > pose(.30).y - pose(.45).y);
  }
  assert.equal(pose(1).squash, 0);
  for (const still of pieces.filter(p => p.turn < 0)) {
    assert.deepEqual(getPiecePosition(still, .5), getPiecePosition(still, 0));
  }
}
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
const { getPuzzleCompanionMessage } = load('@/utils/puzzle-companion');
for (const kind of ['practice', 'challenge']) assert.equal(getPuzzleCompanionMessage({ correct: true, kind, retries: 1, finalStage: true, practiceFinished: true, replay: false, completedCount: 50, puzzleId: 'correction' }).reaction, 'puzzleProud', 'Correcting a mistake keeps its quiet nod even at an endpoint');
console.log('Verified single-object sharing, visible partial rounds and remainders, ten conserved units per exchange, and correction priority.');

// Exercise the real renderer at controlled positions on its single reveal clock.
const jsx = (type, props) => ({ type, props });
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];
const motion = load('@/constants/puzzle-theme').Motion;
const position = { value: 0 };
let active = true, reduced = false, landed = 0, settled = false, span = 0, skips = 0;
function skip() { position.value = 1; landed = 1; settled = true; skips++; }
function replay() { position.value = 0; landed = 0; settled = false; }
const mocks = {
  'react': { useState: value => [typeof value === 'number' ? 300 : value, () => {}], useEffect: fn => fn() },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { View: 'View', StyleSheet: { create: value => value, absoluteFill: {} } },
  'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, useAnimatedStyle: fn => fn(), useDerivedValue: fn => ({get value() { return fn(); }}) },
  '@/hooks/use-animation-activity': { useAnimationActivity: () => ({ active }) },
  '@/utils/scale': { moderateScale: value => value },
  './PuzzleObjectImage': { PuzzleObjectImage: 'PuzzleObjectImage' },
  './kit/Focus': { Focus: 'Focus', Caption: 'Caption' },
  './kit/RevealSurface': { RevealSurface: 'RevealSurface' },
  './kit/useRevealBeats': { useRevealBeats: (count, options) => {
    assert.equal(count, 1); span = options.step;
    return { position, reduced, landed, settled, skip, replay };
  } },
};
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/puzzle/VisualPracticeBoard.tsx', 'utf8')+'\nexport { PracticeFrame, MovingToken };',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
  { module, exports: module.exports, require: id => mocks[id] ?? (id.startsWith('@/components/') ? new Proxy({}, { get: (_, name) => name }) : load(id)) });
const from = [0, 1].map(index => ({ id: `unit-${index}`, label: '', shape: 'part', x: 0, y: 18, tone: 'blue' }));
const tokens = from.map(token => ({ ...token, x: 80, y: 40 }));
const render = () => module.exports.PracticeFrame({ from, tokens, moving: true, result: '2' });
const poses = tree => nodes(tree).filter(node => node.type === module.exports.MovingToken).map(node => {
  const element = module.exports.MovingToken(node.props);
  return Array.from(element.props.style.at(-1).transform, transform => Object.values(transform)[0]);
});
const hasResult = tree => nodes(tree).some(node => node.type === 'Caption' && node.props.children === '2');
const opening = render();
assert.equal(opening.type, 'RevealSurface');
assert.deepEqual(poses(opening), [[0,18,1], [0,18,1]]);
assert.equal(span, motion.step + motion.stagger);
position.value = motion.stagger / (2 * span);
const moving = poses(render());
assert(moving[0][0] > 0 && moving[0][0] < 80);
assert.equal(moving[1][0], 0);
assert.equal(hasResult(render()), false);
opening.props.beats.skip();
assert.deepEqual(poses(render()), [[80,40,1], [80,40,1]]);
assert.equal(hasResult(render()), true);
opening.props.beats.replay();
assert.deepEqual(poses(render()), [[0,18,1], [0,18,1]]);
reduced = true;
assert.deepEqual(poses(render()), [[80,40,1], [80,40,1]]);
reduced = false; active = false; skips = 0;
assert.deepEqual(poses(render()), [[80,40,1], [80,40,1]]);
assert.equal(skips, 1);
console.log('Verified shared-clock poses, stagger, deferred result, skip, replay, Reduce Motion and inactive practice boards.');
