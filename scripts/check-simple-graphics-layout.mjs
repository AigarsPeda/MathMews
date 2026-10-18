/** Still images retain their saved anchors when native views reapply initial animated styles. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let slots = [], cursor = 0, layouts = [], dirty = false;
const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useState(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], next => {
      const value = typeof next === 'function' ? next(slots[index]) : next;
      if (value !== slots[index]) { slots[index] = value; dirty = true; }
    }];
  },
  useRef: current => React.useState(() => ({ current }))[0],
  useMemo: fn => fn(), useCallback: fn => fn,
  useLayoutEffect: fn => layouts.push(fn),
};
const shared = initial => { let value = initial; return { get: () => value, set: next => { value = next; } }; };
const mocks = {
  react: React,
  'react-i18next': { useTranslation: () => ({ t: key => key }) },
  'react-native': { View: 'View', StyleSheet: { create: styles => styles, absoluteFill: {} },
    PanResponder: { create: panHandlers => ({ panHandlers }) } },
  'react-native-reanimated': { default: { View: 'AnimatedView' },
    useSharedValue: initial => React.useState(() => shared(initial))[0],
    useAnimatedStyle: read => ({ initial: React.useState(() => read())[0], read }) },
  '@/utils/scale': { moderateScale: value => value },
  '@/utils/room-depth': { getRoomDepthZIndex: y => y },
  '@/utils/room-layer-order': { ROOM_MENU_OPEN_Z_INDEX: 600100 },
  '@/components/pet/RoomActionMenu': { RoomActionMenu: 'RoomActionMenu' },
};
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/pet/DraggableRoomPet.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText, { module, exports: module.exports, React, require: id => {
  assert.ok(id in mocks, id); return mocks[id];
} });
function render(props) {
  let tree;
  do {
    dirty = false; cursor = 0; layouts = [];
    tree = module.exports.DraggableRoomPet(props);
  } while (dirty);
  layouts.forEach(fn => fn());
  return tree;
}
const flatten = node => node?.props ? [node, ...node.props.children.flat(Infinity).flatMap(flatten)] : [];
function anchor(tree, width, height, initial = false) {
  const slot = flatten(tree).find(node => node.props.style?.some?.(style => style?.width));
  const style = Object.assign({}, ...slot.props.style.map(part => part?.read ? initial ? part.initial : part.read() : part));
  return { x: style.left + style.width / 2 - width / 2 + style.transform[0].translateX,
    y: style.top + style.height / 2 - height / 2 + style.transform[1].translateY };
}
function near(actual, expected, message) {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-8 && Math.abs(actual.y - expected.y) < 1e-8,
    `${message}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
}
for (const [width, height] of [[320, 320], [370, 400], [768, 640]]) {
  const anchors = [];
  for (const [petSize, initialOffset] of [[48, { x: .7, y: .6 }], [120, { x: -.6, y: .3 }],
    [180, { x: .5, y: -.6 }], [220, { x: -.4, y: -.3 }]]) {
    slots = [];
    let saves = 0;
    const props = { petSize, initialOffset, children: '3d-placeholder', onOffsetChange: () => saves++ };
    let tree = render(props);
    tree.props.onLayout({ nativeEvent: { layout: { width, height } } });
    tree = render(props);
    const expected = { x: initialOffset.x * (width - petSize) / 2, y: initialOffset.y * (height - petSize) / 2 };
    near(anchor(tree, width, height), expected, 'Measured placement');
    for (const children of ['still-image', '3d-placeholder', 'still-image']) {
      tree = render({ ...props, children });
      near(anchor(tree, width, height, true), expected, 'Reapplying initial animation styles preserves the saved layout');
      near(anchor(tree, width, height), expected, 'Animation updates do not double the saved offset');
    }
    anchors.push(anchor(tree, width, height, true));
    assert.equal(saves, 0, 'Layout and graphics changes must never save a new placement');
    const target = flatten(tree).find(node => node.props.onPanResponderMove).props;
    target.onPanResponderGrant();
    target.onPanResponderMove(null, { dx: 12, dy: -8 });
    near(anchor(tree, width, height), { x: expected.x + 12, y: expected.y - 8 }, 'Dragging remains relative to the saved anchor');
    target.onPanResponderRelease();
    near(anchor(render(props), width, height), { x: expected.x + 12, y: expected.y - 8 }, 'Release retains the final position');
    assert.equal(saves, 1, 'Only a completed drag saves');
    near(anchor(render({ ...props, externalPosition: { x: 35, y: 42 } }), width, height),
      { x: 35, y: 42 }, 'Live physics positions stay absolute');
    near(anchor(render({ ...props, animatedPosition: { x: shared(-24), y: shared(61) } }), width, height),
      { x: -24, y: 61 }, 'Cat movement stays absolute');
  }
  assert.equal(new Set(anchors.map(point => JSON.stringify(point))).size, anchors.length, 'Items cannot collapse into a central heap');
  for (const props of [{ externalPosition: { x: 35, y: 42 } },
    { animatedPosition: { x: shared(35), y: shared(42) } }]) {
    slots = [];
    const item = { petSize: 48, initialOffset: { x: -.6, y: .3 }, ...props };
    render(item).props.onLayout({ nativeEvent: { layout: { width, height } } });
    const tree = render(item);
    near(anchor(tree, width, height), { x: 35, y: 42 }, 'Live positions can be supplied on mount');
    near(anchor(tree, width, height, true), { x: 35, y: 42 }, 'Initial live positions cannot be applied twice');
  }
}
console.log('Verified saved still-image layouts before animation updates, repeated renderer changes, viewport sizes, dragging and live positions.');
