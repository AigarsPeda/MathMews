/** Verify the real native adapters preserve action labels and interaction guards. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const states = []; let stateIndex = 0;
const react = {
  useState(initial) {
    const index = stateIndex++;
    if (!(index in states)) states[index] = initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  },
};
const mocks = {
  react,
  'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
  'react-native': { View: 'View' },
  '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', Menu: 'Menu', RNHostView: 'RNHostView', Section: 'Section' },
  '@expo/ui/swift-ui/modifiers': Object.fromEntries(['accessibilityLabel', 'buttonStyle', 'disabled', 'frame'].map(name => [name, value => ({ name, value })])),
  '@expo/ui/community/menu': { MenuView: 'MenuView' },
  '@/components/ui/NativeActionMenu': { NativeActionMenu: 'NativeActionMenu' },
};
function load(file) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: id => {
    assert.ok(id in mocks, id); return mocks[id];
  } });
  return module.exports;
}
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node?.props ? [node, ...nodes(node.props.children)] : [];
}

const { RoomActionMenu } = load('components/pet/RoomActionMenu.tsx');
let selections = 0;
const roomProps = {
  label: 'Cat actions', children: { type: 'View', props: {} },
  actions: [
    { label: 'Sleep on the sofa', icon: 'weekend', emoji: '😴', onPress() { selections++; } },
    { label: 'Make bigger', icon: 'zoom-in', disabled: true, onPress() { selections++; } },
    { label: 'Remove', icon: 'delete-outline', destructive: true, onPress() { selections++; } },
  ],
};
let trigger = RoomActionMenu(roomProps);
trigger.props.onLayout({ nativeEvent: { layout: { width: 140, height: 44 } } });
stateIndex = 0;
const menu = nodes(RoomActionMenu(roomProps)).find(node => node.type === 'NativeActionMenu');
assert.equal(menu.props.width, 140); assert.equal(menu.props.height, 44);
assert.equal(menu.props.actions[0].title, '😴 Sleep on the sofa', 'Colorful emoji must precede the localized label');
assert.equal(menu.props.actions[2].title, '🗑️ Remove');
assert.equal(menu.props.actions[2].attributes.destructive, true);
assert.ok(menu.props.actions.every(action => !action.image), 'Emoji labels must not also draw monochrome system symbols');
menu.props.onSelect('1'); menu.props.onSelect('unknown');
assert.equal(selections, 0, 'Disabled and unknown actions must do nothing');
menu.props.onSelect('0'); assert.equal(selections, 1);
stateIndex = 0;
const blocked = nodes(RoomActionMenu({ ...roomProps, blocked: true })).find(node => node.type === 'NativeActionMenu');
blocked.props.onSelect('0'); assert.equal(selections, 1);

for (const platform of ['ios', 'android']) {
  const file = platform === 'ios' ? 'components/ui/NativeActionMenu.ios.tsx' : 'components/ui/NativeActionMenu.tsx';
  const { NativeActionMenu } = load(file);
  const props = { ...menu.props, onSelect() { selections++; } };
  for (const blocked of [false, true]) {
    const tree = nodes(NativeActionMenu({ ...props, blocked }));
    const before = selections;
    if (platform === 'ios') {
      const buttons = tree.filter(node => node.type === 'Button');
      assert.equal(buttons[0].props.label, '😴 Sleep on the sofa');
      assert.equal(buttons[2].props.role, 'destructive');
      assert.equal(buttons[1].props.modifiers[0].value, true);
      buttons[1].props.onPress(); assert.equal(selections, before);
      buttons[0].props.onPress();
    } else {
      const native = tree.find(node => node.type === 'MenuView');
      native.props.onPressAction({ nativeEvent: { event: '1' } }); assert.equal(selections, before);
      native.props.onPressAction({ nativeEvent: { event: 'unknown' } }); assert.equal(selections, before);
      native.props.onPressAction({ nativeEvent: { event: '0' } });
    }
    assert.equal(selections, before + (blocked ? 0 : 1), `${platform} must dispatch enabled actions only`);
  }
}
console.log('Verified native iOS/Android menu adapters, colorful labels, measured triggers, destructive styling and disabled-action guards.');
