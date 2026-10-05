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
  'react-native': { View: 'View', Pressable: 'Pressable' },
  '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', Image: 'Image', Label: 'Label', Menu: 'Menu', RNHostView: 'RNHostView', Section: 'Section' },
  'expo-asset': { useAssets: sources => [sources.map(source => ({ localUri: `file:///icons/${source}.png` }))] },
  '@/constants/app-icons': { APP_ICON_SOURCES: { sleep: 1, 'zoom-in': 2, trash: 3 } },
  '@/constants/game': { GameColors: { primary: '#D52248' } },
  '@expo/ui/jetpack-compose': { Host: 'Host', Icon: 'Icon', RNHostView: 'RNHostView', Text: 'ComposeText', DropdownMenu: Object.assign('DropdownMenu', { Trigger: 'Trigger', Items: 'Items' }), DropdownMenuItem: Object.assign('DropdownMenuItem', { Text: 'ItemText', LeadingIcon: 'LeadingIcon' }) },
  '@expo/ui/swift-ui/modifiers': Object.fromEntries(['accessibilityLabel', 'buttonStyle', 'disabled', 'frame', 'resizable', 'aspectRatio'].map(name => [name, value => ({ name, value })])),
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
    { label: 'Sleep on the sofa', icon: 'sleep', onPress() { selections++; } },
    { label: 'Make bigger', icon: 'zoom-in', disabled: true, onPress() { selections++; } },
    { label: 'Remove', icon: 'trash', destructive: true, onPress() { selections++; } },
  ],
};
let trigger = RoomActionMenu(roomProps);
trigger.props.onLayout({ nativeEvent: { layout: { width: 140, height: 44 } } });
stateIndex = 0;
const menu = nodes(RoomActionMenu(roomProps)).find(node => node.type === 'NativeActionMenu');
assert.equal(menu.props.width, 140); assert.equal(menu.props.height, 44);
assert.equal(menu.props.actions[0].title, 'Sleep on the sofa', 'Localized labels remain plain text');
assert.equal(menu.props.actions[0].icon, 'sleep');
assert.equal(menu.props.actions[2].title, 'Remove');
assert.equal(menu.props.actions[2].attributes.destructive, true);
assert.ok(menu.props.actions.every(action => action.icon), 'Every native action carries a shared icon');
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
    stateIndex = 0;
    const tree = nodes(NativeActionMenu({ ...props, blocked }));
    const before = selections;
    if (platform === 'ios') {
      const buttons = tree.filter(node => node.type === 'Button');
      const label = buttons[0].props.children;
      assert.equal(label.props.title, 'Sleep on the sofa');
      assert.equal(label.props.icon.props.uiImage, 'file:///icons/1.png', 'SwiftUI receives a local raster file');
      assert.equal(label.props.icon.props.systemName, undefined, 'No templated system symbol replaces our art');
      assert.equal(buttons[2].props.role, 'destructive');
      assert.equal(buttons[1].props.modifiers[0].value, true);
      buttons[1].props.onPress(); assert.equal(selections, before);
      buttons[0].props.onPress();
    } else {
      const items = tree.filter(node => String(node.type) === 'DropdownMenuItem');
      const icons = tree.filter(node => node.type === 'Icon');
      assert.equal(icons[0].props.source, 1);
      assert.equal(icons[0].props.tint, null, 'Compose must preserve the original PNG colors');
      assert.equal(items[1].props.enabled, false);
      assert.equal(items[2].props.elementColors.textColor, '#D52248');
      items[1].props.onClick(); assert.equal(selections, before);
      items[0].props.onClick();
    }
    assert.equal(selections, before + (blocked ? 0 : 1), `${platform} must dispatch enabled actions only`);
  }
}
console.log('Verified native iOS/Android menu adapters, original-color raster artwork, measured triggers, destructive styling and disabled-action guards.');

mocks['react-native'].StyleSheet = { create: styles => styles };
mocks['react-native'].Text = 'Text';
mocks['react-i18next'] = { useTranslation: () => ({ t: key => key }) };
mocks['@/utils/scale'] = { moderateScale: value => value };
mocks['@/components/ui/AppIcon'] = { AppIcon: 'AppIcon' };
mocks['@/components/home/HomeActionContent'] = load('components/home/HomeActionContent.tsx');
mocks['@/constants/cat-play'] = load('constants/cat-play.ts');
const { ActivitiesMenuButton } = load('components/home/ActivitiesMenuButton.tsx');
states.length = 0; stateIndex = 0;
const played = [], commanded = [];
const activityProps = {
  disabled: false, onSelect: activity => played.push(activity.id),
  roomActions: [
    { label: 'Sit on the sofa', icon: 'sofa', onPress: () => commanded.push('sit') },
    { label: 'Go to your spot', icon: 'home', onPress: () => commanded.push('home') },
    { label: 'Unavailable', icon: 'sleep', disabled: true, onPress: () => commanded.push('unavailable') },
  ],
};
const activityTrigger = ActivitiesMenuButton(activityProps);
activityTrigger.props.onLayout({ nativeEvent: { layout: { width: 120, height: 72 } } });
activityTrigger.props.children.props.onLayout({ nativeEvent: { layout: { width: 120, height: 72 } } });
function activityMenu(extra = {}) {
  stateIndex = 0;
  return nodes(ActivitiesMenuButton({ ...activityProps, ...extra })).find(node => node.type === 'NativeActionMenu');
}
const combined = activityMenu();
assert.equal(combined.props.children.props.style[1].width, 120, 'The native menu label uses the full allocated button width, not its intrinsic text width');
activityTrigger.props.onLayout({ nativeEvent: { layout: { width: 100, height: 72 } } });
const resized = activityMenu();
assert.equal(resized.props.width, 100);
assert.equal(resized.props.children.props.style[1].width, 100, 'The visible button follows its container when the row resizes');
assert.equal(resized.props.height, 72, 'Width changes preserve the measured content height');
assert.equal(combined.props.label, 'home.a11yActivitiesMenu');
assert.equal(combined.props.title, 'home.activities');
assert.equal(combined.props.actions.length, 7, 'One dropdown contains all four games and the supplied room commands');
assert.equal(new Set(combined.props.actions.map(action => action.id)).size, 7, 'Game and room commands have distinct IDs');
for (const id of ['ball', 'box', 'yarn', 'feather']) combined.props.onSelect(`play:${id}`);
assert.deepEqual(played, ['ball', 'box', 'yarn', 'feather']);
combined.props.onSelect('room:0'); combined.props.onSelect('room:1');
combined.props.onSelect('room:2'); combined.props.onSelect('room:99'); combined.props.onSelect('play:unknown');
assert.deepEqual(commanded, ['sit', 'home'], 'The merged menu dispatches only valid, enabled room commands');
activityMenu({ disabled: true }).props.onSelect('play:ball');
activityMenu({ disabled: true }).props.onSelect('room:0');
assert.equal(played.length, 4); assert.equal(commanded.length, 2, 'Care blocks both groups');
assert.equal(activityMenu({ roomActions: [] }).props.actions.length, 4, 'Games remain available without room objects');
console.log('Verified the unified Activities dropdown, all game/room dispatch paths, eligibility, and care protection.');
