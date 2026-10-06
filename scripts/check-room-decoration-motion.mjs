/** Regression checks for per-instance power, save reload, and menu stacking. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const states = [];
let stateIndex = 0;
let effects = [], roomCommands = [], cameraZoom = 1;
const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => effects.push(fn),
  useRef: current => ({ current }),
  useState: initial => {
    const index = stateIndex++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
  },
};
const shared = (initial = 0) => { let value = initial; return { get: () => value, set: next => { value = next; } }; };
let roomActivityForTest = null, requestedActivity, requestedInstanceId, doorArrival, returnedHome = 0, roomActivityEnabled;
const objectX = shared(), objectY = shared(), objectRotation = shared();
const mocks = {
  '@/hooks/use-room-camera': { useRoomCamera: () => ({ x: shared(), y: shared(), scale: shared(cameraZoom), zoom: cameraZoom, gesture: 'room-gesture', reset: () => { cameraZoom = 1; } }) },
  'react-native-gesture-handler': { GestureDetector: 'GestureDetector' },
  '@/pet-display/registry/media-registry': { getPetMediaRegistry: () => ({ getSegment: mood => ({ mood }) }) },
  '@/hooks/use-room-activity': { useRoomActivity: (_, enabled, _interaction, _x, _y, onArrival) => {
    doorArrival = onArrival;
    roomActivityEnabled = enabled;
    return { activity: roomActivityForTest, scale: shared(1), facing: shared(1), objectX, objectY, objectRotation, returnHome() { returnedHome++; }, startActivity(kind, instanceId) { requestedActivity = kind; requestedInstanceId = instanceId; } };
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
    withTiming: value => value,
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
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
  stateIndex = 0; effects = [];
  const nodes = flatten(stage({
    name: 'Cat', petType: 'cat', compact: true, stats: { level: 1, hunger: 90, happiness: 90, cleanliness: 90 },
    wisdom: 90, playback: {}, speechMessage: 'Hello!', placedDecorations,
    onTogglePlacedAirConditioner: id => { toggled = id; },
    onMoveRoomLayerItem() {},
    ...extra,
  }));
  effects.forEach(fn => fn());
  roomCommands = nodes.find(({ node }) => node.props.testID === "room-cat")?.node.props.menuActions ?? [];
  return nodes;
}
const first = render();
const decorationNode = (nodes, id) => nodes.find(({ node }) => node.type === 'DraggableRoomPet' && node.props.testID === 'room-object:' + (id === 'officeAc' ? 'ac-one' : id === 'sofaA' ? 'sofa' : id === 'yarnRed' ? 'yarn' : id === 'japaneseDoorAni' ? 'door-bath' : id));
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
const catNode = nodes => nodes.find(({ node }) => node.type === 'DraggableRoomPet' && node.props.testID === 'room-cat').node;
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

states[2] = { width: 320, height: 320 };
const ball = { toyId: 'blueBall', instanceId: 'ball', offset: { x: .3, y: .4 } };
let petTaps = 0;
const mouse = { toyId: 'mouse', instanceId: 'mouse', offset: { x: -.4, y: .4 } };
const extra = { placedToys: [ball, mouse], ownedToyIds: ['mouse'], onPetPress: () => petTaps++ };
const commandRoom = render([sofa], extra);
assert.equal(commandRoom.some(({ node }) => node.type === 'RoomActionMenu'), false, 'Cat commands use its direct native menu');
assert.deepEqual(Array.from(roomCommands, action => action.label), [
  'home.pet', 'home.catCommands.sofaSit', 'home.catCommands.sofaSleep', 'home.catCommands.toyPlay', 'home.catCommands.mouseChase',
]);
roomCommands.find(action => action.label === 'home.catCommands.sofaSleep').onPress();
assert.equal(requestedActivity, 'sofaSleep');
for (const zoom of [1.73, 2.6, 3]) {
  cameraZoom = zoom;
  assert.equal(sofaNode(render([sofa], extra)).props.interactive, true, 'Zoomed sofa hit targets stay enabled');
  assert.equal(roomActivityEnabled, true, 'Zoom must allow the selected room animation to run');
  requestedActivity = null;
  roomCommands.find(action => action.label === 'home.catCommands.sofaSleep').onPress();
  assert.equal(requestedActivity, 'sofaSleep');
  const nodes = render([sofa], extra);
  assert.equal(cameraZoom, zoom, 'Choosing a command must preserve the zoom');
  assert.equal(nodes.some(({ node }) => node.props.accessibilityLabel === 'home.resetZoom'), false,
    'The room must not show a zoom/reset button');
}
render([sofa], { ...extra, roomActivityBlocked: true });
assert.equal(roomActivityEnabled, false);
cameraZoom = 1;
console.log('Verified fractional zoom keeps sofa/object menus and cat commands enabled while care remains protected.');
const planner = load('@/utils/room-activities');
const room = { width: 320, height: 320, petSize: 120, sizeScale: 1, homeOffset: { x: 0, y: .12 },
  decorations: [sofa], toys: [ball], ownedToyIds: ['mouse'], hungry: false, asleep: false };
roomActivityForTest = { plan: planner.buildRoomActivity(room, 0, 'toyPlay'), stepIndex: 1 };
objectX.set(45); objectY.set(60); objectRotation.set(150);
const playingRoom = render([sofa], extra);
// Changing the camera while playing must preserve the active room animation.
let roomTouches = 0;
const zoomProps = { ...extra, onRoomInteraction: () => roomTouches++ };
const returnsBeforeZoom = returnedHome;
for (const zoom of [1.5, 2.73, 3]) {
  cameraZoom = zoom;
  const zoomed = render([sofa], zoomProps);
  assert.equal(cameraZoom, zoom, 'Rendering preserves the freely pinched view');
  assert.equal(returnedHome, returnsBeforeZoom, 'Zoom touches must not send the playing cat home');
  assert.equal(roomTouches, 0, 'Zoom must not record an interaction that cancels the action');
  assert.equal(roomActivityEnabled, true, 'Zoom must keep room activity enabled');
  assert.equal(zoomed.find(({ node }) => node.type === 'NativeRoomScene').node.props.playback.mood,
    roomActivityForTest.plan.steps[1].mood, 'Zoom must preserve the playing animation');
}
render([sofa], zoomProps).find(({ node }) => node.type === 'NativeRoomScene').ancestors.at(-1).props.onPress();
assert.equal(returnedHome, returnsBeforeZoom + 1, 'Touching the room scene still requests a return');
assert.equal(roomTouches, 1, 'Scene touches still record room interaction');
console.log('Verified fractional camera zoom preserves playing animations while scene taps still request a return.');
playingRoom.find(({ node }) => node.type === 'NativeRoomScene').node.props.onObjectPosition('ball', { x: 45, y: 60 });
const movingBall = render([sofa], extra).find(({ node }) => node.type === 'DraggableRoomPet' && node.props.testID === 'room-object:ball').node;
assert.equal(movingBall.props.initialOffset, ball.offset, 'Object motion must retain the saved placement');
assert.equal(movingBall.props.externalPosition.x, 45);
assert.equal(playingRoom.find(({ node }) => node.type === 'NativeRoomScene').node.props.playingId, 'ball');
catNode(playingRoom).props.menuActions.find(action => action.label === "home.catCommands.returnHome").onPress();
assert.equal(returnedHome, returnsBeforeZoom + 2, 'Touching an active cat requests a return');
assert.equal(petTaps, 0, 'Returning must not start a care animation that would interrupt walking');
const yarn = { decorationId: 'yarnRed', instanceId: 'yarn', offset: { x: .1, y: .4 } };
roomActivityForTest = { plan: planner.buildRoomActivity({ ...room, decorations: [yarn], toys: [] }, 0, 'toyPlay'), stepIndex: 1 };
const yarnRoom = render([yarn], extra);
yarnRoom.find(({ node }) => node.type === 'NativeRoomScene').node.props.onObjectPosition('yarn', { x: 45, y: 60 });
const playingYarn = decorationNode(render([yarn], extra), 'yarnRed').node;
assert.equal(playingYarn.props.externalPosition.y, 60);
assert.equal(yarnRoom.find(({ node }) => node.type === 'NativeRoomScene').node.props.playingId, 'yarn');
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
const postNode = render([sofa], toyProps).find(({ node }) => node.type === 'DraggableRoomPet' && node.props.testID === 'room-object:post').node;
assert.equal(postNode.props.petSize, 72, 'Render and drag bounds both use the saved scratching-post size');
const postMenu = postNode.props.menuActions;
assert.deepEqual(Array.from(postMenu, action => action.label), ['home.makeBigger', 'home.makeSmaller', 'home.removeFromRoom']);
postMenu[0].onPress(); postMenu[1].onPress();
assert.deepEqual(scaled, [['post', 'up'], ['post', 'down']]);
for (const [scale, disabledIndex] of [[2.2, 0], [.7, 1]]) {
  const actions = render([sofa], { ...toyProps, placedToys: [{ ...post, scale }] }).find(({ node }) => node.type === 'DraggableRoomPet' && node.props.testID === 'room-object:post').node.props.menuActions;
  assert.equal(actions[disabledIndex].disabled, true, 'Disable resizing beyond furniture limits');
}
console.log('Verified decorating waits for the cat, and scratching posts expose bounded resize controls.');

console.log('Verified independent AC power, save reload, toggled native menu labels and bounded room-item actions.');

// Door menus dispatch a journey before changing rooms; objects select their own instance.
roomActivityForTest = null;
const finishPreviousEdit = render().find(({ node }) => node.props.accessibilityLabel === 'home.finishDecorating');
finishPreviousEdit?.node.props.onPress();
const homeDoor = { decorationId: 'japaneseDoorAni', instanceId: 'door-bath', doorDestination: 'bathroom', offset: { x: -.5, y: -.3 } };
let visited, assigned;
const houseProps = { homeRoomId: 'livingRoom', onVisitHomeRoom: id => { visited = id; },
  onAssignRoomDoor: (id, destination) => { assigned = { id, destination }; } };
const house = render([homeDoor], houseProps);
const doorway = decorationNode(house, homeDoor.decorationId).node;
assert.equal(doorway.props.interactive, true);
assert.equal(doorway.props.menuActions[0].label, 'home.goToRoom');
doorway.props.menuActions[0].onPress();
assert.equal(requestedActivity, 'doorTravel');
assert.equal(requestedInstanceId, homeDoor.instanceId);
assert.equal(visited, undefined, 'A menu selection walks first');
doorArrival(homeDoor.instanceId);
assert.equal(visited, 'bathroom', 'Arrival opens the assigned room');
const blockedDoor = decorationNode(render([homeDoor], { ...houseProps, roomActivityBlocked: true }), homeDoor.decorationId).node;
assert.equal(blockedDoor.props.interactive, false, 'Care blocks room travel');
const directToy = render([], { placedToys: [ball] }).find(({ node }) => node.type === 'DraggableRoomPet' && node.props.testID === 'room-object:ball').node;
directToy.props.menuActions[0].onPress();
assert.equal(requestedActivity, 'toyPlay');
assert.equal(requestedInstanceId, ball.instanceId);
const houseEditor = render([homeDoor], houseProps);
houseEditor.find(({ node }) => node.props.accessibilityLabel === 'home.decorateRoom').node.props.onPress();
const editableDoor = decorationNode(render([homeDoor], houseProps), homeDoor.decorationId).node;
const destinations = editableDoor.props.menuActions.filter(action => action.label === 'home.doorLeadsTo');
assert.equal(destinations.length, 3);
assert.equal(destinations[1].disabled, true, 'The current destination is already selected');
destinations[0].onPress();
assert.equal(assigned.id, homeDoor.instanceId);
assert.equal(assigned.destination, 'bedroom');
render([homeDoor], houseProps).find(({ node }) => node.props.accessibilityLabel === 'home.finishDecorating').node.props.onPress();
console.log('Verified native doorway journey dispatch, arrival routing, care protection, destination reassignment, and direct toy selection.');

let meals = 0, played;
const bowl = { decorationId: 'bowlBlue', instanceId: 'bowl', offset: { x: .5, y: .15 } };
const mealProps = { onFeed: () => meals++, onPetPress: () => petTaps++, onPlay: activity => { played = activity.id; } };
roomActivityForTest = null;
let mealMenu = catNode(render([bowl], mealProps)).props.menuActions;
assert.equal(catNode(render([bowl], mealProps)).props.onPetTap, undefined, 'Cat taps open the native menu directly');
mealMenu.find(action => action.label === 'home.catCommands.bowlEat').onPress();
assert.equal(requestedActivity, 'bowlEat');
assert.equal(meals, 0, 'Selecting Eat does not grant hunger before the journey');
mealMenu.find(action => action.label === 'home.pet').onPress();
assert.equal(petTaps, 1, 'Petting stays available in the cat menu');
mealMenu.find(action => action.label === 'home.playStyle.feather').onPress();
assert.equal(played, 'feather', 'Former footer games remain in the cat menu');
const bowlNode = decorationNode(render([bowl], mealProps), 'bowl').node;
bowlNode.props.menuActions[0].onPress();
assert.equal(requestedInstanceId, 'bowl', 'The bowl menu selects that exact bowl');
assert.equal(catNode(render([], mealProps)).props.menuActions.some(action => action.label === 'home.catCommands.bowlEat'), false);
const fullProps = { ...mealProps, stats: { level: 1, hunger: 100, happiness: 90 } };
assert.equal(catNode(render([bowl], fullProps)).props.menuActions.find(action => action.label === 'home.catCommands.bowlEat').disabled, true);
assert.equal(catNode(render([bowl], { ...mealProps, roomActivityBlocked: true })).props.menuActions.find(action => action.label === 'home.catCommands.bowlEat').disabled, true);
roomActivityForTest = { plan: planner.buildRoomActivity({ ...room, decorations: [bowl] }, 0, 'bowlEat'), stepIndex: 1 };
assert.equal(catNode(render([bowl], mealProps)).props.menuActions.find(action => action.label === 'home.catCommands.bowlEat').disabled, true);
assert.equal(catNode(render([bowl], mealProps)).props.menuActions.find(action => action.label === 'home.playStyle.feather').disabled, true);
render([bowl], mealProps).find(({ node }) => node.props.accessibilityLabel === 'home.decorateRoom').node.props.onPress();
roomActivityForTest = null; render([bowl], mealProps); render([bowl], mealProps);
assert.equal(catNode(render([bowl], mealProps)).props.menuActions, undefined, 'Decorating keeps the cat draggable without care menus');
console.log('Verified direct cat and bowl menus, deferred feeding, retained pet/play actions, missing bowl, full hunger, busy meals, and decorating.');
