/** Check the editable operation path before and after submission. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd(), cache = new Map();
const strings = JSON.parse(fs.readFileSync('locales/en.json', 'utf8'));
const translate = (key, params = {}) => key.split('.').reduce((value, part) => value[part], strings)
  .replace(/{{(\w+)}}/g, (_, name) => params[name]);
const jsx = (type, props) => ({ type, props });
function load(id) {
  if (id === 'react') return { useMemo: fn => fn() };
  if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
  if (id === 'react-i18next') return { useTranslation: () => ({ t: translate }) };
  if (id === 'react-native') return {
    Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: styles => styles },
  };
  if (id === '@/utils/scale') return { moderateScale: value => value };
  const file = path.join(root, id.slice(2));
  if (/\.(png|webp|mp4)$/.test(file)) return file;
  const resolved = ['.ts', '.tsx'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} }; cache.set(resolved, module);
  const source = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: load });
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
let selectedOperators = [null, null], answered = false, submissions = 0;
const render = () => flatten(OperationPathTask({
  puzzle, selectedOperators, answered, isCorrect: false,
  onSelectOperator: (index, operator) => { selectedOperators[index] = operator; },
  onCheck: () => { submissions++; answered = true; },
}));
const button = label => render().find(node => node?.type === 'Pressable' && node.props.accessibilityLabel === label);
const stepValues = index => {
  const tree = render();
  const labelIndex = tree.indexOf(`Step ${index + 1} of ${puzzle.payload.steps.length}`);
  return tree.slice(labelIndex + 1).filter(node => typeof node === 'string' || typeof node === 'number').slice(0, 5);
};

assert.ok(render().includes('Step 1 of 2'));
assert.ok(render().includes('Step 2 of 2'), 'Later equations must be visible before choosing anything');
assert.deepEqual(stepValues(1), ['?', '?', 6, '=', '?']);
assert.equal(button('Check answer'), undefined, 'Incomplete paths cannot be submitted');
button('Pick + for step 2').props.onPress();
assert.deepEqual(selectedOperators, [null, '+'], 'Steps can be filled in any order');
assert.deepEqual(stepValues(1), ['?', '+', 6, '=', '?'], 'An unknown earlier result must stay unknown');
button('Pick - for step 1').props.onPress();
assert.deepEqual(stepValues(0), [10, '-', 2, '=', 8]);
assert.deepEqual(stepValues(1), [8, '+', 6, '=', 14]);
assert.ok(render().includes('Your result: 14'));
assert.equal(button('Pick - for step 1').props.accessibilityState.selected, true);
button('Pick × for step 1').props.onPress();
assert.deepEqual(stepValues(1), [20, '+', 6, '=', 26], 'Changing an earlier operator recalculates later equations');
button('Pick - for step 2').props.onPress();
assert.deepEqual(stepValues(1), [20, '-', 6, '=', 14], 'All filled steps remain editable');
assert.equal(submissions, 0, 'Choosing operators never submits the answer');
button('Pick ÷ for step 2').props.onPress();
assert.deepEqual(stepValues(1), [20, '÷', 6, '=', '?'], 'Invalid division must not show a stale result');
assert.equal(render().some(node => typeof node === 'string' && node.startsWith('Your result:')), false);
button('Pick - for step 2').props.onPress();
button('Check answer').props.onPress();
assert.equal(submissions, 1);
assert.equal(render().filter(node => node?.type === 'Pressable').length, 0, 'Submitted paths cannot be edited');
assert.ok(render().includes('Step 2 of 2'), 'Submitted equations remain visible');
answered = false;
puzzle.payload.steps.push({ operand: 2, operator: '×' });
selectedOperators = [null, null, null];
assert.ok(render().includes('Step 3 of 3'), 'Every equation is visible for longer paths too');
button('Pick × for step 3').props.onPress();
button('Pick + for step 2').props.onPress();
assert.deepEqual(stepValues(2), ['?', '×', 2, '=', '?']);
button('Pick - for step 1').props.onPress();
assert.deepEqual(stepValues(2), [14, '×', 2, '=', 28]);
console.log('Operation path checks passed: visible steps, editable choices, dependent results, and explicit submission.');
