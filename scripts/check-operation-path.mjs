/** Check the editable operation path before and after submission. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { Children } from 'react';

const root = process.cwd(), cache = new Map();
const strings = JSON.parse(fs.readFileSync('locales/en.json', 'utf8'));
const translate = (key, params = {}) => key.split('.').reduce((value, part) => value[part], strings)
  .replace(/{{(\w+)}}/g, (_, name) => params[name]);
const jsx = (type, props) => ({ type, props });
// Component state persists across renders by call order, like React's hook slots.
let hookSlots = [], hookCursor = 0;
const useState = initial => {
  const index = hookCursor++;
  if (!(index in hookSlots)) hookSlots[index] = { value: initial };
  const slot = hookSlots[index];
  return [slot.value, next => { slot.value = typeof next === 'function' ? next(slot.value) : next; }];
};
function load(id, base = root) {
  if (id === 'react') return { Children, Fragment: 'Fragment', useMemo: fn => fn(), useState };
  // Motion wrappers render their children; the reveal clock reports a finished walk.
  if (id === '@/components/puzzle/tiles/TileMotion') return new Proxy({}, { get: (_, name) => String(name) });
  if (id === '@/components/puzzle/kit/PracticeAffordances') return { DropTargetOutline: 'DropTargetOutline' };
  if (id === '@/components/puzzle/kit/useRevealBeats') return { useRevealBeats: count => ({ landed: count, done: true, settled: true, reduced: false, progress: { value: 1 } }) };
  if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
  if (id === 'react-i18next') return { useTranslation: () => ({ t: translate }) };
  if (id === 'expo-font') return { isLoaded: () => true };
  if (id === 'react-native') return {
    Pressable: 'Pressable', Text: 'Text', View: 'View', Image: 'Image',
    StyleSheet: { create: styles => styles, flatten: styles => Object.assign({}, ...[styles].flat(Infinity).filter(Boolean)) },
  };
  if (id === '@/utils/scale') return { moderateScale: value => value };
  // The pressable face's lip animation is presentational: a named stub keeps the tree readable.
  if (id === './PressFace' || id === '@/components/puzzle/kit/PressFace') return { PressFace: 'PressFace' };
  const file = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(base, id);
  if (/\.(png|webp|mp4)$/.test(file)) return file;
  const resolved = ['.ts', '.tsx'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} }; cache.set(resolved, module);
  const source = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: child => load(child, path.dirname(resolved)) });
  return module.exports;
}
function flatten(node) {
  if (node == null || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node !== 'object') return [node];
  if (typeof node.type === 'function') return flatten(node.type(node.props));
  return [node, ...flatten(node.props.children)];
}
const { OperationPathTask } = load('@/components/puzzle/OperationPathTask');
const puzzle = { id: 'editable-path', payload: {
  start: 10, target: 14, steps: [{ operand: 2, operator: '-' }, { operand: 6, operator: '+' }],
} };
let selectedOperators = [null, null], answered = false;
const render = () => (hookCursor = 0, flatten(OperationPathTask({
  puzzle, selectedOperators, answered, isCorrect: false,
  onSelectOperator: (index, operator) => { selectedOperators[index] = operator; },
})));
const button = label => render().find(node => node?.type === 'Pressable' && node.props.accessibilityLabel === label);
// One shared operator bank fills the focused step: tap the step's slot, then an operator.
const pick = (operator, step) => {
  button(`Step ${step} operation: ${selectedOperators[step - 1] === null ? '?' : selectedOperators[step - 1].replace('-', '−')}`).props.onPress();
  return button(`Pick ${operator} for step ${step}`);
};
const model = () => {
  const root = render().find(node => node?.props?.testID === 'play-entry-model');
  return flatten(root).filter(node => typeof node === 'string' || typeof node === 'number');
};
const displayed = () => model().map(String).join(' ');
const activeTargets = () => render().filter(node => node?.type === 'Pressable' && node.props.accessibilityState?.selected && node.props.accessibilityLabel?.startsWith('Step '));
assert.equal(activeTargets().length, 1, 'Only the focused empty step accepts the next operator');
assert.equal(displayed(), '10 2 6 = 14');
assert.equal(button('Check answer'), undefined, 'The parent owns Check');
pick('+', 2).props.onPress();
assert.deepEqual(selectedOperators, [null, '+']);
assert.equal(displayed(), '10 2 + 6 = 14');
pick('-', 1).props.onPress();
assert.equal(displayed(), '10 − 2 + 6 = 14', 'Intermediate values stay hidden');
assert.equal(pick('-', 1).props.accessibilityState.selected, true);
pick('×', 1).props.onPress();
assert.equal(displayed(), '10 × 2 + 6 = 14', 'Earlier choices stay editable');
pick('÷', 2).props.onPress();
assert.equal(displayed(), '10 × 2 ÷ 6 = 14', 'An invalid division cannot leave a stale result');
assert.equal(answered, false);
answered = true;
assert.equal(activeTargets().length, 0, 'The checked path has no active operator destination');
assert.equal(render().filter(node => node?.type === 'Pressable').length, 0);
assert.ok(render().includes('Step 2 of 2'));
answered = false;
puzzle.payload.steps.push({ operand: 2, operator: '×' });
selectedOperators = [null, null, null]; hookSlots = [];
pick('×', 3).props.onPress();
pick('+', 2).props.onPress();
pick('-', 1).props.onPress();
assert.equal(displayed(), '10 − 2 + 6 × 2 = 14');
assert.equal(render().filter(node => node?.type === 'Pressable' && String(node.props.accessibilityLabel).startsWith('Pick ')).length, 4);
answered = true;
assert.ok(render().includes('28 ≠ 14'), 'The checked path compares the final computed result to its goal');
console.log('Operation path checks passed for two and three steps, alternate choices, invalid division, hidden intermediate values and the checked result.');
