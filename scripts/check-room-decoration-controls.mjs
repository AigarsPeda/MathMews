/** Exercise the child's actual tool flow, callbacks and progressive disclosure. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const root = process.cwd();
let state = [], cursor = 0, language = 'en';
const locales = Object.fromEntries(['en', 'lv'].map(lang => [lang, JSON.parse(fs.readFileSync(`locales/${lang}.json`, 'utf8'))]));
const t = (key, values = {}) => {
  let value = key.split('.').reduce((value, part) => value?.[part], locales[language]);
  assert.equal(typeof value, 'string', `Missing ${language} translation: ${key}`);
  for (const [key, replacement] of Object.entries(values)) value = value.replaceAll(`{{${key}}}`, replacement);
  return value;
};
const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useState: initial => {
    const i = cursor++;
    if (!(i in state)) state[i] = initial;
    return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }];
  },
};
const native = { View: 'View', Text: 'Text', Pressable: 'Pressable', TextInput: 'TextInput', Keyboard: { dismiss() {} }, StyleSheet: { create: s => s } };
function loadComponent(file, exportName) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const mocks = {
    react: React, 'react-native': native,
    'react-i18next': { useTranslation: () => ({ t }) },
    '@/utils/scale': { moderateScale: value => value },
    '@/constants/game': { GameColors: {} },
    '@/components/ui/AppIcon': { AppIcon: 'AppIcon' },
    '@/components/pet/RoomActionMenu': { RoomActionMenu: 'RoomActionMenu' },
    '@/components/pet/RoomToolTransition': { RoomToolTransition: 'RoomToolTransition' },
    '@react-native-community/slider': { default: 'Slider', __esModule: true },
  };
  vm.runInNewContext(source, { module, exports: module.exports, React, require: id => {
    assert.ok(id in mocks, `Unexpected import: ${id}`); return mocks[id];
  } });
  return module.exports[exportName];
}
const controls = loadComponent('components/pet/RoomItemMoveControls.tsx', 'RoomItemMoveControls');
const rotation = loadComponent('components/pet/RoomRotationControls.tsx', 'RoomRotationControls');
const flatten = node => !node?.props ? [] : [node, ...node.props.children.flat(Infinity).flatMap(flatten)];
const text = node => typeof node === 'string' ? node : node?.props?.children.flat(Infinity).map(text).join('') ?? '';
let calls = [];
const action = (id, label, disabled = false) => ({ id, label, icon: 'rotate', disabled, onPress: () => calls.push(id ?? label) });
const actions = [action('turn', 'Turn'), action('size-up', 'Bigger'), action('size-down', 'Smaller', true), action('put-away', 'Put away'), action(undefined, 'Change look'), action('face-wall', 'Other wall')];
const props = { name: 'Woven bedside rug', picture: 'rug-preview', actions, onRotate: () => calls.push('rotate-preview'), onMove: direction => calls.push(direction), onDone: () => calls.push('place') };
const render = (component = controls, extra = {}) => { cursor = 0; return flatten(component({ ...props, ...extra })); };
const button = (nodes, label) => {
  const found = nodes.find(n => n.type === 'Pressable' && (n.props.accessibilityLabel === label || text(n) === label));
  assert.ok(found, `Button ${label} must be discoverable`); return found;
};
for (language of ['en', 'lv']) {
  state = []; calls = [];
  let nodes = render();
  assert.equal(nodes[0].props.panelKey, 'item', 'The item panel has a stable animation identity');
  assert.ok(nodes.some(n => n.type === 'Text' && text(n) === props.name), 'Show the selected furniture name');
  assert.equal(nodes.some(n => n.props.accessibilityLabel === t('home.moveItemleft', { name: props.name })), false, 'Nudges do not compete with dragging');
  const more = nodes.find(n => n.type === 'RoomActionMenu').props.actions;
  assert.equal(more.length, 2, 'Wall-facing is visible immediately rather than hidden in More');
  assert.equal(more[0].label, t('home.moveALittle'));
  assert.ok(more.every(a => !['turn', 'size-up', 'size-down', 'put-away', 'face-wall'].includes(a.id)));
  button(nodes, t('home.flipWall')).props.onPress();
  assert.deepEqual(calls, ['face-wall'], 'The visible wall control invokes the selected item’s wall action');
  calls = [];
  button(nodes, t('home.turnItem')).props.onPress();
  assert.deepEqual(calls, ['rotate-preview'], 'Turn opens a reversible preview, not an immediate save');
  button(nodes, t('home.itemSize')).props.onPress();
  nodes = render();
  assert.equal(nodes[0].props.panelKey, 'size', 'Opening Size transitions to the compact panel');
  assert.equal(button(nodes, 'Smaller').props.disabled, true, 'Resizing respects its lower limit');
  button(nodes, 'Bigger').props.onPress();
  assert.equal(calls.at(-1), 'size-up');
  button(nodes, t('common.back')).props.onPress();
  nodes = render();
  assert.equal(nodes[0].props.panelKey, 'item', 'Back transitions to the item panel');
  nodes.find(n => n.type === 'RoomActionMenu').props.actions[0].onPress();
  nodes = render();
  for (const direction of ['left', 'right', 'up', 'down']) button(nodes, t('home.moveItem' + direction, { name: props.name })).props.onPress();
  assert.deepEqual(calls.slice(-4), ['left', 'right', 'up', 'down'], 'Every accessible directional alternative remains usable');
  button(nodes, t('common.back')).props.onPress();
  button(render(), t('home.putAway')).props.onPress();
  assert.equal(calls.at(-1), 'put-away', 'The storage transaction owns selection cleanup after any group confirmation');
  state = [];
  button(render(), t('home.finishMoving', { name: props.name })).props.onPress();
  assert.equal(calls.at(-1), 'place');
  state = [];
  nodes = render(controls, { onFaceWall: () => calls.push('wall') });
  button(nodes, t('home.flipWall')).props.onPress();
  assert.equal(calls.at(-1), 'wall');
  assert.ok(!nodes.find(n => n.type === 'RoomActionMenu').props.actions.some(a => a.id === 'face-wall'), 'Windows do not repeat their wall action');
  assert.ok(!nodes.some(n => n.type === 'Pressable' && n.props.accessibilityLabel === t('home.turnItem')), 'Windows retain wall switching without unsupported free rotation');
  state = [];
  nodes = render(controls, { actions: actions.filter(a => a.id !== 'face-wall') });
  assert.ok(!nodes.some(n => n.type === 'Pressable' && n.props.accessibilityLabel === t('home.flipWall')), 'Ordinary floor items do not get a wall control');
}
language = 'en'; state = [];
let preview, committed, closed = false;
const rotateProps = { name: 'Chair', degrees: 350, simpleGraphics: false, onPreview: v => { preview = v; }, onCommit: v => { committed = v; }, onClose: () => { closed = true; } };
const rotate = extra => render(rotation, { ...rotateProps, ...extra });
let nodes = rotate();
assert.ok(!nodes.some(n => n.type === 'TextInput'), 'The first rotation view needs no numbers');
assert.ok(!nodes.some(n => n.type === 'Pressable' && [t('common.cancel'), t('home.applyRotation')].includes(text(n))), 'Rotation needs no Cancel or confirmation button');
button(nodes, t('home.turnRight')).props.onPress();
assert.equal(preview, 80, 'Quarter turns wrap through zero');
assert.equal(committed, 80, 'Quarter turns save immediately');
button(rotate(), t('home.turnLeft')).props.onPress();
assert.equal(committed, 350);
nodes = rotate();
nodes.find(n => n.props.accessibilityState?.expanded === false).props.onPress();
nodes = rotate();
assert.ok(nodes.some(n => n.type === 'TextInput'), 'Fine tune retains exact angle entry');
const slider = nodes.find(n => n.type === 'Slider');
slider.props.onValueChange(47.22);
assert.equal(preview, 47.2);
assert.equal(committed, 350, 'Slider motion does not create an Undo entry every frame');
slider.props.onSlidingComplete(47.22);
assert.equal(committed, 47.2);
button(rotate(), t('common.back')).props.onPress();
assert.equal(closed, true);
assert.equal(committed, 47.2, 'Leaving the tool does not revert its selected angle');
console.log('Verified EN/LV decoration controls and automatic turn saving without a confirmation step.');
