/** Test interrupted mode switches and immediate interaction/accessibility guards. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let value, animation, previousDeps, effect, calls = 0;
const progress = { get: () => value, set: next => {
  if (typeof next === 'number') { value = next; animation = undefined; }
  else { animation = { ...next, from: value }; }
} };
const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useEffect: (fn, deps) => {
    if (!previousDeps || deps.some((dep, i) => previousDeps[i] !== dep)) { effect = fn; previousDeps = deps; }
  },
};
const mocks = {
  react: React,
  'react-native-reanimated': {
    default: { View: 'AnimatedView' },
    Easing: { cubic: x => x ** 3, out: fn => x => 1 - fn(1 - x) },
    useSharedValue: initial => { value ??= initial; return progress; },
    useAnimatedStyle: read => ({ read }),
    withTiming: (to, config) => { calls++; return { to, config }; },
  },
};
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/pet/RoomControlsTransition.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText, { module, exports: module.exports, React, require: id => mocks[id] });
const { RoomControlsTransition } = module.exports;
const base = { visible: false, offsetY: 8, children: 'same-controls', style: { minHeight: 74 } };
function render(extra = {}) {
  effect = undefined;
  const tree = RoomControlsTransition({ ...base, ...extra });
  effect?.();
  return tree;
}
const style = tree => Object.assign({}, ...tree.props.style.map(part => part?.read ? part.read() : part));
function advance(fraction) {
  assert.ok(animation, 'A mode change has a running transition');
  const { from, to, config } = animation;
  assert.ok(config.duration >= 120 && config.duration <= 300, 'Controls transition briefly without delaying the task');
  value = from + (to - from) * config.easing(fraction);
}
let tree = render();
assert.equal(style(tree).opacity, 0, 'Inactive controls begin hidden, without flashing on mount');
assert.equal(tree.props.pointerEvents, 'none');
assert.equal(tree.props.accessibilityElementsHidden, true);
assert.equal(tree.props.importantForAccessibility, 'no-hide-descendants');
tree = render({ visible: true });
advance(.5);
const middle = style(tree);
assert.ok(middle.opacity > 0 && middle.opacity < 1, 'Incoming controls fade through an intermediate opacity');
assert.ok(middle.transform[0].translateY > 0 && middle.transform[0].translateY < 8, 'Incoming controls slide gently toward their final position');
assert.equal(middle.minHeight, 74, 'The transition does not resize the reserved space');
assert.ok(!Object.hasOwn(middle, 'height') && !Object.hasOwn(middle, 'width'), 'Animation never changes viewport dimensions');
assert.equal(tree.props.pointerEvents, 'box-none', 'Visible controls accept child taps without covering the room');
const halfway = value;
tree = render({ visible: false });
assert.equal(value, halfway, 'Reversing mid-transition starts from the current appearance');
assert.equal(tree.props.pointerEvents, 'none', 'Outgoing controls stop accepting touches before their fade finishes');
assert.equal(tree.props.accessibilityElementsHidden, true, 'Outgoing controls leave the accessibility tree immediately');
assert.equal(tree.props.importantForAccessibility, 'no-hide-descendants');
advance(.5);
assert.ok(style(tree).opacity < halfway);
tree = render({ visible: true });
advance(1);
assert.equal(style(tree).opacity, 1, 'A rapid reversal ends in the latest requested mode');
assert.equal(style(tree).transform[0].translateY, 0);
const beforeInstant = calls;
tree = render({ visible: false, instant: true });
assert.equal(style(tree).opacity, 0);
assert.equal(animation, undefined, 'Reduce Motion or an inactive room cancels any ongoing transition');
tree = render({ visible: true, instant: true });
assert.equal(style(tree).opacity, 1);
assert.equal(style(tree).transform[0].translateY, 0);
assert.equal(calls, beforeInstant, 'Instant mode does not schedule animations');
assert.equal(tree.props.children[0], base.children, 'Controls stay mounted across modes');
console.log('Verified mode fades/slides, rapid reversals, fixed layout, immediate tap/accessibility guards and instant Reduce Motion/inactive behavior.');

// Exercise keyed tool swaps and their Reduce Motion behavior as well.
let reduced = false;
function builder(kind) {
  return { duration: ms => {
    const animation = { kind, ms,
      easing(value) { this.curve = value; return this; },
      withInitialValues(value) { this.initial = value; return this; },
      reduceMotion(value) { this.motion = value; return this; },
    };
    return animation;
  } };
}
Object.assign(mocks['react-native-reanimated'], {
  FadeInDown: builder('enter'), FadeOut: builder('exit'), LinearTransition: builder('layout'),
  ReduceMotion: { System: 'system' }, useReducedMotion: () => reduced,
  LayoutAnimationConfig: 'LayoutAnimationConfig',
});
const toolModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/pet/RoomToolTransition.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText, { module: toolModule, exports: toolModule.exports, React, require: id => mocks[id] });
const { RoomToolTransition, ROOM_TOOL_LAYOUT } = toolModule.exports;
for (const key of ['item', 'size', 'turn', 'item']) {
  const wrapper = RoomToolTransition({ panelKey: key, children: key + '-controls' });
  const panel = wrapper.props.children[0];
  assert.equal(panel.props.key, key, 'Opening a tool or going Back replaces the animated panel');
  assert.equal(wrapper.props.skipEntering, true, 'Nested panels do not play two entrance animations');
  assert.equal(wrapper.props.skipExiting, true, 'Nested panels do not play two exit animations');
  assert.equal(panel.props.entering.kind, 'enter');
  assert.equal(panel.props.exiting.kind, 'exit');
  assert.ok(panel.props.exiting.ms < panel.props.entering.ms, 'Outgoing tools clear before the new panel settles');
  assert.equal(panel.props.entering.motion, 'system');
  assert.equal(panel.props.exiting.motion, 'system');
}
reduced = true;
const quietPanel = RoomToolTransition({ panelKey: 'size', children: 'resize' }).props.children[0];
assert.equal(quietPanel.props.entering, undefined, 'Reduce Motion skips tool entrance animation');
assert.equal(quietPanel.props.exiting, undefined, 'Reduce Motion skips tool exit animation');
assert.equal(ROOM_TOOL_LAYOUT.motion, 'system', 'Dock resizing also respects the system motion setting');
assert.equal(render({ visible: true, layout: ROOM_TOOL_LAYOUT }).props.layout, ROOM_TOOL_LAYOUT);
assert.equal(render({ visible: true, instant: true, layout: ROOM_TOOL_LAYOUT }).props.layout, undefined, 'Instant mode skips dock layout animation');
console.log('Verified Size/Turn/Back panel identities, nested animation guards and Reduce Motion for tools and dock resizing.');
