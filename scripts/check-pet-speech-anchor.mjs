/** Check the real stage tree and camera styles without mounting native views. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const states = [];
const sharedValues = [];
let stateIndex = 0, sharedIndex = 0, stageZoom = 1;
const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useMemo: fn => fn(), useCallback: fn => fn, useEffect: () => {},
  useLayoutEffect: fn => fn(),
  useRef: current => ({ current }),
  useState: initial => {
    const index = stateIndex++;
    if (!(index in states)) states[index] = initial;
    return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
  },
};
const shared = () => ({ get: () => 0, set() {} });
const mocks = {
  '@/utils/native-room-world': { buildNativeRoomWorld: () => ({ width: 320, height: 320, objects: [], home: [0,0,0] }) },
  '@/utils/room-activities': { buildRoomActivity: () => null },
  '@/hooks/use-room-activity': { useRoomActivity: () => ({ activity: null, scale: shared(), facing: shared(), objectX: shared(), objectY: shared(), objectRotation: shared(), returnHome() {}, startActivity() {} }) },
  react: React,
  'react-i18next': { useTranslation: () => ({ t: key => key }) },
  'react-native': {
    View: 'View', Image: 'Image', Text: 'Text', Pressable: 'Pressable',
    StyleSheet: { create: styles => styles, absoluteFill: {} },
    PanResponder: { create: handlers => ({ panHandlers: handlers }) },
  },
  'react-native-reanimated': {
    default: { View: 'AnimatedView' },
    useReducedMotion: () => false,
    useAnimatedStyle: read => ({ read }),
    useDerivedValue: read => ({ get: read }),
    useSharedValue: initial => {
      const index = sharedIndex++;
      if (!sharedValues[index]) {
        let value = initial;
        sharedValues[index] = { get: () => value, set: next => { value = next; } };
      }
      return sharedValues[index];
    },
  },
  '@/utils/scale': { moderateScale: value => value },
  '@/utils/border-radius': { nestedBorderRadius: (outer, inset) => outer - inset },
  '@/utils/pet-care': { clampStat: value => value },
  '@/utils/room-layer-order': { normalizeRoomLayerOrder: () => [], ROOM_PET_LAYER_Z_INDEX: 1 },
  '@/utils/room-depth': { getRoomDepthZIndex: y => y, getRoomObjectDepthAnchor: () => .38, isRoomBackgroundDecoration: () => false },
  '@/constants/game': { GameColors: {} },
  '@/constants/cat-toys': { getToyDisplaySize: () => 30 },
  '@/constants/cat-beds': { getEquippedBedScale: () => 1, getBedDisplaySize: () => 120, getCatBedSource: () => undefined },
};
mocks['@/hooks/use-room-camera'] = { useRoomCamera: () => ({
  x: mocks['react-native-reanimated'].useSharedValue(0),
  y: mocks['react-native-reanimated'].useSharedValue(0),
  scale: mocks['react-native-reanimated'].useSharedValue(stageZoom),
  zoom: stageZoom, reset() {}, gesture: 'room-gesture',
}) };
mocks['react-native-gesture-handler'] = { GestureDetector: 'GestureDetector' };
const roomScale = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('constants/room-scale.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: roomScale, exports: roomScale.exports });
mocks['@/constants/room-scale'] = roomScale.exports;
const module = { exports: {} };
const source = ts.transpileModule(fs.readFileSync('components/pet/PetStage.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;
vm.runInNewContext(source, {
  module, exports: module.exports, React,
  require: id => mocks[id] ?? new Proxy({}, { get: (_, name) => name }),
});
const flatten = (node, ancestors = []) => !node?.props ? [] : [
  { node, ancestors },
  ...node.props.children.flat().flatMap(child => flatten(child, [...ancestors, node])),
];
const style = input => Object.assign({}, ...[input].flat(Infinity).filter(Boolean).map(value => value.read ? value.read() : value));
const offset = { x: -.4, y: .6 };
function render(zoom, speechMessage = 'Hello!') {
  stateIndex = 0; sharedIndex = 0; stageZoom = zoom;
  return flatten(module.exports.PetStage({
    name: 'Cat', petType: 'cat', compact: true, roomPetOffset: offset,
    stats: { level: 1, hunger: 90, happiness: 90 }, wisdom: 90, playback: {}, speechMessage,
  }));
}

states[2] = { width: 320, height: 320 };
for (const zoom of [1, 1.73, 2.36, 3]) {
  const nodes = render(zoom);
  const bubbles = nodes.filter(({ node }) => node.type === 'PetSpeechBubble');
  assert.equal(bubbles.length, 1, 'Every zoom must use one speech bubble');
  const { ancestors } = bubbles[0];
  const petEntry = nodes.find(({ node }) => node.type === 'DraggableRoomPet');
  const pet = petEntry.node;
  assert.equal(pet.props.initialOffset, offset, 'Cat must retain its saved placement');
  const bubble = ancestors.at(-1);
  bubble.props.onLayout({ nativeEvent: { layout: { height: 40 } } });
  assert.equal(style(bubble.props.style).opacity, 1);
  assert.equal(bubble.props.pointerEvents, 'none', 'Speech must not intercept scene pans');
  assert.ok(!ancestors.some(node => node.props.onPanResponderMove),
    'Speech text must render outside the scaled scene to stay sharp');
  const artwork = petEntry.ancestors.find(node => style(node.props.style).transform?.some(transform => 'scale' in transform));
  assert.ok(artwork && !ancestors.includes(artwork), 'Speech is outside the scaled artwork');
  pet.props.onPositionChange({ x: -40, y: 60 });
  for (const scale of [1, 1.25, 1.75, 2, 2.5, 3]) {
    sharedValues[0].set(0); sharedValues[1].set(0); sharedValues[2].set(scale);
    const initial = style(bubble.props.style).transform;
    assert.ok(initial.every(transform => !('scale' in transform)),
      'Bubble text must stay at native screen size throughout animated zoom');
    assert.ok(initial.every(transform => Number.isFinite(Object.values(transform)[0])));
    pet.props.onPositionChange({ x: -15, y: 50 });
    const dragged = style(bubble.props.style).transform;
    assert.equal(dragged[0].translateX - initial[0].translateX, 25 * scale,
      'The tail must follow live cat movement through the current camera scale');
    assert.equal(dragged[1].translateY - initial[1].translateY, -10 * scale);
    pet.props.onPositionChange({ x: -40, y: 60 });
  }
  if (zoom > 1) {
    const beforePan = style(bubble.props.style).transform;
    sharedValues[0].set(sharedValues[0].get() + 45);
    sharedValues[1].set(sharedValues[1].get() - 60);
    const afterPan = style(bubble.props.style).transform;
    assert.equal(afterPan[0].translateX - beforePan[0].translateX, 45,
      'Speech and cat must move by the same screen distance during panning');
    assert.equal(afterPan[1].translateY - beforePan[1].translateY, -60);
  }
}
assert.equal(render(3, null).filter(({ node }) => node.type === 'PetSpeechBubble').length, 0);
// Exercise the draggable's live-position callback on layout and movement.
const draggableModule = { exports: {} };
mocks['@/components/pet/RoomActionMenu'] = { RoomActionMenu: 'RoomActionMenu' };
const draggableSource = ts.transpileModule(fs.readFileSync('components/pet/DraggableRoomPet.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;
vm.runInNewContext(draggableSource, {
  module: draggableModule, exports: draggableModule.exports, React,
  require: id => { assert.ok(id in mocks, id); return mocks[id]; },
});
states.splice(0, states.length);
sharedValues.splice(0, sharedValues.length);
let reportedPosition;
function renderDraggable() {
  stateIndex = 0; sharedIndex = 0;
  return flatten(draggableModule.exports.DraggableRoomPet({
    children: null, petSize: 120, initialOffset: offset,
    onPositionChange: position => { reportedPosition = position; },
  }));
}
renderDraggable()[0].node.props.onLayout({ nativeEvent: { layout: { width: 320, height: 320 } } });
const dragTarget = renderDraggable().find(({ node }) => node.props.onPanResponderMove).node;
assert.equal(reportedPosition.x, -40);
assert.equal(reportedPosition.y, 60);
dragTarget.props.onPanResponderGrant();
dragTarget.props.onPanResponderMove(null, { dx: 25, dy: -10 });
renderDraggable();
assert.equal(reportedPosition.x, -15, 'Live cat coordinates must be reported before drag release');
assert.equal(reportedPosition.y, 50);
console.log('Verified cat-attached speech at fractional zoom, live cat movement, panning and native text size during zoom.');

for (const [allowDrag, interactive] of [[true, true], [false, true], [true, false]]) {
  stateIndex = 0; sharedIndex = 0;
  const menuItem = flatten(draggableModule.exports.DraggableRoomPet({
    children: null, petSize: 120, allowDrag, interactive,
    menuActions: [{ label: 'Remove', icon: 'delete-outline', onPress() {} }],
  }));
  const menu = menuItem.find(({ node }) => node.type === 'RoomActionMenu')?.node;
  assert.equal(Boolean(menu), !allowDrag, 'Editable objects must be plain drag targets without a native menu competing for touches');
  const menuDragTarget = menuItem.find(({ node }) => node.props.onPanResponderMove).node;
  const menuLabel = menu?.props.children[0];
  if (menuLabel) assert.equal(menuLabel.props.onPanResponderMove, menuDragTarget.props.onPanResponderMove,
    'The nested native menu label must retain the furniture drag handler');
  for (const target of [menuDragTarget, menuLabel].filter(Boolean)) {
    assert.equal(target.props.onStartShouldSetPanResponder(), allowDrag && interactive,
      'Editable menu labels must receive drag events from touch start; locked items must not');
    assert.equal(target.props.onMoveShouldSetPanResponderCapture(null, { dx: 2, dy: 1 }), false);
    assert.equal(target.props.onMoveShouldSetPanResponderCapture(null, { dx: 25, dy: -10 }), allowDrag && interactive,
      'Only editable, interactive room items may capture a drag past the movement threshold');
    assert.equal(target.props.onMoveShouldSetPanResponder(null, { dx: 25, dy: -10 }), allowDrag && interactive);
  }
}
// A small touch selects an item; a real drag saves its position without a tap.
stateIndex = 0; sharedIndex = 0;
let taps = 0, dragStarts = 0, saves = 0;
const dragItem = flatten(draggableModule.exports.DraggableRoomPet({
  children: null, petSize: 120, allowDrag: true,
  onPetTap: () => taps++, onDragStart: () => dragStarts++, onOffsetChange: () => saves++,
  menuActions: [{ label: 'Remove', icon: 'delete-outline', onPress() {} }],
}));
const plainTarget = dragItem.find(({ node }) => node.props.onPanResponderMove).node;
plainTarget.props.onPanResponderGrant();
plainTarget.props.onPanResponderMove(null, { dx: 2, dy: 1 });
plainTarget.props.onPanResponderRelease();
assert.equal(taps, 1); assert.equal(dragStarts, 0); assert.equal(saves, 0);
plainTarget.props.onPanResponderGrant();
plainTarget.props.onPanResponderMove(null, { dx: 25, dy: -10 });
plainTarget.props.onPanResponderMove(null, { dx: 35, dy: -20 });
plainTarget.props.onPanResponderRelease();
assert.equal(taps, 1, 'A drag must never trigger the tap action');
assert.equal(dragStarts, 1, 'Select the dragged object once when the movement threshold is crossed');
assert.equal(saves, 1, 'Save the final drag position once');
console.log('Verified editable objects bypass native menu gestures, small touches select, and real drags save without tapping.');
