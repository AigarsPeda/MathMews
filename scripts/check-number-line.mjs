/** Check one-number movement, range limits, and answer privacy until success. */
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
  let selectedValue = null, answered = false, isCorrect = false;
  const render = () => flatten(NumberLineTask({
    puzzle, selectedValue, answered, isCorrect, onSelectValue: value => { selectedValue = value; },
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
  assert.equal(track().correctValue, undefined, 'An incorrect submission does not reveal the answer');
  assert.equal(track().wrongValue, selectedValue, 'The incorrect selection retains its feedback');
  assert.equal(render().some(node => node.type === 'Pressable'), false, 'Submitted answers cannot be moved');
  isCorrect = true;
  selectedValue = 7;
  assert.equal(track().correctValue, 7, 'A successful submission still highlights the answer');
  assert.equal(track().wrongValue, undefined, 'A successful submission has no incorrect marker');
}
// Exercise the actual track's animation requests, including direct taps that
// cross several numbers. The UI test separately checks physical hit regions.
const slots = [], animations = [];
let cursor = 0, effects = [], shared = [], markerStyle, reducedMotion = false;
const hook = create => { const index = cursor++; return slots[index] ??= create(); };
const strings = JSON.parse(fs.readFileSync('locales/en.json', 'utf8'));
const trackModule = { exports: {} };
const path = () => ({ moveTo() {}, lineTo() {}, quadTo() {}, close() {} });
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/puzzle/NumberLineTrack.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { module: trackModule, exports: trackModule.exports, require: id => {
  if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
  if (id === 'react') return {
    useRef: initial => hook(() => ({ current: initial })),
    useState: initial => { const state = hook(() => ({ value: initial })); return [state.value, value => { state.value = value; }]; },
    useMemo: fn => fn(), useEffect: fn => effects.push(fn),
  };
  if (id === 'react-native-reanimated') return { default: { View: 'Marker' }, Easing: { linear: n => n },
    useSharedValue: initial => { const value = hook(() => ({ value: initial })); shared.push(value); return value; },
    useReducedMotion: () => reducedMotion, useAnimatedStyle: fn => { markerStyle = fn; return {}; },
    withTiming: (to, options) => { animations.push({ to, ...options, fromPhase: shared[1].value }); return to; },
  };
  if (id === 'react-i18next') return { useTranslation: () => ({ t: (key, params = {}) => key.split('.').reduce((value, part) => value[part], strings).replace(/{{(\w+)}}/g, (_, name) => params[name]) }) };
  if (id === 'react-native') return { Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: s => s } };
  if (id === '@shopify/react-native-skia') return { Canvas: 'Canvas', Path: 'Path', Skia: { Path: { Make: path } } };
  if (id === '@/constants/game') return { GameColors: {} };
  if (id === '@/utils/scale') return { moderateScale: n => n };
  throw new Error(`Unexpected import: ${id}`);
} });
let value = 8;
const renderTrack = () => {
  cursor = 0; effects = []; shared = []; animations.length = 0;
  const tree = trackModule.exports.NumberLineTrack({ min: 2, max: 8, start: 8, value, onSelect: next => { value = next; } });
  effects.forEach(fn => fn()); return tree;
};
let tree = renderTrack();
tree.props.onLayout({ nativeEvent: { layout: { width: 350 } } });
tree = renderTrack();
assert.equal(animations.length, 0, 'Initial layout does not invent a jump');
tree.props.onTouchStart();
tree.props.onScrollBeginDrag();
flatten(tree).find(node => node.type === 'Pressable' && node.props.accessibilityLabel === 'Number 3').props.onPress();
assert.equal(value, 8, 'A swipe cannot select a number when its touch ends');
tree.props.onTouchStart();
flatten(tree).find(node => node.type === 'Pressable' && node.props.accessibilityLabel === 'Number 5').props.onPress();
renderTrack();
assert.equal(animations.length, 2, 'Direct selection animates both travel and height');
assert.equal(animations[0].to, 3, '8 to 5 shows three one-number hops');
assert.equal(animations[0].duration, animations[1].duration, 'The hops stay synchronized with horizontal travel');
const directDuration = animations[0].duration;
for (const phase of [.5, 1.5, 2.5]) {
  shared[1].value = phase;
  assert.ok(markerStyle().transform[1].translateY < 0, 'Every hop stays above the line');
}
shared[1].value = 3;
assert.ok(Math.abs(markerStyle().transform[1].translateY) < 1e-8, 'The final hop lands on the line');
shared[1].value = 1.5;
value = 6; renderTrack();
assert.equal(animations[0].to, 1, 'The step button still animates one hop');
assert.equal(animations[0].duration, 600, 'Single-step timing is preserved');
assert.equal(animations[0].fromPhase, .5, 'Retargeting preserves the visible height of an unfinished hop');
assert.ok(directDuration < 3 * 600, 'Direct selection remains quicker than pressing the step button repeatedly');
reducedMotion = true; value = 2; renderTrack();
assert.equal(animations.length, 0, 'Reduce Motion selects immediately without hopping');
console.log('Number-line checks passed: localized controls, bounds, direct selection, one-hop-per-number animation, interruption, Reduce Motion, and answer privacy.');
