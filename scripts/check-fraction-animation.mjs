/** Exercise pie geometry and interrupted fill/removal on a deterministic animation clock. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const selectionModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('utils/fraction-pie.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, { module: selectionModule, exports: selectionModule.exports });
const { getFractionSliceAtPoint, toggleFractionSlice, resizeFractionSelection } = selectionModule.exports;

function harness(reducedMotion = false) {
  let cursor = 0, now = 0, effects = [], starts = 0;
  const slots = [];
  let overlay;
  const same = (a, b) => a && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useRef: value => {
      const index = cursor++;
      slots[index] ??= { current: value };
      return slots[index];
    },
    useMemo: (fn, deps) => {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = { deps, value: fn() };
      return slots[index].value;
    },
    useEffect: (fn, deps) => {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) effects.push(() => {
        slots[index]?.cleanup?.();
        slots[index] = { deps, cleanup: fn() };
      });
    },
  };
  function shared(initial) {
    let value = initial, animation;
    const result = {
      get() {
        if (animation) {
          const elapsed = Math.min(1, (now - animation.start) / animation.duration);
          value = animation.from.map((from, index) => from + (animation.to[index] - from) * animation.easing(elapsed));
          if (elapsed === 1) animation = undefined;
        }
        return value;
      },
      set(next) {
        const from = result.get();
        if (Array.isArray(next)) { animation = undefined; value = next; }
        else { starts++; animation = { ...next, from, start: now }; }
      },
      cancel() { result.get(); animation = undefined; },
    };
    return result;
  }
  function path() {
    return {
      commands: [],
      moveTo(...args) { this.commands.push(['move', ...args]); },
      arcToOval(_oval, start, sweep, forceMove) { this.commands.push(['arc', start, sweep, forceMove]); },
      addPath(other) { this.commands.push(...other.commands); },
      addCircle(...args) { this.commands.push(['circle', ...args]); },
      close() { this.commands.push(['close']); },
    };
  }
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Pressable: 'Pressable', StyleSheet: { create: styles => styles } },
    '@/utils/fraction-pie': selectionModule.exports,
    '@/utils/scale': { moderateScale: value => value },
    '@/constants/game': { GameColors: { secondary: '#4ECDC4', success: '#247A3C' } },
    '@shopify/react-native-skia': { Canvas: 'Canvas', Path: 'Path', Skia: { Path: { Make: path } } },
    'react-native-reanimated': {
      useSharedValue: value => react.useMemo(() => shared(value), []),
      useDerivedValue: fn => ({ get: fn }),
      useReducedMotion: () => reducedMotion,
      withTiming: (to, options) => ({ to, ...options }),
      cancelAnimation: value => value.cancel(),
      Easing: { cubic: value => value ** 3, out: fn => value => 1 - fn(1 - value) },
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/puzzle/FractionPieChart.tsx', 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module, exports: module.exports, require: id => { assert.ok(id in mocks, id); return mocks[id]; } });
  return {
    render(props) {
      cursor = 0;
      const tree = module.exports.FractionPieChart(props);
      const pending = effects; effects = [];
      pending.forEach(fn => fn());
      const children = tree.props.children.flat().filter(Boolean);
      overlay = children.find(child => child.type === 'Pressable');
      return children.find(child => child.type === 'Canvas').props.children.flat().filter(Boolean);
    },
    press(x, y) {
      overlay?.props.onPress({ nativeEvent: { locationX: x, locationY: y } });
    },
    hasOverlay: () => !!overlay,
    isDisabled: () => overlay?.props.disabled,
    advance(ms) { now += ms; },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
    starts: () => starts,
  };
}
const filled = tree => tree.find(node => typeof node.props.path.get === 'function');
function angle(tree) {
  const commands = filled(tree).props.path.get().commands;
  return commands.reduce((sum, [command, , sweep]) => sum + (command === 'circle' ? 360 : command === 'arc' ? sweep : 0), 0);
}
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.0001, `${a} should equal ${b}`);
const view = harness();
let tree = view.render({ denominator: 6, shaded: 0 });
assert.equal(angle(tree), 0);
assert.equal(view.starts(), 0, 'Initial rendering does not replay an entrance animation');
const base = tree[0].props.path;
tree = view.render({ denominator: 6, shaded: 1 });
assert.equal(angle(tree), 0, 'Adding begins from the visible fill, without a jump');
view.advance(100);
const intermediate = angle(tree);
assert.ok(intermediate > 0 && intermediate < 60, 'A newly filled slice sweeps through intermediate angles');
tree = view.render({ denominator: 6, shaded: 2 });
close(angle(tree), intermediate);
view.advance(240);
close(angle(tree), 120);
assert.equal(tree[0].props.path, base, 'Changing the fill preserves the static pie and dividers');
tree = view.render({ denominator: 6, shaded: 1 });
view.advance(90);
const removing = angle(tree);
assert.ok(removing > 60 && removing < 120, 'Removing retracts the filled slice');
tree = view.render({ denominator: 6, shaded: 2 });
close(angle(tree), removing);
view.advance(240);
close(angle(tree), 120);
tree = view.render({ denominator: 6, shaded: 6 });
view.advance(240);
assert.equal(angle(tree), 360, 'A full pie remains a complete circle');
tree = view.render({ denominator: 6, shaded: 0 });
view.advance(180);
assert.equal(angle(tree), 0, 'Removing all slices leaves no colored sliver');
tree = view.render({ denominator: 4, shaded: 3 });
assert.equal(angle(tree), 270, 'Changing denominators immediately shows the new model');
tree = view.render({ denominator: 4, shaded: 3, showResult: true, isCorrect: true });
assert.equal(filled(tree).props.color, '#247A3C');
tree = view.render({ denominator: 4, shaded: 3, showResult: true, isCorrect: false });
assert.equal(filled(tree).props.color, '#FF9F43');
tree = view.render({ denominator: 4, shaded: 2 });
view.advance(60);
const atUnmount = angle(tree);
view.unmount(); view.advance(500);
close(angle(tree), atUnmount);

const reduced = harness(true);
assert.equal(angle(reduced.render({ denominator: 6, shaded: 2 })), 120);
assert.equal(angle(reduced.render({ denominator: 6, shaded: 3 })), 180);
assert.equal(angle(reduced.render({ denominator: 6, shaded: 1 })), 60);
assert.equal(reduced.starts(), 0, 'Reduce Motion applies changes immediately');
console.log('Fraction animation checks passed: fill, removal, interrupted taps, empty/full pies, model changes, result colors, cleanup and Reduce Motion.');

// Hit-test every slice across supported pie divisions, including nonadjacent selections.
for (const denominator of [2, 3, 4, 5, 6, 8, 10, 12]) {
  for (let index = 0; index < denominator; index++) {
    const angle = -Math.PI / 2 + (index + 0.5) * Math.PI * 2 / denominator;
    assert.equal(getFractionSliceAtPoint(80 + Math.cos(angle) * 50, 80 + Math.sin(angle) * 50, 80, 76, denominator), index);
  }
}
assert.equal(getFractionSliceAtPoint(80, 80, 80, 76, 6), null, 'The ambiguous exact center does not toggle a random slice');
assert.equal(getFractionSliceAtPoint(0, 0, 80, 76, 6), null, 'Tapping the card outside the circle does nothing');
assert.equal(getFractionSliceAtPoint(80, 4, 80, 76, 6), 0, 'Twelve o’clock starts slice zero');
let selected = toggleFractionSlice([], 4);
selected = toggleFractionSlice(selected, 1);
assert.equal(JSON.stringify(selected), '[1,4]');
selected = toggleFractionSlice(selected, 1);
assert.equal(JSON.stringify(selected), '[4]', 'Toggling removes the touched slice and preserves other selections');
selected = resizeFractionSelection(selected, 2, 6);
assert.equal(JSON.stringify(selected), '[0,4]', 'Plus fills the first empty slice without moving existing pieces');
selected = resizeFractionSelection(selected, 1, 6);
assert.equal(JSON.stringify(selected), '[0]', 'Minus removes the last filled slice');
assert.equal(resizeFractionSelection(selected, 99, 6).length, 6);
assert.equal(resizeFractionSelection(selected, -1, 6).length, 0);

const interactive = harness();
const taps = [];
const onToggleSlice = index => taps.push(index);
tree = interactive.render({ denominator: 6, shaded: 2, selectedSlices: [0, 3], onToggleSlice });
interactive.press(120, 50);
interactive.press(40, 110);
interactive.press(0, 0);
assert.equal(JSON.stringify(taps), '[0,3]', 'Touch coordinates identify the exact slice');
tree = interactive.render({ denominator: 6, shaded: 1, selectedSlices: [3], onToggleSlice });
interactive.advance(90);
assert.ok(angle(tree) > 60 && angle(tree) < 120, 'Only the removed piece retracts');
interactive.advance(90);
close(angle(tree), 60);
const arcs = filled(tree).props.path.get().commands.filter(([command]) => command === 'arc');
assert.equal(arcs.length, 1);
assert.equal(arcs[0][1], 90, 'The untapped slice stays in its original position');
tree = interactive.render({ denominator: 6, shaded: 2, selectedSlices: [1, 3], onToggleSlice });
interactive.advance(240);
close(angle(tree), 120);
assert.equal(JSON.stringify(filled(tree).props.path.get().commands.filter(([command]) => command === 'arc').map(([, start]) => start)), '[-30,90]');
interactive.render({ denominator: 6, shaded: 2, selectedSlices: [1, 3], onToggleSlice, showResult: true });
assert.equal(interactive.isDisabled(), true);
interactive.press(120, 50);
assert.equal(taps.length, 2, 'Answered puzzles ignore slice taps');
interactive.render({ denominator: 6, shaded: 2 });
assert.equal(interactive.hasOverlay(), false, 'Passive charts leave touch handling to their matching card');
console.log('Fraction touch checks passed: exact slices, empty space, independent selection, mixed button use and answer locking.');
