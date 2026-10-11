/** Regression checks for per-instance power, save reload, and menu stacking. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const states = [];
let stateIndex = 0, stateWrites = 0, drawingIndex = 0, refIndex = 0;
const drawingValues = [], refs = [];
let effects = [], roomCommands = [], cameraZoom = 1;
const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => effects.push(fn),
  useRef: current => refs[refIndex++] ??= { current },
  useState: initial => {
    const index = stateIndex++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], next => { stateWrites++; states[index] = typeof next === 'function' ? next(states[index]) : next; }];
  },
};
const shared = (initial = 0) => { let value = initial; return { get: () => value, set: next => { value = next; } }; };
let editingReady, stoppedForEditing = 0;
let roomActivityForTest = null, requestedActivity, requestedInstanceId, returnedHome = 0, roomActivityEnabled, activityOptionsForTest;
const objectX = shared(), objectY = shared(), objectRotation = shared();
const mocks = {
  '@/hooks/use-world-clock-now': { useWorldClockNow: () => Date.now() },
  'react-native-worklets-core': { useSharedValue: value => drawingValues[drawingIndex++] ??= { value } },
  "@/lib/graphics-mode": { useGraphicsMode: () => "3d" },
  '@/components/pet/RoomNavigation': { RoomNavigation: 'RoomNavigation', ROOM_NAVIGATION_HEIGHT: 52 },
  '@/hooks/use-room-camera': { useRoomCamera: () => ({ x: shared(), y: shared(), scale: shared(cameraZoom), zoom: cameraZoom, gesture: 'room-gesture', reset: () => { cameraZoom = 1; } }) },
  'react-native-gesture-handler': { GestureDetector: 'GestureDetector' },
  '@/pet-display/registry/media-registry': { getPetMediaRegistry: () => ({ getSegment: mood => ({ mood }) }) },
  '@/hooks/use-room-activity': { useRoomActivity: (options, enabled, _interaction, _x, _y, _onArrival, _feed, _roomArrival, _visible, _preserve, onStopped) => {
    activityOptionsForTest = options;
    editingReady = onStopped;
    roomActivityEnabled = enabled;
    return { activity: roomActivityForTest, scale: shared(1), facing: shared(1), objectX, objectY, objectRotation, returnHome() { returnedHome++; }, stopActivity() { stoppedForEditing++; }, startActivity(kind, instanceId) { requestedActivity = kind; requestedInstanceId = instanceId; } };
  } },
  react: React,
  'react-i18next': { useTranslation: () => ({ t: (key, options) => options?.room ? key + ':' + options.room : key }) },
  'react-native': {
    Keyboard: { dismiss() {} },
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
const powered = placement.togglePlacedDecorationPowerByInstance(items, 'ac-one');
assert.equal(items[0].poweredOn, undefined, 'Toggle must not mutate the previous save');
assert.equal(powered[0].poweredOn, true);
assert.equal(powered[1], items[1], 'A second copy must retain its own power state');
assert.equal(powered[0].wallFlipped, true);
assert.equal(powered[0].scale, 1.5);
assert.equal(powered[0].offset, items[0].offset);
const restored = placement.normalizePlacedDecorations(JSON.parse(JSON.stringify(powered)));
assert.equal(restored[0].poweredOn, true, 'On state must survive save normalization');
assert.equal(restored[1].poweredOn, undefined, 'Existing saves start with the AC off');
assert.equal(placement.togglePlacedDecorationPowerByInstance(restored, 'ac-one')[0].poweredOn, false);
assert.equal(placement.togglePlacedDecorationPowerByInstance(items, 'ac-three')[2].poweredOn, true);
assert.equal(placement.togglePlacedDecorationPowerByInstance(items, 'plant')[3], items[3], 'Non-powered furniture must remain unchanged');

const lamps = [
  { decorationId: 'lampFloorArc', instanceId: 'lamp-one', offset: { x: -.3, y: .1 }, rotationDegrees: 53, scale: 1.4 },
  { decorationId: 'lampFloorArc', instanceId: 'lamp-two', offset: { x: .4, y: .2 } },
];
const litLamps = placement.togglePlacedDecorationPowerByInstance(lamps, 'lamp-one');
assert.equal(lamps[0].poweredOn, undefined);
assert.equal(litLamps[0].poweredOn, true);
assert.equal(litLamps[1], lamps[1], 'Each lamp has an independent switch');
const savedLamps = placement.normalizePlacedDecorations(JSON.parse(JSON.stringify(litLamps)));
assert.equal(savedLamps[0].poweredOn, true, 'Lamp power survives save reload');
assert.equal(savedLamps[0].rotationDegrees, 53);
assert.equal(savedLamps[0].scale, 1.4);
const ghost = { decorationId: 'halloweenGhostLantern', instanceId: 'ghost', offset: { x: .2, y: .3 }, scale: .7 };
const litGhost = placement.togglePlacedDecorationPowerByInstance([ghost], 'ghost');
assert.equal(litGhost[0].poweredOn, true);
const savedGhost = placement.normalizePlacedDecorations(JSON.parse(JSON.stringify(litGhost)));
assert.equal(savedGhost[0].poweredOn, true, 'Ghost lantern power survives reload');
assert.equal(placement.togglePlacedDecorationPowerByInstance(savedGhost, 'ghost')[0].poweredOn, false);
const { lampLightConfig } = load('@/utils/native-lamp-light');
const { LAMP_LIGHT_ORIGINS, isWallSpotlightDecorationId } = load('@/constants/decoration-motion');
for (const modelId of Object.keys(LAMP_LIGHT_ORIGINS)) {
  const object = { modelId, poweredOn: true, position: [2, .1, 3], heading: Math.PI / 2, scale: 2 };
  const light = lampLightConfig(object), origin = LAMP_LIGHT_ORIGINS[modelId];
  assert.ok(light, `${modelId} supports light`);
  if (isWallSpotlightDecorationId(modelId)) {
    assert.equal(light.type, 'spot');
    assert.ok(light.direction[0] > 0 && light.direction[1] < 0, 'Wall spotlights tilt into the room');
    assert.ok(light.spotLightCone[0] < .5 && light.spotLightCone[1] > .8 && light.spotLightCone[1] < Math.PI / 2, 'Spotlights retain a focused core and a visible soft cone with a feathered edge');
    assert.equal(lampLightConfig({ ...object, poweredOn: false }), undefined);
    continue;
  }
  assert.ok(Math.abs(light.position[0] - (2 + origin[2] * 2)) < 1e-8);
  assert.ok(Math.abs(light.position[1] - (.1 + origin[1] * 2)) < 1e-8);
  assert.ok(Math.abs(light.position[2] - (3 - origin[0] * 2)) < 1e-8);
  assert.deepEqual(Array.from(light.direction), [0, -1, 0]);
  if (modelId.startsWith('lavaLamp') || modelId === 'halloweenGhostLantern') {
    assert.equal(light.type,'point','Lanterns light surrounding surfaces in every direction');
    if (modelId.startsWith('lavaLamp')) assert.ok(light.colorKelvin<2700,'Lava casts warm amber light');
  } else {
    assert.equal(light.type,'spot','Shaded lamps retain their downward light');
    assert.ok(light.spotLightCone[1]>1.4 && light.spotLightCone[1]<Math.PI/2,
      'The broad cone avoids the observed straight cutoff while staying below the shade');
    assert.ok(light.spotLightCone[0]<light.spotLightCone[1]-.5,'Lamp edges have a soft angular fade');
  }
  for (const scale of [.2,.5,1]) {
    const small=lampLightConfig({...object,scale});
    assert.ok(small.falloffRadius>=3,'Small lamps keep their light outside the visible clipping tiles');
    assert.ok(small.intensity>0 && small.intensity<light.intensity,'Resizing retains bounded light power');
  }
  assert.equal(lampLightConfig({ ...object, poweredOn: false }), undefined);
  assert.equal(lampLightConfig({ ...object, poweredOn: undefined }), undefined);
}
assert.equal(lampLightConfig({ modelId: 'plantPotted', poweredOn: true }), undefined);

const flatten = (node, ancestors = []) => !node?.props ? [] : [
  { node, ancestors },
  ...node.props.children.flat(Infinity).flatMap(child => flatten(child, [...ancestors, node])),
];
const style = input => Object.assign({}, ...[input].flat(Infinity).filter(Boolean).map(value => value.read ? value.read() : value));
const stage = load(path.join(root, 'components/pet/PetStage.tsx')).PetStage;
let toggled;
function render(placedDecorations = powered, extra = {}) {
  stateIndex = 0; drawingIndex = 0; refIndex = 0; effects = [];
  const nodes = flatten(stage({
    name: 'Cat', petType: 'cat', compact: true, stats: { level: 1, hunger: 90, happiness: 90, cleanliness: 90 },
    wisdom: 90, playback: {}, speechMessage: 'Hello!', placedDecorations,
    onTogglePlacedDecorationPower: id => { toggled = id; },
    onMoveRoomLayerItem() {},
    ...extra,
  }));
  effects.forEach(fn => fn());
  roomCommands = nodes.find(({ node }) => node.props.testID === "room-cat")?.node.props.menuActions ?? [];
  return nodes;
}
const first = render();
const misplacedWindow = { decorationId:'windowOakWide', instanceId:'window', offset:{x:-.15,y:.18} };
let repairedWindow;
const windowProps = { onPlacedDecorationOffsetChange:(id,offset) => { repairedWindow={id,offset}; } };
const unmeasuredWindowRoom = render([misplacedWindow], windowProps);
const measureWindowRoom = unmeasuredWindowRoom.find(({node}) => node.type === 'NativeRoomScene').ancestors
  .slice().reverse().find(node => node.props.onLayout).props.onLayout;
measureWindowRoom({nativeEvent:{layout:{width:320,height:320}}});
const windowRoom = render([misplacedWindow], windowProps);
const windowNode = windowRoom.find(({node}) => node.props.testID === 'room-object:window').node;
assert.equal(repairedWindow, undefined, 'An initial measurement cannot replace a saved window anchor');
const visibleWindow = windowRoom.find(({node}) => node.type === 'NativeRoomScene').node.props.world.objects[0];
assert.deepEqual(windowNode.props.initialOffset, visibleWindow.placementOffset, 'The editor selection box uses the corrected display anchor without saving it');
measureWindowRoom({nativeEvent:{layout:{width:0,height:0}}});
const decorationNode = (nodes, id) => nodes.find(({ node }) => node.type === 'DraggableRoomPet' && node.props.testID === 'room-object:' + (id === 'officeAc' ? 'ac-one' : id === 'sofaA' ? 'sofa' : id === 'yarnRed' ? 'yarn' : id === 'japaneseDoorAni' ? 'door-bath' : id));
const ac = decorationNode(first, 'officeAc');
assert.ok(ac);
const menu = ac.node.props.menuActions;
assert.equal(menu[0].label, 'home.turnOffDecoration');
menu[0].onPress();
assert.equal(toggled, 'ac-one');
assert.equal(decorationNode(render(items), 'officeAc').node.props.menuActions[0].label, 'home.turnOnDecoration');
const lampMenu = decorationNode(render(litLamps), 'lamp-one').node.props.menuActions;
assert.equal(lampMenu[0].label, 'home.turnOffDecoration');
lampMenu[0].onPress();
assert.equal(toggled, 'lamp-one');
assert.equal(decorationNode(render(lamps), 'lamp-two').node.props.menuActions[0].label, 'home.turnOnDecoration');
for (const decorationId of Object.keys(LAMP_LIGHT_ORIGINS)) {
  const lamp = { decorationId, instanceId: 'menu-lamp', poweredOn: true, offset:{x:0,y:0} };
  const normal = render([lamp], { onAimPlacedSpotlight() {}, onSetRoomItemRotation() {} });
  const actions = decorationNode(normal, 'menu-lamp').node.props.menuActions;
  assert.deepEqual(Array.from(actions, action => action.label), ['home.turnOffDecoration'], `${decorationId}: normal play offers only power`);
  assert.ok(!normal.some(({node}) => ['RoomRotationControls','RoomSpotlightControls'].includes(node.type)));
}
console.log('Verified every lamp offers only On/Off in normal play, including all wall spotlights.');
let toggledCurtain;
const curtain = { decorationId:'curtainRoseTieback', instanceId:'curtain', offset:{x:.3,y:-.3} };
const curtainProps = { onTogglePlacedCurtain:id => { toggledCurtain=id; } };
const closeCurtain = decorationNode(render([curtain],curtainProps),'curtain').node.props.menuActions;
assert.equal(decorationNode(render([curtain],curtainProps),'curtain').node.props.constrainToRoom,false,'Curtains bypass the square sprite drag limits');
assert.equal(decorationNode(first,'officeAc').node.props.constrainToRoom,true,'Other wall fixtures keep their drag bounds');
assert.equal(closeCurtain[0].label,'home.closeCurtains');
closeCurtain[0].onPress();
assert.equal(toggledCurtain,'curtain');
assert.equal(decorationNode(render([{...curtain,curtainOpen:false}],curtainProps),'curtain').node.props.menuActions[0].label,'home.openCurtains');
const shadeSwitches = render(litLamps).filter(({ node }) => node.type === 'RoomActionMenu' && node.props.label === 'home.lampSwitch');
assert.equal(shadeSwitches.length, 2, 'Overlapping lamps have focused shade targets');
assert.ok(shadeSwitches.every(({ node }) => node.props.size.width >= 32));
shadeSwitches[1].node.props.actions[0].onPress();
assert.equal(toggled, 'lamp-two');

const sofa = { decorationId: 'sofaA', instanceId: 'sofa', offset: { x: .3, y: .1 } };
let shopOpens = 0;
const combinedProps = { onOpenStore: () => { shopOpens++; } };
const furnitureMenu = nodes => nodes.find(({ node }) => node.type === 'RoomActionMenu' && node.props.label === 'home.shopAndDecorate').node;
const combinedMenu = furnitureMenu(render([sofa], combinedProps));
assert.deepEqual(Array.from(combinedMenu.props.actions, action => action.label), ['store.title', 'home.decorateRoom']);
combinedMenu.props.actions[0].onPress();
assert.equal(shopOpens, 1, 'The combined control opens the shop');
assert.ok(furnitureMenu(render([sofa], combinedProps)), 'Shopping does not start decorating');
combinedMenu.props.actions[1].onPress();
const combinedEditing = render([sofa], combinedProps);
assert.ok(!combinedEditing.some(({ node }) => node.props.label === 'home.shopAndDecorate'), 'Done replaces the combined menu while decorating');
combinedEditing.find(({ node }) => node.props.accessibilityLabel === 'home.finishDecorating').node.props.onPress();
assert.ok(furnitureMenu(render([sofa], combinedProps)), 'Done restores both furniture choices');
console.log('Verified combined shop/decorate menu, independent shopping, decoration entry and Done restoring the menu.');
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
const moveProps = { onPlacedDecorationOffsetChange: (id, offset) => { moved = { id, offset }; }, onPlacedDecorationRemove() {} };
const picker = render([sofa], moveProps).find(({ node }) => node.type === 'RoomEditorSheet').node;
assert.equal(picker.props.visible, true);
assert.ok(picker.props.items.every(item => item.picture), 'Every item must have a recognizable picture');
picker.props.onSelect(picker.props.items[0].item);
const selectedRoom = render([sofa], moveProps);
assert.equal(selectedRoom.find(({ node }) => node.type === 'RoomEditorSheet').node.props.visible, false, 'Choosing an item returns to the visible room');
assert.equal(sofaNode(selectedRoom).props.selected, true, 'Highlight the one item being moved');
assert.equal(selectedRoom.some(({ node }) => node.type === 'RoomActionMenu'), false, 'Choosing an item must not open an unrelated action menu');
const moveControls = selectedRoom.find(({ node }) => node.type === 'RoomItemMoveControls').node;
assert.ok(moveControls.props.actions.some(action => action.label === 'home.removeFromRoom'), 'Object options remain available beside the movement controls');
let appliedRotation;
const rotationProps = { ...moveProps, onSetRoomItemRotation: (item, degrees) => { appliedRotation = { item, degrees }; } };
const rotationControls = nodes => nodes.find(({ node }) => node.type === 'RoomRotationControls')?.node;
const roomWorld = nodes => nodes.find(({ node }) => node.type === 'NativeRoomScene').node.props.world;
const rotatableRoom = render([sofa], rotationProps);
rotatableRoom.find(({ node }) => node.type === 'RoomItemMoveControls').node.props.onRotate();
assert.ok(rotationControls(render([sofa], rotationProps)), 'Rotation opens inline while decorating');
assert.ok(!render([sofa], rotationProps).some(({node}) => node.type === 'RoomItemMoveControls'), 'The angle dock replaces movement controls');
rotationControls(render([sofa], rotationProps)).props.onPreview(37.5);
const previewRoom = render([sofa], rotationProps);
assert.ok(Math.abs(roomWorld(previewRoom).objects[0].heading - 37.5 * Math.PI / 180) < 1e-8, 'Slider preview uses an arbitrary angle in the native scene');
assert.equal(appliedRotation, undefined, 'Preview never writes to the saved layout');
rotationControls(previewRoom).props.onClose();
assert.equal(roomWorld(render([sofa], rotationProps)).objects[0].heading, 0, 'Cancel restores the saved orientation');
rotatableRoom.find(({ node }) => node.type === 'RoomItemMoveControls').node.props.onRotate();
rotationControls(render([sofa], rotationProps)).props.onApply(137.5);
assert.equal(appliedRotation.item.instanceId, 'sofa');
assert.equal(appliedRotation.degrees, 137.5);
assert.equal(rotationControls(render([sofa], rotationProps)), undefined, 'Apply returns to movement controls');
const spot = { decorationId:'spotlightChromePicture', instanceId:'aim-lamp', poweredOn:true, spotlightAngle:-25, offset:{x:.3,y:-.2} };
// Use an actual catalog ID rather than depending on a particular style name.
spot.decorationId = Object.keys(LAMP_LIGHT_ORIGINS).find(isWallSpotlightDecorationId);
let appliedAim;
const aimProps = { ...rotationProps, onAimPlacedSpotlight:(id,angle,swivel) => { appliedAim={id,angle,swivel}; } };
const aimControls = nodes => nodes.find(({node}) => node.type === 'RoomSpotlightControls')?.node;
const openAim = () => decorationNode(render([spot],aimProps),'aim-lamp').node.props.menuActions.find(action => action.label === 'home.aimSpotlight').onPress();
openAim();
let aiming = render([spot],aimProps);
const aimDock = aiming.find(({node}) => node.type === 'RoomSpotlightControls');
assert.ok(aimDock.ancestors.some(node => node.type === 'View' && style(node.props.style).bottom === 0), 'Aim lives in the inline dock below the viewport');
assert.ok(!rotationControls(aiming));
const aimValue = aiming.find(({node}) => node.type === 'NativeRoomScene').node.props.spotlightAim;
const writesBeforeAim = stateWrites;
aimControls(aiming).props.onPreview(55,-30);
assert.equal(stateWrites,writesBeforeAim,'Aiming frames do not schedule React state or rebuild the room');
assert.equal(aimValue.value.angle,55,'Aiming publishes the native drawing-thread target');
assert.equal(aimValue.value.swivel,-30,'Sideways head preview shares the same target');
assert.equal(roomWorld(render([spot],aimProps)).objects[0].spotlightAngle,-25,'The saved world stays stable throughout preview');
assert.equal(appliedAim,undefined,'Preview does not save');
aimControls(render([spot],aimProps)).props.onClose();
assert.equal(roomWorld(render([spot],aimProps)).objects[0].spotlightAngle,-25,'Cancel restores the saved beam');
assert.equal(roomWorld(render([spot],aimProps)).objects[0].spotlightSwivel,0,'Cancel restores the saved swivel');
openAim();
aimControls(render([spot],aimProps)).props.onApply(35,25);
assert.equal(appliedAim.id,'aim-lamp'); assert.equal(appliedAim.angle,35); assert.equal(appliedAim.swivel,25);
assert.ok(!aimControls(render([spot],aimProps)),'Apply returns to movement controls');
openAim();
render([spot],aimProps).find(({node})=>node.props.accessibilityLabel==='home.finishDecorating').node.props.onPress();
assert.ok(!aimControls(render([spot],aimProps)),'Finishing decoration cancels pending aim');
assert.equal(roomWorld(render([spot],aimProps)).objects[0].spotlightAngle,-25);
render([sofa],rotationProps).find(({node})=>node.props.accessibilityLabel==='home.decorateRoom').node.props.onPress();
rotatableRoom.find(({node})=>node.type==='RoomItemMoveControls').node.props.onRotate();
rotationControls(render([sofa],rotationProps)).props.onPreview(45);
render([sofa],rotationProps).find(({node})=>node.props.accessibilityLabel==='home.finishDecorating').node.props.onPress();
assert.equal(roomWorld(render([sofa],rotationProps)).objects[0].heading,0,'Done discards pending rotation');
render([sofa],rotationProps).find(({node})=>node.props.accessibilityLabel==='home.decorateRoom').node.props.onPress();
console.log('Verified decoration-only inline aim, live preview, Cancel, Apply and Done discarding unsaved angles.');
const everyKindRoom = render([sofa], { ...rotationProps, bedId: 'brown', placedToys: [{ toyId: 'scratchPostGreen', instanceId: 'rotating-toy', offset: { x: 0, y: 0 } }] });
for (const id of ['room-object:bed', 'room-object:sofa', 'room-object:rotating-toy']) {
  const node = everyKindRoom.find(({ node }) => node.props.testID === id)?.node;
  assert.ok(node?.props.menuActions.some(action => action.label === 'home.rotateItem'), `${id}: all item kinds offer free rotation`);
}
measureWindowRoom({nativeEvent:{layout:{width:320,height:320}}});
let flippedWindow;
const rotatedWindowProps = { ...windowProps, onSetRoomItemRotation() { assert.fail('Windows cannot open free rotation'); },
  onFlipPlacedDecorationWall(id) { flippedWindow=id; } };
const windowEditor = render([misplacedWindow], rotatedWindowProps);
const editableWindow=windowEditor.find(({node}) => node.props.testID === 'room-object:window').node;
assert.ok(!editableWindow.props.menuActions.some(action=>action.label==='home.rotateItem'),'Window options omit free rotation');
editableWindow.props.menuActions.find(action=>action.label==='home.flipWall').onPress();
assert.equal(flippedWindow,'window');
editableWindow.props.onDragStart();
const windowControls=render([misplacedWindow],rotatedWindowProps).find(({node})=>node.type==='RoomItemMoveControls').node;
assert.equal(windowControls.props.onRotate,undefined,'The window movement dock has no angle control');
flippedWindow=undefined;
windowControls.props.onFaceWall();
assert.equal(flippedWindow,'window','The movement dock switches wall orientation directly');
assert.ok(!rotationControls(render([misplacedWindow],rotatedWindowProps)),'Switching walls does not open an angle form');
measureWindowRoom({nativeEvent:{layout:{width:0,height:0}}});
// Restore the selected sofa for the existing movement assertions below.
picker.props.onSelect(picker.props.items[0].item);
console.log('Verified Rotate for beds, toys and furniture; local preview; Apply; Cancel; and window wall switches without free rotation.');
const hintSlot = editingRoom.find(({ node }) => node.props.children?.includes('home.decorateHint')).ancestors.at(-1);
const controlsSlot = selectedRoom.find(({ node }) => node.type === 'RoomItemMoveControls').ancestors.at(-1);
assert.equal(style(hintSlot.props.style).minHeight, style(controlsSlot.props.style).minHeight, 'Reserve the same space before and after selecting an item so dragging does not shift the room');
const statsPanel = nodes => nodes.find(({ node }) => node.type === 'PetStatsPanel');
const normalStats = statsPanel(normalRoom), editingStats = statsPanel(editingRoom), selectedStats = statsPanel(selectedRoom);
assert.equal(normalStats.node.props.visible, true, 'Visible play mode may reveal pending stat changes');
assert.equal(editingStats.node.props.visible, false, 'Decoration mode must not consume hidden stat changes');
assert.equal(statsPanel(render([sofa], { roomVisible: false })).node.props.visible, false, 'Cached inactive rooms must not animate their stats');
const footer = entry => entry.ancestors.at(-2);
assert.deepEqual(style(footer(normalStats).props.style), style(footer(editingStats).props.style), 'Entering decoration mode retains the same footer dimensions and room viewport');
assert.deepEqual(style(footer(normalStats).props.style), style(footer(selectedStats).props.style), 'Selecting an object does not resize the room');
const statsFootprint = style(footer(normalStats).props.style).minHeight;
const editingFootprint = style(controlsSlot.props.style).minHeight;
assert.equal(statsFootprint, 74, 'The play footer gives its unused space back to the scene');
assert.ok(editingFootprint <= statsFootprint + 52, 'The editing dock fits the footer plus the hidden room-navigation strip');
assert.equal(style(controlsSlot.props.style).bottom, 0, 'The taller editing dock grows upward without resizing the room');
const roomFrame = normalRoom.find(({ node }) => style(node.props.style).marginHorizontal < 0);
assert.equal(style(roomFrame.node.props.style).alignSelf, 'stretch');
assert.equal(style(roomFrame.node.props.style).width, undefined, 'The scene can expand through the card’s side insets');
assert.equal(style(editingStats.ancestors.at(-1).props.style).opacity, 0, 'Stats retain their measured height while hidden in decoration mode');
assert.notEqual(style(editingStats.ancestors.at(-1).props.style).display, 'none', 'Expanded stats must keep their layout space across modes');
assert.equal(editingStats.ancestors.at(-1).props.pointerEvents, 'none');
assert.equal(editingStats.ancestors.at(-1).props.accessibilityElementsHidden, true, 'Hidden stats cannot be tapped or announced');
assert.equal(style(controlsSlot.props.style).position, 'absolute', 'Movement controls share the stats footprint instead of taking additional room space');
measureWindowRoom({nativeEvent:{layout:{width:320,height:320}}});
for (const zoom of [1,2.5]) {
  cameraZoom=zoom;
  const nodes=render([{...sofa,scale:.8}],moveProps),world=roomWorld(nodes),object=world.objects.find(object=>object.instanceId===sofa.instanceId);
  const {NATIVE_MODEL_CATALOG,ROOM_SPAN}=load('@/utils/native-room-world');
  const size=object.scale*world.width*NATIVE_MODEL_CATALOG[object.modelId].renderScale/ROOM_SPAN;
  nodes.find(({node})=>node.type==='RoomItemMoveControls').node.props.onMove('left');
  assert.equal(moved.id,sofa.instanceId);
  assert.ok(Math.abs((sofa.offset.x-moved.offset.x)*((world.width-size)/2)*zoom-8)<1e-8,'Arrow movement is eight visible points at each zoom');
  assert.ok(Math.abs(moved.offset.y-sofa.offset.y)<1e-9,'Move only the selected item on the requested axis');
}
cameraZoom=1;
measureWindowRoom({nativeEvent:{layout:{width:0,height:0}}});
moveControls.props.onDone();
assert.equal(render([sofa]).some(({ node }) => node.type === 'RoomItemMoveControls'), false);
assert.equal(sofaNode(render([sofa])).props.allowDrag, true, 'Done moving retains decoration mode');
editingRoom.find(({ node }) => node.props.accessibilityLabel === 'home.finishDecorating').node.props.onPress();
const finishedRoom = render([sofa]);
assert.equal(sofaNode(finishedRoom).props.allowDrag, false);
assert.deepEqual(style(footer(statsPanel(finishedRoom)).props.style), style(footer(normalStats).props.style), 'Finishing decoration mode preserves the viewport used to save object positions');
assert.equal(statsPanel(finishedRoom).ancestors.at(-1).props.accessibilityElementsHidden, false);
console.log('Verified explicit decorating, protected furniture taps, cat repositioning, and Done restoring normal interaction.');
console.log('Verified a compact footer, wider scene, stable play/edit viewport, and an editing dock that borrows the hidden navigation strip.');
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
assert.deepEqual(Array.from(roomCommands, action => action.section), [
  ...Array(3).fill('essentials'), ...Array(2).fill('play'),
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
const beforeDecorate = stoppedForEditing;
furnitureMenu(render([sofa], combinedProps)).props.actions[1].onPress();
assert.equal(stoppedForEditing, beforeDecorate + 1, 'Decorating asks the seated cat to get down first');
const waitingRoom = render([sofa], combinedProps);
assert.equal(sofaNode(waitingRoom).props.allowDrag, false, 'Keep the occupied sofa in place during the return');
assert.equal(furnitureMenu(waitingRoom).props.actions[1].disabled, true);
assert.equal(furnitureMenu(waitingRoom).props.actions[0].disabled, undefined, 'Shopping remains available while the cat returns');
roomActivityForTest = null; editingReady(); render([sofa]);
assert.equal(sofaNode(render([sofa])).props.allowDrag, true, 'Decorating begins after the return finishes');
const post = { toyId: 'scratchPostRed', instanceId: 'post', offset: { x: .2, y: .3 }, scale: 1.5 };
const scaled = [];
const toyProps = { placedToys: [post], onScalePlacedToy: (id, direction) => scaled.push([id, direction]), onPlacedToyRemove() {} };
const postNode = render([sofa], toyProps).find(({ node }) => node.type === 'DraggableRoomPet' && node.props.testID === 'room-object:post').node;
postNode.props.onDragStart();
assert.equal(render([sofa], toyProps).find(({ node }) => node.type === 'RoomItemMoveControls').node.props.name, 'store.toyName.scratchPostRed', 'Dragging selects the exact object for its separate controls');
assert.equal(postNode.props.petSize, 72 * load('@/constants/room-scale').ROOM_OBJECT_SCALE, 'Render and drag bounds both use the saved scratching-post size and room proportions');
const postMenu = postNode.props.menuActions;
assert.deepEqual(Array.from(postMenu, action => action.label), ['home.makeBigger', 'home.makeSmaller', 'home.removeFromRoom']);
let rotatedToy;
const rotatedPostNode = render([sofa], { ...toyProps, onRotatePlacedToy: id => { rotatedToy = id; } })
  .find(({ node }) => node.type === 'DraggableRoomPet' && node.props.testID === 'room-object:post').node;
const rotateAction = rotatedPostNode.props.menuActions.find(action => action.label === 'home.rotateItem');
assert.ok(rotateAction, 'The selected toy exposes the same rotate action as other furniture');
assert.equal(rotateAction.icon, 'rotate');
rotateAction.onPress();
assert.equal(rotatedToy, 'post', 'Rotate dispatches to the selected toy instance');
postMenu[0].onPress(); postMenu[1].onPress();
assert.deepEqual(scaled, [['post', 'up'], ['post', 'down']]);
for (const [scale, disabledIndex] of [[2.2, 0], [.7, 1]]) {
  const actions = render([sofa], { ...toyProps, placedToys: [{ ...post, scale }] }).find(({ node }) => node.type === 'DraggableRoomPet' && node.props.testID === 'room-object:post').node.props.menuActions;
  assert.equal(actions[disabledIndex].disabled, true, 'Disable resizing beyond furniture limits');
}
console.log('Verified decorating waits for the cat, and scratching posts expose bounded resize controls.');

console.log('Verified independent AC/lamp power, reload persistence, transformed light origins and native switch menus.');

// Navigation sits inside the scene, while doors remain optional decor.
roomActivityForTest = null;
const finishPreviousEdit = render().find(({ node }) => node.props.accessibilityLabel === 'home.finishDecorating');
finishPreviousEdit?.node.props.onPress();
const homeDoor = { decorationId: 'japaneseDoorAni', instanceId: 'door-bath', doorDestination: 'bathroom', offset: { x: -.5, y: -.3 } };
let visited;
const houseProps = { homeRoomId: 'livingRoom', onVisitHomeRoom: id => { visited = id; } };
const house = render([homeDoor], houseProps);
const doorway = decorationNode(house, homeDoor.decorationId).node;
assert.equal(doorway.props.interactive, false);
assert.equal(doorway.props.menuActions?.length ?? 0, 0, 'A door no longer consumes room space as a travel control');
assert.equal(house.some(({ node }) => node.props.label === 'home.chooseRoom'), false, 'The large room-selector header is removed');
const navigation = nodes => nodes.find(({ node }) => node.type === 'RoomNavigation').node;
assert.equal(navigation(house).props.roomId, 'livingRoom');
navigation(house).props.onVisit('bedroom');
assert.equal(visited, 'bedroom');
assert.equal(navigation(render([], { ...houseProps, roomActivityBlocked: true })).props.disabled, true, 'Care blocks room navigation');
const blockedDoor = decorationNode(render([homeDoor], { ...houseProps, roomActivityBlocked: true }), homeDoor.decorationId).node;
assert.equal(blockedDoor.props.interactive, false, 'Care blocks room travel');
const directToy = render([], { placedToys: [ball] }).find(({ node }) => node.type === 'DraggableRoomPet' && node.props.testID === 'room-object:ball').node;
directToy.props.menuActions[0].onPress();
assert.equal(requestedActivity, 'toyPlay');
assert.equal(requestedInstanceId, ball.instanceId);
const houseEditor = render([homeDoor], houseProps);
houseEditor.find(({ node }) => node.props.accessibilityLabel === 'home.decorateRoom').node.props.onPress();
const editableDoor = decorationNode(render([homeDoor], houseProps), homeDoor.decorationId).node;
assert.equal(editableDoor.props.allowDrag, true, 'Optional door decor still moves normally');
assert.equal(editableDoor.props.menuActions.some(action => action.label === 'home.doorLeadsTo'), false);
assert.equal(render([homeDoor], houseProps).some(({ node }) => node.type === 'RoomNavigation'), false, 'Room arrows cannot switch away from an active edit');
render([homeDoor], houseProps).find(({ node }) => node.props.accessibilityLabel === 'home.finishDecorating').node.props.onPress();
const { RoomNavigation, ROOM_NAVIGATION_HEIGHT } = load(path.join(root, 'components/pet/RoomNavigation.tsx'));
const ids = ['bedroom', 'livingRoom', 'kitchen', 'bathroom'];
for (const [index, roomId] of ids.entries()) {
  const nav = flatten(RoomNavigation({ roomId, disabled: false, onVisit: id => { visited = id; } }));
  const arrows = nav.filter(({ node }) => node.type === 'Pressable').map(({ node }) => node);
  assert.equal(arrows[0].props.disabled, index === 0);
  assert.equal(arrows[1].props.disabled, index === ids.length - 1);
  for (const [direction, arrow] of arrows.entries()) {
    visited = undefined; arrow.props.onPress();
    assert.equal(visited, ids[index + (direction ? 1 : -1)], 'Arrows switch to the adjacent named room');
    assert.ok(style(arrow.props.style).minHeight >= 44, 'Compact arrows retain usable touch targets');
  }
  const current = nav.find(({ node }) => node.props.accessibilityRole === 'adjustable').node;
  visited = undefined; current.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
  assert.equal(visited, ids[index + 1], 'Screen readers can change rooms without a swipe');
  const blocked = flatten(RoomNavigation({ roomId, disabled: true, onVisit: id => { visited = id; } }));
  visited = undefined; blocked.filter(({ node }) => node.type === 'Pressable').forEach(({ node }) => node.props.onPress());
  assert.equal(visited, undefined, 'Disabled arrows never dispatch room changes');
}
assert.equal(ROOM_NAVIGATION_HEIGHT, 52, 'The scene reserves precisely the old header and gap, preserving saved positions');
console.log('Verified compact room arrows, all four destinations, boundary and care/edit guards, screen-reader navigation, optional door decor, and direct toy selection.');

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
roomActivityForTest = null; editingReady(); render([bowl], mealProps); render([bowl], mealProps);
assert.equal(catNode(render([bowl], mealProps)).props.menuActions, undefined, 'Decorating keeps the cat draggable without care menus');
console.log('Verified direct cat and bowl menus, deferred feeding, retained pet/play actions, missing bowl, full hunger, busy meals, and decorating.');

render().find(({ node }) => node.props.accessibilityLabel === 'home.finishDecorating').node.props.onPress();
let transferred;
const travelProps = { ...houseProps, catHomeRoomId: 'livingRoom', onSendCatToRoom: id => { transferred = id; } };
const catRoom = render([bowl, sofa], travelProps);
const groupedCommands = catNode(render([bowl, sofa], { ...travelProps, ...mealProps, ...extra })).props.menuActions;
assert.deepEqual(Array.from(groupedCommands, action => action.section), [
  ...Array(4).fill('essentials'),
  ...Array(3).fill('travel'),
  ...Array(6).fill('play'),
], 'Cat options keep essentials, destinations, and all toy games in contiguous sections');
const destinations = catNode(catRoom).props.menuActions.filter(action => action.label.startsWith('home.goToRoom:'));
assert.deepEqual(Array.from(destinations, action => action.label), ['bedroom', 'kitchen', 'bathroom'].map(id => 'home.goToRoom:home.rooms.' + id));
requestedActivity = undefined;
navigation(catRoom).props.onVisit('bedroom');
assert.equal(visited, 'bedroom');
assert.equal(requestedActivity, undefined, 'Room arrows never command the cat to move');
destinations[1].onPress();
assert.equal(requestedActivity, 'roomTravel');
assert.equal(requestedInstanceId, 'kitchen');
assert.equal(transferred, undefined, 'Cat commands wait for the animated departure');
const emptyView = render([bowl, sofa], { ...travelProps, homeRoomId: 'bedroom' });
assert.equal(emptyView.some(({ node }) => node.props.testID === 'room-cat'), false, 'The cat has no hit target in another room');
assert.equal(roomActivityEnabled, false, 'An empty room cannot run cat idle activities');
assert.equal(emptyView.find(({ node }) => node.type === 'NativeRoomScene').node.props.catPresent, false, 'Native cat and physics are hidden in unoccupied rooms');
for (const id of ['bowl', 'sofa']) assert.equal(decorationNode(emptyView, id).node.props.interactive, false, 'Unoccupied furniture cannot command a cat in another room');
assert.equal(emptyView.some(({ node }) => node.type === 'PetSpeechBubble'), false);
emptyView.find(({ node }) => node.props.accessibilityLabel === 'home.decorateRoom').node.props.onPress();
assert.equal(decorationNode(render([bowl, sofa], { ...travelProps, homeRoomId: 'bedroom' }), 'bowl').node.props.allowDrag, true, 'Unoccupied rooms can still be decorated');
render([], { ...travelProps, homeRoomId: 'bedroom' }).find(({ node }) => node.props.accessibilityLabel === 'home.finishDecorating').node.props.onPress();
console.log('Verified arrows only browse, the cat menu offers other rooms, travel waits for arrival, empty rooms hide the cat and its commands, and decoration still works.');

// Only a resting toy commits its physical location to the saved room layout.
const landedBall = { toyId: 'blueBall', instanceId: 'landed-ball', offset: { x: .2, y: .3 } };
const savedLandings = [];
const landingProps = { placedToys: [landedBall], roomVisible: true,
  onPlacedToyOffsetChange: (id, offset) => savedLandings.push({ id, offset }) };
let landingView = render([], landingProps);
landingView.find(({ node }) => node.type === 'NativeRoomScene').ancestors.slice().reverse().find(node => node.props.onLayout)
  .props.onLayout({ nativeEvent: { layout: { width: 320, height: 320 } } });
landingView = render([], landingProps);
const landingScene = landingView.find(({ node }) => node.type === 'NativeRoomScene').node;
const landedCenter = [1.1, .2, .8];
landingScene.props.onObjectPosition(landedBall.instanceId, { x: 20, y: 30 }, landedCenter, false);
assert.equal(savedLandings.length, 0, 'Moving balls update hit targets without writing each physics frame');
landingScene.props.onObjectPosition(landedBall.instanceId, { x: 20, y: 30 }, landedCenter, true);
assert.equal(savedLandings.length, 1, 'A ball landing updates its saved placement');
assert.equal(savedLandings[0].id, landedBall.instanceId);
const nativeWorldUtils = load('@/utils/native-room-world');
const restoredBall = nativeWorldUtils.buildNativeRoomWorld({ width: 320, height: 320, petSize: 120, sizeScale: 1.15,
  toys: [{ ...landedBall, offset: savedLandings[0].offset }], decorations: [] }).objects[0];
assert.ok(Math.abs((restoredBall.min[0] + restoredBall.max[0]) / 2 - landedCenter[0]) < 1e-6);
assert.ok(Math.abs((restoredBall.min[2] + restoredBall.max[2]) / 2 - landedCenter[2]) < 1e-6);
render([], { ...landingProps, roomVisible: false }).find(({ node }) => node.type === 'NativeRoomScene').node.props
  .onObjectPosition(landedBall.instanceId, { x: 20, y: 30 }, [1.5, .2, .8], true);
assert.equal(savedLandings.length, 1, 'Late physics reports from a hidden room cannot move an item in the viewed room');
console.log('Verified actual room-stage landing persistence, live movement without repeated saves, reload projection and hidden-room guards.');

for (const zoom of [1.73, 2.6, 3]) {
  cameraZoom = zoom;
  render([], landingProps).find(({ node }) => node.props.accessibilityLabel === 'home.decorateRoom').node.props.onPress();
  const editing = render([], landingProps);
  const toy = editing.find(({ node }) => node.props.testID === 'room-object:landed-ball').node;
  assert.equal(cameraZoom, zoom, 'Entering decoration mode preserves the chosen zoom');
  assert.equal(toy.props.allowDrag, true, 'Zoomed balls remain draggable while decorating');
  assert.equal(toy.props.dragScale, zoom);
  assert.equal(editing.find(({ node }) => node.type === 'NativeRoomScene').node.props.editing, true, 'The editor takes control of the ball from physics');
  editing.find(({ node }) => node.props.accessibilityLabel === 'home.finishDecorating').node.props.onPress();
  assert.equal(cameraZoom, zoom, 'Finishing decoration mode keeps the same camera view');
}
console.log('Verified decoration mode preserves fractional zoom and enables ball dragging with the correct scale.');

for (const [decorationId, kind] of [['bathroomBathAni','bathWash'],['bathroomShowerCabin','showerWash'],['bathroomWcAni','toiletUse'],['bathroomJacuzziSage','bathWash']]) {
  const fixture={decorationId,instanceId:'fixture',offset:{x:0,y:0}};
  cameraZoom=1;
  const nodes=render([fixture]);
  const fixtureNode=nodes.find(({node})=>node.props.testID==='room-object:fixture').node;
  assert.equal(fixtureNode.props.interactive,true,'Bathroom fixtures expose their cat action menus');
  const action=fixtureNode.props.menuActions.find(a=>a.label==='home.catCommands.'+kind);
  assert.ok(action);action.onPress();
  assert.equal(requestedActivity,kind);assert.equal(requestedInstanceId,'fixture');
  assert.ok(roomCommands.some(a=>a.label==='home.catCommands.'+kind),'The cat menu offers bathroom actions too');
  const blocked=render([fixture],{roomActivityBlocked:true}).find(({node})=>node.props.testID==='room-object:fixture').node;
  assert.equal(blocked.props.interactive,false,'Care and room travel protect bathroom commands');
}
console.log('Verified real bathtub, shower, toilet and Jacuzzi menu taps target the selected fixture.');

// Exercise the actual rotation form rather than only PetStage's sheet callbacks.
const { RoomRotationControls } = load(path.join(root, 'components/pet/RoomRotationControls.tsx'));
states.length = 0;
let formPreview, formApplied, formCancelled = false;
function rotationForm(extra = {}) {
  stateIndex = 0;
  const controls = RoomRotationControls({ name: 'Chair', degrees: 0, simpleGraphics: false,
    onPreview: value => { formPreview = value; }, onApply: value => { formApplied = value; }, onClose: () => { formCancelled = true; }, ...extra });
  return flatten(controls).map(entry => entry.node);
}
const angleInput = nodes => nodes.find(node => node.props.accessibilityLabel === 'home.rotationAngle');
const applyButton = nodes => nodes.find(node => node.props.accessibilityState?.disabled !== undefined);
angleInput(rotationForm()).props.onChangeText('37,5');
assert.equal(formPreview, 37.5, 'Decimal input accepts both locale separators');
assert.equal(rotationForm().find(node => node.props.minimumValue === 0).props.value, 37.5);
for (const invalid of ['', '-1', '361', 'invalid']) {
  angleInput(rotationForm()).props.onChangeText(invalid);
  assert.equal(applyButton(rotationForm()).props.disabled, true, 'Empty and out-of-range angles cannot be applied');
}
rotationForm().find(node => node.props.minimumValue === 0).props.onValueChange(137.54);
assert.equal(formPreview, 137.5, 'Slider supports precise arbitrary angles');
assert.equal(angleInput(rotationForm()).props.value, '137.5');
applyButton(rotationForm()).props.onPress();
assert.equal(formApplied, 137.5);
rotationForm().find(node => node.props.onPress && !node.props.accessibilityState).props.onPress();
assert.equal(formCancelled, true);
assert.equal(applyButton(rotationForm({placementAllowed:false})).props.disabled,true,'Colliding rotations cannot be applied');
console.log('Verified the actual rotation form, slider precision, numeric input, locale decimals, invalid input, Apply and Cancel.');

// Exercise spotlight presets and the slider without opening a modal.
const { RoomSpotlightControls } = load(path.join(root, 'components/pet/RoomSpotlightControls.tsx'));
states.length = 0;
let beamPreview, beamApplied, beamSwivel, savedSwivel, beamCancelled = false;
function aimForm() {
  stateIndex = 0;
  return flatten(RoomSpotlightControls({ name:'Spotlight', angle:-25,
    onPreview:(value,turn) => { beamPreview=value; beamSwivel=turn; }, onApply:(value,turn) => { beamApplied=value; savedSwivel=turn; },
    onClose:() => { beamCancelled=true; } })).map(entry => entry.node);
}
assert.ok(!aimForm().some(node=>node.type==='AppBottomSheet'),'Aiming does not cover the scene with a modal');
aimForm().find(node=>node.props.minimumValue===-75).props.onValueChange(21);
assert.equal(beamPreview,-21); assert.equal(beamApplied,undefined);
assert.equal(beamSwivel,0);
const textOf = node => node.props.children.flat(Infinity).find(child=>child?.type==='Text')?.props.children[0];
aimForm().find(node=>textOf(node)==='home.spotlightTurn').props.onPress();
assert.equal(aimForm().find(node=>node.props.minimumValue===-85).props.value,0);
aimForm().find(node=>node.props.minimumValue===-85).props.onValueChange(-30);
assert.equal(beamSwivel,-30); assert.equal(beamPreview,-21,'Turning preserves the tilt');
const headInput = () => aimForm().find(node=>node.props.accessibilityLabel==='home.spotlightSwivel' && node.props.onChangeText);
headInput().props.onChangeText('-29,5');
assert.equal(beamSwivel,-29.5,'Exact sideways input accepts locale decimals');
for(const invalid of ['', '-86', '86', 'invalid']) {
  headInput().props.onChangeText(invalid);
  assert.equal(aimForm().find(node=>textOf(node)==='home.applyRotation').props.disabled,true);
}
headInput().props.onChangeText('-30');
aimForm().find(node=>textOf(node)==='home.applyRotation').props.onPress();
assert.equal(beamApplied,-21);assert.equal(savedSwivel,-30,'Apply saves both axes');
aimForm().find(node=>textOf(node)==='home.spotlightPainting').props.onPress();
assert.equal(beamSwivel,0,'Presets reset sideways aim');
aimForm().find(node=>textOf(node)==='home.spotlightTilt').props.onPress();
assert.equal(beamPreview,55);
assert.equal(aimForm().find(node=>node.props.minimumValue===-75).props.value,-55);
aimForm().find(node=>textOf(node)==='home.applyRotation').props.onPress();
assert.equal(beamApplied,55);
aimForm().find(node=>textOf(node)==='common.cancel').props.onPress();
assert.equal(beamCancelled,true);
aimForm().find(node=>textOf(node)==='home.spotlightBelow').props.onPress();
assert.equal(beamPreview,15,'The below preset points back towards the wall beneath the fixture');
aimForm().find(node=>textOf(node)==='home.spotlightUp').props.onPress();
assert.equal(beamPreview,-180,'The head reaches straight up');
const sweepSlider=aimForm().find(node=>node.props.minimumValue===-75);
sweepSlider.props.onValueChange(90.36);
assert.equal(beamPreview,-90.4,'Increasing the sweep turns from down through the room towards up');
assert.equal(aimForm().find(node=>node.props.minimumValue===-75).props.value,180,'Live input never resets the native thumb during a drag');
sweepSlider.props.onSlidingComplete(90.36);
assert.equal(aimForm().find(node=>node.props.minimumValue===-75).props.value,90.36);
console.log('Verified continuous native slider, full wall/down/room/up sweep, preset preview, Apply and Cancel.');

// A real stage drag publishes a shared native pose without scheduling React work.
states.length=0; drawingValues.length=0; refs.length=0;
measureWindowRoom({nativeEvent:{layout:{width:390,height:420}}});
const dragChair={decorationId:'chairRockingOak',instanceId:'drag-chair',offset:{x:0,y:.25},rotationDegrees:20,scale:.8};
let dragRoom=render([dragChair],moveProps);
const decorate=dragRoom.find(({node})=>node.props.accessibilityLabel==='home.decorateRoom');
if(decorate)decorate.node.props.onPress();
dragRoom=render([dragChair],moveProps);
const dragNode=decorationNode(dragRoom,'drag-chair').node;
const sharedPreview=dragRoom.find(({node})=>node.type==='NativeRoomScene').node.props.editingObject;
// Worklets Core clears its backing properties before copying an assigned object.
// Its getter is a live proxy: assigning that same proxy erases the source too.
let previewProperties, previewWrites=0;
const previewProxy=new Proxy({}, {
  get:(_target,key)=>previewProperties?.[key],
  ownKeys:()=>Reflect.ownKeys(previewProperties ?? {}),
  getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true}),
});
Object.defineProperty(sharedPreview,'value',{
  get:()=>previewProperties ? previewProxy : undefined,
  set:value=>{
    previewWrites++;
    if(!value){previewProperties=undefined;return;}
    previewProperties={};
    for(const key of Object.keys(value))previewProperties[key]=value[key];
  },
});
const savedChair=roomWorld(dragRoom).objects[0];
const placementApi=load('@/utils/room-item-placement');
const anchor=placementApi.roomItemAnchor(savedChair,390);
const writesBefore=stateWrites;
for(let frame=0;frame<120;frame++)dragNode.props.onDragPositionChange({x:anchor.x+frame*.1,y:anchor.y});
assert.equal(stateWrites,writesBefore,'Furniture drag frames do not update React state or rebuild the room');
assert.equal(sharedPreview.value.heading,20*Math.PI/180,'The native preview retains the saved 20-degree angle');
assert.equal(roomWorld(dragRoom).objects[0],savedChair,'The saved world stays unchanged during the drag');
const blockedWrites=previewWrites;
for(let frame=0;frame<60;frame++) {
  dragNode.props.onDragPositionChange({x:anchor.x+1000,y:anchor.y});
  assert.equal(sharedPreview.value.instanceId,'drag-chair','Blocked dragging cannot erase the live shared object');
  assert.ok(Number.isFinite(sharedPreview.value.scale));
  assert.ok(sharedPreview.value.position.every(Number.isFinite));
  assert.equal(sharedPreview.value.heading,20*Math.PI/180);
}
assert.ok(previewWrites-blockedWrites<=1,'Stationary drag movement does not republish an unchanged native shared pose');
dragNode.props.onOffsetChange({x:.1,y:.25});
assert.equal(moved.id,'drag-chair');
console.log('Verified live-proxy furniture previews, unchanged-pose caching, no React updates and an unchanged saved angle.');

// The actual stage wires geometry picking to selection, native previews and one save.
const nativeEditor=dragRoom.find(({node})=>node.type==='NativeRoomEditor').node.props;
const pickerRef=dragRoom.find(({node})=>node.type==='NativeRoomScene').node.props.pickerRef;
let pickCoordinates;
pickerRef.current={pick:async(x,y)=>{pickCoordinates=[x,y];return 'drag-chair';}};
assert.equal(await nativeEditor.pick({x:42,y:84}),'drag-chair');
assert.deepEqual(pickCoordinates,[42,84]);
nativeEditor.select('drag-chair');
assert.equal(decorationNode(render([dragChair],moveProps),'drag-chair').node.props.selected,true);
nativeEditor.discard('drag-chair');
assert.equal(sharedPreview.value,undefined,'Cancelled native editing discards the unsaved pose');
const nativeWrites=stateWrites;
const nativePoint=nativeEditor.move('drag-chair',{x:anchor.x+10,y:anchor.y});
assert.equal(stateWrites,nativeWrites,'The geometry editor retains drawing-thread previews without React work');
assert.equal(sharedPreview.value.heading,savedChair.heading);
nativeEditor.commit('drag-chair',nativePoint);
const chairSize=savedChair.scale*390*load('@/utils/native-room-world').NATIVE_MODEL_CATALOG[savedChair.modelId].renderScale/load('@/utils/native-room-world').ROOM_SPAN;
assert.ok(Math.abs(moved.offset.x-nativePoint.x/((390-chairSize)/2))<1e-8,'Commit converts the accepted native anchor into the saved offset');
nativeEditor.discard('drag-chair');
const snapEditor=render([dragChair],moveProps).find(({node})=>node.type==='RoomEditorSheet').node.props;
snapEditor.onSnap();
const snapping=render([dragChair],moveProps).find(({node})=>node.type==='NativeRoomEditor').node.props;
snapping.commit('drag-chair',snapping.move('drag-chair',{x:anchor.x+3,y:anchor.y+3}));
assert.ok(Math.abs(moved.offset.x*10-Math.round(moved.offset.x*10))<1e-8,'Native geometry dragging retains the optional grid snap');
snapping.discard('drag-chair');snapEditor.onSnap();
assert.ok(!render([dragChair],{...moveProps,roomVisible:false}).some(({node})=>node.type==='NativeRoomEditor'),'Hidden rooms have no active picker overlay');
assert.ok(!render([dragChair],{...moveProps,nativeSceneMounted:false}).some(({node})=>node.type==='NativeRoomEditor'),'Unmounted native rooms have no active picker overlay');
console.log('Verified stage geometry picking, selected instance, shared preview, saved accepted anchor, grid snap and inactive-room cleanup.');

// The reported chair can pass over the sofa as a preview, but cannot be saved inside it.
states.length=0; drawingValues.length=0; refs.length=0;
measureWindowRoom({nativeEvent:{layout:{width:390,height:420}}});
const closeChair={...dragChair,wallFlipped:true,offset:{x:-.51,y:.21},scale:1};
const closeSofa={...sofa,offset:{x:-.37,y:.093},rotationDegrees:270,scale:1.5};
let dropSaves=0;
const dropProps={...moveProps,onPlacedDecorationOffsetChange:(id,offset)=>{dropSaves++;moved={id,offset};}};
let closeRoom=render([closeChair,closeSofa],dropProps);
closeRoom.find(({node})=>node.props.accessibilityLabel==='home.decorateRoom').node.props.onPress();
closeRoom=render([closeChair,closeSofa],dropProps);
const editor=closeRoom.find(({node})=>node.type==='NativeRoomEditor').node.props;
const closeWorld=roomWorld(closeRoom),closePreview=closeRoom.find(({node})=>node.type==='NativeRoomScene').node.props.editingObject;
const originalChair=closeWorld.objects.find(object=>object.instanceId==='drag-chair');
const sofaObject=closeWorld.objects.find(object=>object.instanceId==='sofa');
const sofaPoint=placementApi.roomItemAnchor(sofaObject,390);
const previewPoint=editor.move('drag-chair',sofaPoint);
assert.ok(Math.abs(previewPoint.x-sofaPoint.x)<1e-8 && Math.abs(previewPoint.y-sofaPoint.y)<1e-8,'The chair follows the pointer across the sofa');
const closeResolver=placementApi.createRoomPlacementResolver(closeWorld);
assert.equal(closeResolver.canPlace(closePreview.value),false,'The temporary chair preview overlaps furniture');
const beforeReject=dropSaves;
editor.select('drag-chair');
editor.commit('drag-chair',previewPoint);
let rejectedRoom=render([closeChair,closeSofa],dropProps);
const failedOverlay=rejectedRoom.find(({node})=>node.type==='RoomPlacementOverlay').node;
assert.ok(failedOverlay.props.feedback.blockers.some(hit=>hit.instanceId==='sofa'));
const restoredSelection=decorationNode(rejectedRoom,'drag-chair').node.props.externalPosition;
const savedSelection=placementApi.roomItemAnchor(originalChair,390);
assert.ok(Math.abs(restoredSelection.x-savedSelection.x)<1e-8 && Math.abs(restoredSelection.y-savedSelection.y)<1e-8,'The native selection frame uses the restored model anchor, not stale sprite coordinates');
assert.equal(rejectedRoom.find(({node})=>node.type==='RoomItemMoveControls').node.props.feedback,'home.placementReturned · home.placementBlocked');
editor.select('drag-chair');
assert.ok(!render([closeChair,closeSofa],dropProps).some(({node})=>node.type==='RoomPlacementOverlay'),'Beginning the next gesture clears stale rejection feedback');
assert.equal(dropSaves,beforeReject,'An invalid native drop is never saved');
assert.equal(closePreview.value,undefined,'Rejecting a drop restores the saved native pose');
const freeChair=closeResolver.nearestFree(placementApi.roomItemAtPoint(originalChair,sofaPoint,390));
assert.ok(freeChair,'The reported layout has a clear place for the chair');
const freePoint=placementApi.roomItemAnchor(freeChair,390);
editor.move('drag-chair',sofaPoint);
editor.commit('drag-chair',editor.move('drag-chair',freePoint));
assert.equal(dropSaves,beforeReject+1,'A clear drop after crossing the sofa saves exactly once');
assert.ok(!render([closeChair,closeSofa],dropProps).some(({node})=>node.type==='RoomPlacementOverlay'),'An accepted drop has no rejection overlay');
assert.equal(closePreview.value.heading,originalChair.heading,'The accepted drop retains the saved 20-degree rotation and wall orientation');
const proxyChair=decorationNode(closeRoom,'drag-chair').node;
const simpleReturn=proxyChair.props.onDragEnd(sofaPoint);
const originalPoint=placementApi.roomItemAnchor(originalChair,390);
assert.ok(Math.abs(simpleReturn.x-originalPoint.x)<1e-8 && Math.abs(simpleReturn.y-originalPoint.y)<1e-8,'The sprite/accessibility drag path rejects the same overlap');
assert.equal(closePreview.value,undefined);
console.log('Verified the reported rotated chair previews over the sofa, restores invalid drops, accepts a clear drop and preserves its angle on both edit paths.');

// Newly placed furniture receives a free spot rather than the old overlapping default.
states.length=0; drawingValues.length=0; refs.length=0;
measureWindowRoom({nativeEvent:{layout:{width:390,height:420}}});
const smallSofa={...sofa,scale:.8,offset:{x:0,y:0}};
render([smallSofa],moveProps);
moved=undefined;
const newChair={...dragChair,offset:{x:0,y:0}};
const added=render([smallSofa,newChair],moveProps);
assert.equal(moved.id,newChair.instanceId,'The new overlapping chair receives a corrected offset');
const fixedChair={...newChair,offset:moved.offset};
const correctedWorld=roomWorld(render([smallSofa,fixedChair],moveProps));
assert.ok(placementApi.createRoomPlacementResolver(correctedWorld).canPlace(correctedWorld.objects[1]));
assert.equal(correctedWorld.objects[1].heading,20*Math.PI/180,'Automatic placement retains the selected angle');
assert.equal(added.find(({node})=>node.type==='NativeRoomScene').node.props.world.objects.length,2);
console.log('Verified new furniture is placed in the nearest available space while retaining its angle.');

const routineClock = { worldMs: 23 * 3_600_000, realMs: Date.now(), speed: 1 };
render([], { worldClock: routineClock });
assert.equal(activityOptionsForTest.period, 'night', 'The rendered cat stage passes nighttime to its scheduler');
render([], { worldClock: { ...routineClock, worldMs: 13 * 3_600_000 } });
assert.equal(activityOptionsForTest.period, 'day');
render([], {});
assert.equal(activityOptionsForTest.period, undefined, 'Clock-free previews keep their existing behaviour');
console.log('Verified actual room-stage clock wiring for day, night and clock-free previews.');
