/** Run the real stat ring, screen lifecycle hook and puzzle return callback. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let current, now = 0, focused = true, foreground = true, reducedMotion = false, platform = 'ios';
const listeners = new Map(), sharedValues = new Set();
const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useContext: () => navigation,
  useState(initial) {
    const host = current, i = host.cursor++;
    if (!(i in host.slots)) host.slots[i] = typeof initial === 'function' ? initial() : initial;
    return [host.slots[i], value => {
      const next = typeof value === 'function' ? value(host.slots[i]) : value;
      if (!Object.is(next, host.slots[i])) { host.slots[i] = next; host.changed = true; }
    }];
  },
  useMemo(fn, deps) {
    const i = current.cursor++;
    if (!sameDeps(current.slots[i]?.deps, deps)) current.slots[i] = { value: fn(), deps };
    return current.slots[i].value;
  },
  useEffect(fn, deps) {
    const host = current, i = host.cursor++;
    if (!sameDeps(host.slots[i]?.deps, deps)) host.effects.push(() => {
      host.slots[i]?.cleanup?.(); host.slots[i] = { deps, cleanup: fn() };
    });
  },
};
const navigation = {
  isFocused: () => focused,
  addListener(name, fn) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(fn);
    return () => listeners.get(name).delete(fn);
  },
};
function emit(name, closing = false) {
  for (const fn of listeners.get(name) ?? []) fn({ data: { closing } });
}
function shared(initial) {
  let value = initial, animation;
  const result = {
    starts: 0,
    get() {
      if (animation) {
        const elapsed = Math.min(1, (now - animation.start) / animation.duration);
        value = animation.from + (animation.to - animation.from) * elapsed;
        if (elapsed === 1) animation = undefined;
      }
      return value;
    },
    set(next) {
      const from = result.get();
      if (typeof next === 'number') { value = next; animation = undefined; }
      else { result.starts++; animation = { ...next, from, start: now }; }
    },
    cancel() { result.get(); animation = undefined; },
    pending: () => !!animation,
  };
  sharedValues.add(result);
  return result;
}
const mocks = {
  react: React,
  'expo-router/react-navigation': { NavigationContext: {} },
  '@/hooks/use-animation-activity': { useAnimationActivity: () => ({ active: focused && foreground }) },
  'react-i18next': { useTranslation: () => ({ t: key => key }) },
  'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
    Platform: { get OS() { return platform; } }, StyleSheet: { create: value => value }, useWindowDimensions: () => ({ height: 800 }) },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
  '@/utils/scale': { moderateScale: value => value },
  '@/utils/pet-care': { clampStat: value => Math.max(0, Math.min(100, Math.round(value))) },
  '@/constants/game': { GameColors: { background: 'cream', text: 'black', hunger: 'orange', happiness: 'pink', wisdom: 'purple' } },
  'react-native-reanimated': {
    default: { View: 'AnimatedView' },
    useReducedMotion: () => reducedMotion,
    useSharedValue: initial => React.useState(() => shared(initial))[0],
    useDerivedValue: fn => ({ get: fn }), useAnimatedStyle: fn => ({ read: fn }),
    withTiming: (to, options) => ({ to, duration: options.duration }),
    withSequence: (...steps) => ({ to: steps.at(-1).to, duration: steps.reduce((sum, step) => sum + step.duration, 0) }),
    cancelAnimation: value => value.cancel(), Easing: { out: value => value, inOut: value => value, cubic: 'cubic' },
  },
  '@shopify/react-native-skia': { Canvas: 'Canvas', Circle: 'Circle', Path: 'Path', Text: 'SkiaText',
    Skia: { Path: { Make: () => ({ addArc: () => ({}) }) } },
    matchFont: () => ({ measureText: text => ({ width: text.length * 7 }), getMetrics: () => ({ ascent: -10, descent: 2 }) }) },
};
function load(file) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText, { module, exports: module.exports, React, require: id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith('@/components/')) return new Proxy({}, { get: (_, name) => name });
    throw new Error(`Unexpected dependency: ${id}`);
  } });
  return module.exports;
}
mocks['@/hooks/use-screen-settled'] = load('hooks/use-screen-settled.ts');
const { PetStatsPanel } = load('components/pet/PetStatsPanel.tsx');
function host() { return { cursor: 0, slots: [], effects: [], changed: false }; }
function render(instance, component, props) {
  let tree;
  do {
    current = instance; instance.cursor = 0; instance.changed = false;
    tree = component(props);
    while (instance.effects.length) instance.effects.shift()();
  } while (instance.changed);
  return tree;
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree?.props ? [tree, ...nodes(tree.props.children)] : [];
}
const panelHost = host(), ringHost = host();
let wisdom = 19, visible = true, ring;
function update() {
  const panel = render(panelHost, PetStatsPanel, { stats: { hunger: 80, happiness: 90 }, wisdom, compact: true, visible });
  const entry = nodes(panel).find(node => node.props.stat?.icon === 'lightbulb');
  ring = nodes(render(ringHost, entry.type, entry.props));
}
function displayed() {
  const text = ring.find(node => node.type === 'SkiaText').props.text.get();
  const end = ring.find(node => node.type === 'Path').props.end.get();
  assert.equal(text, `${Math.round(end * 100)}%`, 'Ring and number follow the same animated value');
  return Number(text.slice(0, -1));
}
const advance = ms => { now += ms; update(); };
update(); assert.equal(displayed(), 19);
emit('transitionStart', true); focused = false; emit('blur'); update();
wisdom = 20; update(); advance(2000);
wisdom = 22; update(); advance(3000);
assert.equal(displayed(), 19, 'Hidden Home retains its last visible value across puzzle rewards');
assert.equal([...sharedValues].reduce((sum, value) => sum + value.starts, 0), 0, 'Rewards cannot animate offscreen');
emit('transitionEnd', true); focused = true; emit('focus'); update();
assert.equal(displayed(), 19, 'Focus alone cannot consume the animation under the return transition');
emit('transitionStart', false); advance(350);
assert.equal(displayed(), 19);
emit('transitionEnd', false); update();
advance(450); assert.ok(displayed() > 19 && displayed() < 22, 'The returned screen shows the value counting up');
advance(450); assert.equal(displayed(), 22);
const starts = [...sharedValues].reduce((sum, value) => sum + value.starts, 0);
assert.equal(starts, 2, 'Coalesced rewards animate the ring and pulse once');
emit('transitionStart', true); focused = false; emit('blur'); update();
focused = true; emit('transitionEnd', false); update(); advance(1000);
assert.equal([...sharedValues].reduce((sum, value) => sum + value.starts, 0), starts, 'Returning without changes never replays feedback');

visible = false; wisdom = 30; update(); advance(1000);
assert.equal(displayed(), 22, 'Hidden cached rooms and decoration mode retain pending feedback');
visible = true; update(); advance(200); const interrupted = displayed();
assert.ok(interrupted > 22 && interrupted < 30);
foreground = false; update(); advance(5000);
assert.equal(displayed(), interrupted, 'Backgrounding freezes the actual displayed progress');
foreground = true; update(); advance(900);
assert.equal(displayed(), 30, 'Interrupted feedback resumes from the displayed value');
visible = false; wisdom = 35; reducedMotion = true; update(); advance(1000);
assert.equal(displayed(), 30);
visible = true; update(); assert.equal(displayed(), 35, 'Reduced motion snaps on return without a pulse');
reducedMotion = false; wisdom = 40; update();
for (const instance of [panelHost, ringHost]) for (const slot of instance.slots) slot?.cleanup?.();
assert.ok([...sharedValues].every(value => !value.pending()), 'Unmount cancels all animated values');
assert.ok([...listeners.values()].every(value => value.size === 0), 'Unmount removes navigation listeners');
platform = 'web'; focused = false;
const webHost = host();
assert.equal(render(webHost, mocks['@/hooks/use-screen-settled'].useScreenSettled), false);
focused = true;
assert.equal(render(webHost, mocks['@/hooks/use-screen-settled'].useScreenSettled), true, 'Web needs no native transition event');

// Execute the authored callback rather than a duplicate of its routing logic.
const source = ts.createSourceFile('app/play.tsx', fs.readFileSync('app/play.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'handleGoHome') callback = node.initializer.arguments[0];
  ts.forEachChild(node, visit);
}
visit(source); assert.ok(callback);
function goHome({ isReplay = false, isCorrect = true, sessionIndex = 0, puzzles = [1, 2] } = {}) {
  const calls = [];
  const context = { isReplay, isCorrect, sessionIndex, puzzles,
    exitToPath: options => calls.push(['path', options]),
    router: { dismissTo: href => calls.push(['dismissTo', href]), replace: href => calls.push(['replace', href]) } };
  vm.runInNewContext(`(${callback.getText(source)})()`, context);
  return calls;
}
assert.deepEqual(goHome(), [['dismissTo', '/']], 'Go home preserves the existing screen and its previous stat values');
assert.equal(goHome({ isReplay: true })[0][0], 'path', 'Replay retains puzzle-path navigation');
assert.equal(goHome({ sessionIndex: 1 })[0][1].tierJustCompleted, true, 'Tier completion retains its path celebration');
console.log('Pet stats retain hidden rewards, animate after return, resume interruptions, respect reduced motion, and preserve Home navigation.');
