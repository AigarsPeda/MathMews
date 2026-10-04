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
const shared = (initial = 0) => { let value = initial; return { get: () => value, set: next => { value = next; } }; };
let roomActivityForTest = null, requestedActivity, returnedHome = 0, roomActivityEnabled;
const objectX = shared(), objectY = shared(), objectRotation = shared();
const mocks = {
  '@/pet-display/registry/dog-video-registry': { getPetMediaRegistry: () => ({ getSegment: mood => ({ mood }) }) },
  '@/hooks/use-room-activity': { useRoomActivity: (_, enabled) => {
    roomActivityEnabled = enabled;
    return { activity: roomActivityForTest, scale: shared(1), facing: shared(1), objectX, objectY, objectRotation, returnHome() { returnedHome++; }, startActivity(kind) { requestedActivity = kind; } };
  } },
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
    useDerivedValue: fn => ({ get: fn }),
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
function render(placedDecorations = powered, extra = {}) {
  stateIndex = 0;
  return flatten(stage({
    name: 'Cat', petType: 'cat', compact: true, stats: { level: 1, hunger: 90, happiness: 90, cleanliness: 90 },
    wisdom: 90, playback: {}, speechMessage: 'Hello!', placedDecorations,
    onTogglePlacedAirConditioner: id => { toggled = id; },
    onMoveRoomLayerItem() {},
    ...extra,
  }));
}
const first = render();
const decorationNode = (nodes, id) => nodes.find(({ node }) => node.type === 'DraggableRoomPet' && flatten(node).some(({ node: child }) => child.props.decorationId === id));
const ac = decorationNode(first, 'officeAc');
assert.ok(ac);
const menu = ac.node.props.menuActions;
assert.equal(menu[0].label, 'home.turnOffAirConditioner');
menu[0].onPress();
assert.equal(toggled, 'ac-one');
assert.equal(decorationNode(render(items), 'officeAc').node.props.menuActions[0].label, 'home.turnOnAirConditioner');

const sofa = { decorationId: 'sofaA', instanceId: 'sofa', offset: { x: .3, y: .1 } };
const normalRoom = render([sofa]);
const sofaNode = nodes => decorationNode(nodes, 'sofaA').node;
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
editingRoom.find(({ node }) => node.props.accessibilityLabel === 'home.roomTools').node.props.onPress();
let moved;
const moveProps = { onPlacedDecorationOffsetChange: (id, offset) => { moved = { id, offset }; } };
const picker = render([sofa], moveProps).find(({ node }) => node.type === 'RoomEditorSheet').node;
assert.equal(picker.props.visible, true);
assert.ok(picker.props.items.every(item => item.picture), 'Every item must have a recognizable picture');
picker.props.onSelect(picker.props.items[0].item);
const selectedRoom = render([sofa], moveProps);
assert.equal(selectedRoom.find(({ node }) => node.type === 'RoomEditorSheet').node.props.visible, false, 'Choosing an item returns to the visible room');
assert.equal(sofaNode(selectedRoom).props.selected, true, 'Highlight the one item being moved');
assert.equal(selectedRoom.some(({ node }) => node.type === 'RoomActionMenu'), false, 'Choosing an item must not open an unrelated action menu');
const moveControls = selectedRoom.find(({ node }) => node.type === 'RoomItemMoveControls').node;
moveControls.props.onMove('left');
assert.equal(moved.id, sofa.instanceId);
assert.ok(Math.abs(moved.offset.x - .2) < 1e-9);
assert.equal(moved.offset.y, .1, 'Move only the selected item on the requested axis');
moveControls.props.onDone();
assert.equal(render([sofa]).some(({ node }) => node.type === 'RoomItemMoveControls'), false);
assert.equal(sofaNode(render([sofa])).props.allowDrag, true, 'Done moving retains decoration mode');
editingRoom.find(({ node }) => node.props.accessibilityLabel === 'home.finishDecorating').node.props.onPress();
assert.equal(sofaNode(render([sofa])).props.allowDrag, false);
console.log('Verified explicit decorating, protected furniture taps, cat repositioning, and Done restoring normal interaction.');
console.log('Verified picture selection closes the picker, highlights one item, and moves it with the room visible.');

states[1] = { width: 320, height: 320 };
const ball = { toyId: 'blueBall', instanceId: 'ball', offset: { x: .3, y: .4 } };
let petTaps = 0;
const extra = { placedToys: [ball], ownedToyIds: ['mouse'], onPetPress: () => petTaps++ };
const catMenu = nodes => nodes.find(({ node }) => node.type === 'RoomActionMenu' && node.props.label === 'home.catActions').node;
const commandMenu = catMenu(render([sofa], extra));
assert.deepEqual(Array.from(commandMenu.props.actions, action => action.label), [
  'home.pet', 'home.catCommands.sofaSit', 'home.catCommands.sofaSleep', 'home.catCommands.toyPlay', 'home.catCommands.mouseChase',
]);
commandMenu.props.actions.find(action => action.label === 'home.catCommands.sofaSleep').onPress();
assert.equal(requestedActivity, 'sofaSleep');
for (const zoom of [2, 3]) {
  render([sofa], extra).find(({ node }) => node.props.accessibilityValue).node.props.onPress();
  const zoomedMenu = catMenu(render([sofa], extra));
  assert.equal(zoomedMenu.props.blocked, false, `Cat actions must remain tappable at ${zoom}x zoom`);
  assert.equal(roomActivityEnabled, true, 'Zoom must allow the selected room animation to run');
  requestedActivity = null;
  zoomedMenu.props.actions.find(action => action.label === 'home.catCommands.sofaSleep').onPress();
  assert.equal(requestedActivity, 'sofaSleep');
  assert.equal(render([sofa], extra).find(({ node }) => node.props.accessibilityValue).node.props.accessibilityLabel,
    zoom === 3 ? 'home.resetZoom' : 'home.zoomCat', 'Choosing a command must preserve the zoom');
}
assert.equal(catMenu(render([sofa], { ...extra, roomActivityBlocked: true })).props.blocked, true,
  'Care animations still block overlapping cat commands');
assert.equal(roomActivityEnabled, false);
render([sofa], extra).find(({ node }) => node.props.accessibilityLabel === 'home.resetZoom').node.props.onPress();
console.log('Verified native Cat actions dispatch commands at 2x and 3x zoom while care remains protected.');
const planner = load('@/utils/room-activities');
const room = { width: 320, height: 320, petSize: 120, sizeScale: 1, homeOffset: { x: 0, y: .12 },
  decorations: [sofa], toys: [ball], ownedToyIds: ['mouse'], hungry: false, asleep: false };
roomActivityForTest = { plan: planner.buildRoomActivity(room, 0, 'toyPlay'), stepIndex: 1 };
objectX.set(45); objectY.set(60); objectRotation.set(150);
const playingRoom = render([sofa], extra);
const movingBall = playingRoom.find(({ node }) => node.type === 'DraggableRoomPet' && flatten(node).some(({ node: child }) => child.props.toyId === 'blueBall')).node;
assert.equal(movingBall.props.initialOffset, ball.offset, 'Object motion must retain the saved placement');
assert.equal(movingBall.props.animatedPosition.x.get(), 45);
assert.equal(style(movingBall.props.children[0].props.style).transform[0].rotate, '150deg');
catNode(playingRoom).props.onPetTap();
assert.equal(returnedHome, 1, 'Touching an active cat requests a return');
assert.equal(petTaps, 0, 'Returning must not start a care animation that would interrupt walking');
const yarn = { decorationId: 'yarnRed', instanceId: 'yarn', offset: { x: .1, y: .4 } };
roomActivityForTest = { plan: planner.buildRoomActivity({ ...room, decorations: [yarn], toys: [] }, 0, 'toyPlay'), stepIndex: 1 };
const playingYarn = decorationNode(render([yarn], extra), 'yarnRed').node;
assert.equal(playingYarn.props.animatedPosition.y.get(), 60);
assert.equal(style(playingYarn.props.children[0].props.style).transform[0].rotate, '150deg');
roomActivityForTest = null;
console.log('Verified command menu eligibility, sleep command dispatch, returning instead of petting, and movement/rotation of actual placed balls and yarn.');

roomActivityForTest = { plan: planner.buildRoomActivity(room, 0, 'sofaSit'), stepIndex: 2 };
const beforeDecorate = returnedHome;
render([sofa]).find(({ node }) => node.props.accessibilityLabel === 'home.decorateRoom').node.props.onPress();
assert.equal(returnedHome, beforeDecorate + 1, 'Decorating asks the seated cat to get down first');
const waitingRoom = render([sofa]);
assert.equal(sofaNode(waitingRoom).props.allowDrag, false, 'Keep the occupied sofa in place during the return');
assert.equal(waitingRoom.find(({ node }) => node.props.accessibilityLabel === 'home.decorateRoom').node.props.disabled, true);
roomActivityForTest = null; render([sofa]);
assert.equal(sofaNode(render([sofa])).props.allowDrag, true, 'Decorating begins after the return finishes');
const post = { toyId: 'scratchPostRed', instanceId: 'post', offset: { x: .2, y: .3 }, scale: 1.5 };
const scaled = [];
const toyProps = { placedToys: [post], onScalePlacedToy: (id, direction) => scaled.push([id, direction]), onPlacedToyRemove() {} };
const postNode = render([sofa], toyProps).find(({ node }) => node.type === 'DraggableRoomPet' && flatten(node).some(({ node: child }) => child.props.toyId === post.toyId)).node;
assert.equal(postNode.props.petSize, 72, 'Render and drag bounds both use the saved scratching-post size');
const postMenu = postNode.props.menuActions;
assert.deepEqual(Array.from(postMenu, action => action.label), ['home.makeBigger', 'home.makeSmaller', 'home.removeFromRoom']);
postMenu[0].onPress(); postMenu[1].onPress();
assert.deepEqual(scaled, [['post', 'up'], ['post', 'down']]);
for (const [scale, disabledIndex] of [[2.2, 0], [.7, 1]]) {
  const actions = render([sofa], { ...toyProps, placedToys: [{ ...post, scale }] }).find(({ node }) => node.type === 'DraggableRoomPet' && flatten(node).some(({ node: child }) => child.props.toyId === post.toyId)).node.props.menuActions;
  assert.equal(actions[disabledIndex].disabled, true, 'Disable resizing beyond furniture limits');
}
console.log('Verified decorating waits for the cat, and scratching posts expose bounded resize controls.');

console.log('Verified independent AC power, save reload, toggled native menu labels and bounded room-item actions.');

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
