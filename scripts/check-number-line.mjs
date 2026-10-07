/** Check one-number movement, range limits, and answer privacy before submission. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const jsx = (type, props) => ({ type, props });
const source = ts.transpileModule(fs.readFileSync('components/puzzle/NumberLineTask.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const flatten = node => {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!node || typeof node !== 'object') return [];
  return [node, ...flatten(node.props?.children)];
};

for (const locale of ['en', 'lv']) {
  const strings = JSON.parse(fs.readFileSync(`locales/${locale}.json`, 'utf8'));
  const translate = (key, params = {}) => key.split('.').reduce((value, part) => value[part], strings)
    .replace(/{{(\w+)}}/g, (_, name) => params[name]);
  const module = { exports: {} };
  const require = id => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'react-i18next') return { useTranslation: () => ({ t: translate }) };
    if (id === 'react-native') return { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: s => s } };
    if (id === '@/utils/scale') return { moderateScale: value => value };
    if (id === '@/constants/game') return { GameColors: {} };
    if (id === '@/components/puzzle/NumberLineTrack') return { NumberLineTrack: 'Track' };
    throw new Error(`Unexpected import: ${id}`);
  };
  vm.runInNewContext(source, { module, exports: module.exports, require });
  const { NumberLineTask } = module.exports;
  const puzzle = { payload: { min: -2, max: 15, start: 12, jump: -5, correctValue: 7 } };
  let selectedValue = null, answered = false;
  const render = () => flatten(NumberLineTask({
    puzzle, selectedValue, answered, isCorrect: false, onSelectValue: value => { selectedValue = value; },
  }));
  const button = key => render().find(node => node.type === 'Pressable' && node.props.accessibilityLabel === translate(key));
  const track = () => render().find(node => node.type === 'Track').props;
  assert.equal(track().value, 12, 'The marker begins at START');
  assert.equal(track().correctValue, undefined, 'No answer highlight before checking');
  assert.equal(track().hops, undefined, 'The puzzle never draws a solution path');
  button('puzzleTypes.numberLineMoveLeft').props.onPress();
  assert.equal(selectedValue, 11, 'A minus step moves exactly one number');
  button('puzzleTypes.numberLineMoveRight').props.onPress();
  assert.equal(selectedValue, 12, 'A plus step can undo the previous move');
  track().onSelect(9);
  assert.equal(track().value, 9, 'Direct number selection moves the marker too');
  assert.equal(answered, false, 'Selecting or moving never submits an answer');
  selectedValue = -2;
  assert.equal(button('puzzleTypes.numberLineMoveLeft').props.disabled, true, 'Cannot step below min');
  assert.equal(button('puzzleTypes.numberLineMoveRight').props.disabled, false);
  selectedValue = 15;
  assert.equal(button('puzzleTypes.numberLineMoveRight').props.disabled, true, 'Cannot step above max');
  assert.equal(button('puzzleTypes.numberLineMoveLeft').props.disabled, false);
  answered = true;
  assert.equal(track().disabled, true);
  assert.equal(track().correctValue, 7, 'The answer is shown only after submission');
  assert.equal(render().some(node => node.type === 'Pressable'), false, 'Submitted answers cannot be moved');
}
console.log('Number-line checks passed: localized one-step controls, bounds, editing, and answer privacy.');
