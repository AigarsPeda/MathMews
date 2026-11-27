/** Render answer feedback before the result sheet can cover it. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const jsx = (type, props) => ({ type, props });
const colors = { incorrect: '#C82E39', success: '#6BCB77', secondary: '#4ECDC4', cardBorder: '#FFE0CC' };
const mocks = {
  react: { Fragment: 'Fragment', useRef: current => ({ current }) },
  'react-native-reanimated': {},
  '@shopify/react-native-skia': {},
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { useWindowDimensions: () => ({ width: 393, height: 852, fontScale: 1 }), Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: styles => styles } },
  'react-i18next': { useTranslation: () => ({ t: key => key }) },
  './PlayProofCaption': { useProofViewport: () => null },
  './PuzzleObjectImage': { PuzzleObjectCollection: 'PuzzleObjectCollection' },
  '@/constants/puzzle-theme': { PuzzleColors: colors, Ink: {}, Shape: { lip: 3 }, Quantity: new Proxy({}, { get: () => ({}) }), Stroke: { outline: 2, major: 1.5, unit: 1, active: 2.5, unknown: 1.5 }, Radius: { control: 16, tray: 12, piece: 6 }, Motion: {} },
  '@/components/puzzle/PuzzleText': { PuzzleText: 'Text' },
  '@/utils/scale': { moderateScale: value => value },
};
function load(name) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(`components/puzzle/${name}.tsx`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  // Presentational children (fraction notation, strips, result marks) render as named stubs.
  vm.runInNewContext(source, { module, exports: module.exports, require: id => {
    if (id in mocks) return mocks[id];
    if (id === '@/utils/puzzle-math') {
      const math = { exports: {} };
      vm.runInNewContext(ts.transpileModule(fs.readFileSync('utils/puzzle-math.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
      }).outputText, { module: math, exports: math.exports });
      return math.exports;
    }
    assert.ok(id.startsWith('@/components/puzzle/') || id.startsWith('./'), id);
    return new Proxy({}, { get: (_, key) => String(key) });
  } });
  return module.exports[name];
}
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node?.props ? [node, ...nodes(node.props.children)] : [];
}
const buttons = tree => nodes(tree).filter(node => node.type === 'Pressable');
const flat = style => Array.isArray(style) ? Object.assign({}, ...style.flat(Infinity).filter(Boolean)) : typeof style === "function" ? flat(style({ pressed: false })) : style ?? {};
const border = button => flat(button.props.style).borderColor;

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
  assert.equal(border(incorrect[wrongIndex]), colors.incorrect, `${name}: the incorrect choice retains its feedback`);
  assert.ok(incorrect.every(button => button.props.disabled), `${name}: submitted choices stay locked`);

  const correct = render(true, true, correctIndex);
  assert.equal(border(correct[correctIndex]), colors.success, `${name}: a successful answer still highlights the correct choice`);
  assert.equal(correct.filter(button => border(button) === colors.success).length, 1);
  assert.equal(render(false, false, null).some(button => border(button) === colors.success), false, `${name}: retry starts without a solution highlight`);
}

const FractionEquivalentTask = load('FractionEquivalentTask');
const equivalentProps = {
  puzzle: { id: 'equivalent-playback', correctIndex: 0, payload: { numerator: 3, denominator: 5, choices: ['12/20', '11/20', '13/20'] } },
  AnswerRow: 'AnswerRow', onSelect: () => {}, playbackOwnsControls: true,
};
const checkedProof = jsx('CheckedProof', {});
const equivalentCorrect = nodes(FractionEquivalentTask({ ...equivalentProps, selectedIndex: 0, answered: true,
  isCorrect: true, checkedResult: 'correct', checkedModel: checkedProof }));
assert.ok(equivalentCorrect.includes(checkedProof), 'A correct equivalent-fraction check renders the hosted proof');
const equivalentWrong = nodes(FractionEquivalentTask({ ...equivalentProps, selectedIndex: 1, answered: false,
  isCorrect: false, incorrectAttempt: true, checkedResult: 'wrong' }));
const retainedGivens = nodes(FractionEquivalentTask({ ...equivalentProps, selectedIndex: 0, answered: true, isCorrect: true }));
for (const [name, tree, submitted] of [
  ['Editing', nodes(FractionEquivalentTask({ ...equivalentProps, playbackOwnsControls: false, selectedIndex: null, answered: false, isCorrect: false }))],
  ['Retained givens', retainedGivens],
  ['Incorrect submission', equivalentWrong, 11],
]) {
  const models = tree.filter(node => ['EquivalentBar', 'FractionStrip', 'TwentiethsStrip'].includes(node.type));
  assert.equal(models.length, 1, `${name} shows one bar`);
  const [bar] = models;
  assert.equal(bar.type, 'EquivalentBar');
  assert.equal(bar.props.given.numerator, 3);
  assert.equal(bar.props.given.denominator, 5);
  assert.equal(bar.props.denominator, 20);
  assert.equal(bar.props.submitted, submitted, `${name} shows the submitted numerator only on a miss`);
}
for (const tree of [equivalentCorrect, equivalentWrong, retainedGivens]) {
  assert.ok(!tree.some(node => ['AnswerRow', 'Pressable', 'TwentiethsStrip'].includes(node.type)),
    'Hosted playback owns the controls, including choices and group selectors');
}

const PairSumTask = load('PairSumTask');
const pairProps = { puzzle: { id: 'pairs', payload: { numbers: [2, 8, 4, 6], target: 10, correctIndices: [0, 1] } }, onToggleIndex: () => {} };
const wrongPair = buttons(PairSumTask({ ...pairProps, selectedIndices: [0, 2], answered: true, isCorrect: false }));
assert.equal(wrongPair.some(button => border(button) === colors.success), false, 'An incorrect pair does not reveal either solution tile, even when one selected tile overlaps');
for (const index of [0, 2]) assert.equal(border(wrongPair[index]), colors.incorrect, 'The selected incorrect pair retains feedback');
for (const selectedIndices of [[0, 1], [2, 3]]) {
  const correctPair = buttons(PairSumTask({ ...pairProps, selectedIndices, answered: true, isCorrect: true }));
  assert.deepEqual(correctPair.flatMap((button, index) => border(button) === colors.success ? [index] : []), selectedIndices,
    'A successful pair highlights the selected solution, including an alternative valid pair');
}

console.log('Answer feedback checks passed: incorrect choices and pairs keep their feedback without revealing solutions; successful answers still highlight.');
