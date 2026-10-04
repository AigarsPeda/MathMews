/** Regression checks for per-instance power, save reload, and menu stacking. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const states = [];
let stateIndex = 0;
const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useMemo: fn => fn(), useCallback: fn => fn, useEffect: () => {},
  useRef: current => ({ current }),
  useState: initial => {
    const index = stateIndex++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
  },
};
const shared = () => ({ get: () => 0, set() {} });
const mocks = {
  '@/pet-display/registry/dog-video-registry': { getPetMediaRegistry: () => ({ getSegment: mood => ({ mood }) }) },
  '@/hooks/use-room-activity': { useRoomActivity: () => ({ activity: null, scale: shared(), bounce: shared(), facing: shared(), mouseX: shared(), mouseY: shared() }) },
  react: React,
  'react-i18next': { useTranslation: () => ({ t: key => key }) },
  'react-native': {
    View: 'View', Image: 'Image', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
    StyleSheet: { create: styles => styles, absoluteFill: {} },
    PanResponder: { create: handlers => ({ panHandlers: handlers }) },
  },
  'react-native-reanimated': {
    default: { View: 'AnimatedView' }, useReducedMotion: () => false,
    useAnimatedStyle: fn => ({ read: fn }),
    useSharedValue: initial => { let value = initial; return { get: () => value, set: next => { value = next; } }; },
  },
  '@/utils/scale': { moderateScale: value => value },
};
const cache = new Map();
function load(id) {
  if (id in mocks) return mocks[id];
  if (id.startsWith('@/components/') || id.startsWith('@/pet-display/components/')) {
    return new Proxy({}, { get: (_, name) => name });
  }
  if (!id.startsWith('@/') && !path.isAbsolute(id)) return new Proxy({}, { get: (_, name) => name });
  const file = id.startsWith('@/') ? path.join(root, id.slice(2)) : id;
  if (/\.(png|webp)$/.test(file)) return 1;
  const resolved = fs.existsSync(file) ? file : ['.ts', '.tsx', '.json'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (resolved.endsWith('.json')) return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} };
  cache.set(resolved, module);
  const source = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, React, require: load });
  return module.exports;
}
const placement = load('@/utils/room-placement');
const items = [
  { decorationId: 'officeAc', instanceId: 'ac-one', offset: { x: .3, y: -.4 }, wallFlipped: true, scale: 1.5 },
  { decorationId: 'officeAc', instanceId: 'ac-two', offset: { x: -.3, y: -.4 } },
  { decorationId: 'livingAirCon', instanceId: 'ac-three', offset: { x: 0, y: -.5 } },
  { decorationId: 'plantPotted', instanceId: 'plant', offset: { x: -.5, y: .4 } },
];
const powered = placement.togglePlacedAirConditionerByInstance(items, 'ac-one');
assert.equal(items[0].poweredOn, undefined, 'Toggle must not mutate the previous save');
assert.equal(powered[0].poweredOn, true);
assert.equal(powered[1], items[1], 'A second copy must retain its own power state');
assert.equal(powered[0].wallFlipped, true);
assert.equal(powered[0].scale, 1.5);
assert.equal(powered[0].offset, items[0].offset);
const restored = placement.normalizePlacedDecorations(JSON.parse(JSON.stringify(powered)));
assert.equal(restored[0].poweredOn, true, 'On state must survive save normalization');
assert.equal(restored[1].poweredOn, undefined, 'Existing saves start with the AC off');
assert.equal(placement.togglePlacedAirConditionerByInstance(restored, 'ac-one')[0].poweredOn, false);
assert.equal(placement.togglePlacedAirConditionerByInstance(items, 'ac-three')[2].poweredOn, true);
assert.equal(placement.togglePlacedAirConditionerByInstance(items, 'plant')[3], items[3], 'Only ACs support power');

const flatten = (node, ancestors = []) => !node?.props ? [] : [
  { node, ancestors },
  ...node.props.children.flat(Infinity).flatMap(child => flatten(child, [...ancestors, node])),
];
const style = input => Object.assign({}, ...[input].flat(Infinity).filter(Boolean).map(value => value.read ? value.read() : value));
const stage = load(path.join(root, 'components/pet/PetStage.tsx')).PetStage;
let toggled;
function render(placedDecorations = powered) {
  stateIndex = 0;
  return flatten(stage({
    name: 'Cat', petType: 'cat', compact: true, stats: { level: 1, hunger: 90, happiness: 90, cleanliness: 90 },
    wisdom: 90, playback: {}, speechMessage: 'Hello!', placedDecorations,
    onTogglePlacedAirConditioner: id => { toggled = id; },
    onMoveRoomLayerItem() {},
  }));
}
const first = render();
const ac = first.find(({ node }) => node.props.children?.[0]?.props?.decorationId === 'officeAc');
assert.ok(ac);
ac.node.props.onMenuAnchorLayout({ pageX: 270, pageY: 10, width: 48, height: 48 });
ac.node.props.onPetTap();
states[3] = { pageX: 0, pageY: 0, width: 320, height: 320 };
const opened = render();
const menu = opened.find(({ node }) => node.type === 'RoomItemActionMenu');
const speech = opened.find(({ node }) => node.type === 'PetSpeechBubble');
const menuLayer = menu.ancestors.at(-1);
const speechLayer = speech.ancestors.at(-1);
assert.equal(menuLayer.props.style.zIndex > speechLayer.props.style[0].zIndex, true, 'Menu must cover speech');
assert.equal(menu.ancestors.at(-2), speech.ancestors.at(-2), 'Both overlays must share a parent for reliable native stacking');
assert.ok(!menu.ancestors.some(node => node.props.onPanResponderMove), 'Menu must be outside the scaled scene');
assert.equal(menu.node.props.actions[0].label, 'home.turnOffAirConditioner');
menu.node.props.actions[0].onPress();
assert.equal(toggled, 'ac-one');
assert.equal(render(items).find(({ node }) => node.type === 'RoomItemActionMenu').node.props.actions[0].label, 'home.turnOnAirConditioner');

const sofa = { decorationId: 'sofaA', instanceId: 'sofa', offset: { x: .3, y: .1 } };
const normalRoom = render([sofa]);
const sofaNode = nodes => nodes.find(({ node }) => node.props.children?.[0]?.props?.decorationId === 'sofaA').node;
const catNode = nodes => nodes.find(({ node }) => node.type === 'DraggableRoomPet' && node.props.children?.[0]?.type === 'View').node;
assert.equal(sofaNode(normalRoom).props.allowDrag, false);
assert.equal(sofaNode(normalRoom).props.interactive, false, 'Furniture must not intercept petting');
assert.equal(catNode(normalRoom).props.allowDrag, false);
normalRoom.find(({ node }) => node.props.accessibilityLabel === 'home.decorateRoom').node.props.onPress();
const editingRoom = render([sofa]);
assert.equal(sofaNode(editingRoom).props.allowDrag, true);
assert.equal(sofaNode(editingRoom).props.interactive, true);
assert.equal(catNode(editingRoom).props.allowDrag, true);
assert.equal(catNode(editingRoom).props.onPetTap, undefined, 'Arranging the cat must not trigger care');
assert.equal(editingRoom.filter(({ node }) => node.type === 'PetSpeechBubble').length, 0);
editingRoom.find(({ node }) => node.props.accessibilityLabel === 'home.finishDecorating').node.props.onPress();
assert.equal(sofaNode(render([sofa])).props.allowDrag, false);
console.log('Verified explicit decorating, protected furniture taps, cat repositioning, and Done restoring normal interaction.');

const actionMenu = load(path.join(root, 'components/pet/RoomItemActionMenu.tsx')).RoomItemActionMenu;
states.length = 0; stateIndex = 0;
const bounds = { pageX: 0, pageY: 0, width: 320, height: 260 };
const nodes = flatten(actionMenu({
  actions: Array.from({ length: 8 }, (_, i) => ({ label: String(i), icon: 'north', onPress() {} })),
  anchorRect: { pageX: 300, pageY: 0, width: 48, height: 48 }, roomBounds: bounds,
}));
const anchor = style(nodes[0].node.props.style);
assert.ok(anchor.left >= 8 && anchor.left + anchor.width <= 312, 'Menu must fit horizontally near a wall');
assert.ok(anchor.top >= 8);
const scroll = nodes.find(({ node }) => node.type === 'ScrollView');
assert.ok(scroll.node.props.style.maxHeight + anchor.top + 6 <= 252, 'Long menus must fit vertically and scroll');
console.log('Verified independent AC power, save reload, toggled labels, shared overlay stacking, and small-room menu bounds.');

let activity = { active: true, reduceMotion: false };
let animationCount = 0;
const phases = [];
mocks['@/pet-display/media/sprite/use-sprite-clock'] = { useSpriteActivity: () => activity };
mocks.react.useEffect = fn => fn();
Object.assign(mocks['react-native-reanimated'], {
  Easing: { linear: value => value },
  cancelAnimation() {},
  withTiming: value => { animationCount++; return value; },
  withRepeat: value => value,
  useSharedValue: initial => {
    let value = initial;
    const shared = { get: () => value, set: next => { value = next; } };
    phases.push(shared);
    return shared;
  },
});
const motion = load(path.join(root, 'components/pet/RoomDecorationMotion.tsx')).RoomDecorationMotion;
const motionProps = { decorationId: 'officeAc', source: 1, size: 48, flipHorizontal: true, poweredOn: true };
const airflow = motion(motionProps);
assert.equal(animationCount, 1, 'Powered AC runs while the room is active');
assert.equal(airflow.props.style.transform[0].scaleX, -1, 'Airflow must mirror with the unit');
assert.equal(flatten(airflow).filter(({ node }) => typeof node.type === 'function').length, 3);
assert.equal(flatten(motion({ ...motionProps, poweredOn: false })).filter(({ node }) => typeof node.type === 'function').length, 0);
assert.equal(animationCount, 1, 'Powered-off AC must not run an animation');
activity = { active: false, reduceMotion: false };
motion(motionProps);
assert.equal(animationCount, 1, 'Hidden rooms must stop their loops');
activity = { active: true, reduceMotion: true };
const reduced = flatten(motion(motionProps));
assert.equal(animationCount, 1, 'Reduce Motion must stop the airflow loop');
const stream = reduced.find(({ node }) => typeof node.type === 'function').node;
assert.equal(style(stream.type(stream.props).props.style).opacity, .45, 'Reduced motion still shows a readable powered-on state');
activity = { active: true, reduceMotion: false };
const plant = flatten(motion({ ...motionProps, decorationId: 'plantPotted', size: 85, breezy: true }));
const foliage = plant.find(({ node }) => Array.isArray(node.props.style) && node.props.style.some(entry => entry?.read));
phases.at(-1).set(.25);
assert.equal(style(foliage.node.props.style).transform[0].skewX, '2deg');
const pot = plant.filter(({ node }) => node.type === 'Image').at(-1);
assert.ok(!pot.ancestors.includes(foliage.node), 'The pot must stay outside the animated foliage');
console.log('Verified active/off/hidden/reduced-motion states, mirrored airflow, and stationary pots.');
