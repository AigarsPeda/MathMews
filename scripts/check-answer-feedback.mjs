/** Render answer feedback before the result sheet can cover it. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const jsx = (type, props) => ({ type, props });
const colors = { success: '#6BCB77', secondary: '#4ECDC4', cardBorder: '#FFE0CC' };
const mocks = {
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: styles => styles } },
  'react-i18next': { useTranslation: () => ({ t: key => key }) },
  './PuzzleObjectImage': { PuzzleObjectCollection: 'PuzzleObjectCollection' },
  '@/constants/game': { GameColors: colors },
  '@/utils/scale': { moderateScale: value => value },
};
function load(name) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(`components/puzzle/${name}.tsx`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: id => {
    assert.ok(id in mocks, id);
    return mocks[id];
  } });
  return module.exports[name];
}
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node?.props ? [node, ...nodes(node.props.children)] : [];
}
const buttons = tree => nodes(tree).filter(node => node.type === 'Pressable');
const border = button => Object.assign({}, ...button.props.style.filter(Boolean)).borderColor;

const cases = [
  ['CompareTask', { correctIndex: 1, payload: { optionA: '2 + 3', optionB: '3 + 4' } }],
  ['TrueFalseTask', { isTrue: false, payload: { statement: '2 + 3 = 7' } }],
  ['TrueFalseTask', { isTrue: true, payload: { statement: '2 + 3 = 5' } }, 0],
  ['FractionEquivalentTask', { correctIndex: 1, payload: { numerator: 1, denominator: 2, choices: ['1/3', '2/4', '3/5'] } }],
];
for (const [name, puzzle, correctIndex = 1] of cases) {
  const Task = load(name);
  const wrongIndex = correctIndex === 0 ? 1 : 0;
  let picked;
  const props = { puzzle: { id: 'feedback', ...puzzle }, onSelect: index => { picked = index; } };
  const render = (answered, isCorrect, selectedIndex) => buttons(Task({ ...props, answered, isCorrect, selectedIndex }));
  const editing = render(false, false, wrongIndex);
  assert.equal(editing.some(button => border(button) === colors.success), false, `${name}: editing does not reveal the answer`);
  editing[correctIndex].props.onPress();
  assert.equal(picked, correctIndex, `${name}: selecting a choice still works`);

  const incorrect = render(true, false, wrongIndex);
  assert.equal(incorrect.some(button => border(button) === colors.success), false, `${name}: an incorrect submission must not highlight the solution`);
  assert.equal(border(incorrect[wrongIndex]), '#FF9F43', `${name}: the incorrect choice retains its feedback`);
  assert.ok(incorrect.every(button => button.props.disabled), `${name}: submitted choices stay locked`);

  const correct = render(true, true, correctIndex);
  assert.equal(border(correct[correctIndex]), colors.success, `${name}: a successful answer still highlights the correct choice`);
  assert.equal(correct.filter(button => border(button) === colors.success).length, 1);
  assert.equal(render(false, false, null).some(button => border(button) === colors.success), false, `${name}: retry starts without a solution highlight`);
}

const PairSumTask = load('PairSumTask');
const pairProps = { puzzle: { id: 'pairs', payload: { numbers: [2, 8, 4, 6], target: 10, correctIndices: [0, 1] } }, onToggleIndex: () => {} };
const wrongPair = buttons(PairSumTask({ ...pairProps, selectedIndices: [0, 2], answered: true, isCorrect: false }));
assert.equal(wrongPair.some(button => border(button) === colors.success), false, 'An incorrect pair does not reveal either solution tile, even when one selected tile overlaps');
for (const index of [0, 2]) assert.equal(border(wrongPair[index]), '#FF9F43', 'The selected incorrect pair retains feedback');
for (const selectedIndices of [[0, 1], [2, 3]]) {
  const correctPair = buttons(PairSumTask({ ...pairProps, selectedIndices, answered: true, isCorrect: true }));
  assert.deepEqual(correctPair.flatMap((button, index) => border(button) === colors.success ? [index] : []), selectedIndices,
    'A successful pair highlights the selected solution, including an alternative valid pair');
}

console.log('Answer feedback checks passed: incorrect choices and pairs keep their feedback without revealing solutions; successful answers still highlight.');
