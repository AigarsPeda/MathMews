/** Run the real registry methods through delayed sync and re-animation scenarios. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';

const root = 'node_modules/react-native-reanimated/';
const cpp = fs.readFileSync(root + 'Common/cpp/reanimated/Fabric/updates/AnimatedPropsRegistry.cpp', 'utf8');
const header = fs.readFileSync(root + 'Common/cpp/reanimated/Fabric/updates/AnimatedPropsRegistry.h', 'utf8');
const stripIncludes = source => source.replace(/^#(?:include|pragma).*$/gm, '');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'brainpet-settled-props-'));
const source = `
#include <cassert>
#include <cstdint>
#include <functional>
#include <memory>
#include <string>
#include <string_view>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>
#define REACT_NATIVE_VERSION_MINOR 86
#define react_native_assert assert
namespace folly { using dynamic = double; }
namespace jsi {
struct Runtime {};
struct Object;
struct Value {
  double number = 0;
  std::shared_ptr<Object> object;
  Value() = default;
  Value(double value): number(value) {}
  Value(Runtime&, const Object&);
  Object asObject(Runtime&) const;
};
struct Object {
  mutable std::unordered_map<std::string, Value> properties;
  mutable std::vector<Value> items;
  explicit Object(Runtime&) {}
  Object(Runtime&, size_t size): items(size) {}
  Object asArray(Runtime&) const { return *this; }
  size_t size(Runtime&) const { return items.size(); }
  Value getValueAtIndex(Runtime&, size_t i) const { return items.at(i); }
  void setValueAtIndex(Runtime&, size_t i, const Object& value) const { Value v; v.object = std::make_shared<Object>(value); items.at(i) = v; }
  Value getProperty(Runtime&, const char* name) const { return properties.at(name); }
  void setProperty(Runtime&, const char* name, Value value) const { properties[name] = value; }
};
using Array = Object;
Value::Value(Runtime&, const Object& value): object(std::make_shared<Object>(value)) {}
Object Value::asObject(Runtime&) const { assert(object); return *object; }
folly::dynamic dynamicFromValue(Runtime&, const Value& value) { return value.number; }
Value valueFromDynamic(Runtime&, const folly::dynamic& value) { return Value(value); }
}
namespace reanimated {
using Tag = int;
struct ShadowNode {
  int tag;
  Tag getTag() const { return tag; }
  Tag getFamilyShared() const { return tag; }
};
template<class T> struct Bridging {
  static std::shared_ptr<const ShadowNode> fromJs(jsi::Runtime&, const jsi::Value& v) { return std::make_shared<ShadowNode>(ShadowNode{static_cast<int>(v.number)}); }
};
struct StaticFeatureFlags {
  static constexpr bool getFlag(std::string_view name) { return name == "FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS"; }
};
struct UpdatesRegistryManager { static bool isLockedByCurrentThread() { return true; } };
struct UpdatesRegistry {
  std::unordered_map<Tag, std::pair<Tag, folly::dynamic>> updatesRegistry_;
  virtual void removeTag(Tag) = 0;
  void addUpdatesToBatch(Tag tag, folly::dynamic value) { updatesRegistry_[tag] = {tag, value}; }
  void addJSIPropsToAnimatedPropsBatch(Tag, jsi::Runtime&, const jsi::Value&) {}
};
}
${stripIncludes(header).replace(' private:', ' public:')}
${stripIncludes(cpp)}
using namespace reanimated;
int main() {
  jsi::Runtime rt;
  AnimatedPropsRegistry registry;
  auto record = [&](Tag tag, double value, double timestamp) {
    jsi::Array operations(rt, 1);
    jsi::Object item(rt);
    item.setProperty(rt, "shadowNodeWrapper", tag);
    item.setProperty(rt, "updates", value);
    operations.setValueAtIndex(rt, 0, item);
    registry.update(rt, jsi::Value(rt, operations), timestamp);
  };
  auto collect = [&](double timestamp) { return registry.collectSettledUpdates(rt, timestamp).asObject(rt); };
  record(1, .2, 0);
  auto first = collect(10000); // JS blocked / app paused beyond the old two-second eviction threshold
  assert(first.items.size() == 1 && first.items[0].object->properties.at("styleProps").number == .2);
  assert(registry.updatesRegistry_.contains(1)); // React must receive the value before eviction
  assert(collect(10001).items.empty() && !registry.updatesRegistry_.contains(1));
  record(1, .4, 10002); // React still has .2; a fresh animation must invalidate that snapshot
  auto fresh = collect(9000);
  assert(fresh.items.size() == 1 && fresh.items[0].object->properties.at("styleProps").number == .4);
  assert(collect(9001).items.empty()); // no repeated sync while still animating
  record(1, .6, 10003);
  assert(collect(11004).items.size() == 1);
  assert(collect(11005).items.empty()); // settle once, evict on the next tick
  registry.removeTag(1);
  assert(registry.syncedTags_.empty() && registry.invalidatedTags_.empty() && registry.timestampMap_.empty());
  record(1, .8, 12000); // recycled tag must not inherit the prior view's snapshot
  assert(collect(11000).items.empty());
  assert(collect(13001).items.size() == 1);
}
`;
try {
  fs.writeFileSync(path.join(work, 'test.cpp'), source);
  execFileSync(process.env.CXX || 'c++', ['-std=c++20', '-fsanitize=address,undefined', path.join(work, 'test.cpp'), '-o', path.join(work, 'test')], { stdio: 'pipe' });
  execFileSync(path.join(work, 'test'), { stdio: 'pipe' });
} finally { fs.rmSync(work, { recursive: true, force: true }); }

const module = { exports: {} };
let intervals = 0, active = 0, synced = [];
const collectorSource = fs.readFileSync(root + 'src/PropsRegistryGarbageCollector.ts', 'utf8');
vm.runInNewContext(ts.transpileModule(collectorSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  module, exports: module.exports, Map,
  setInterval: () => { active++; return ++intervals; }, clearInterval: () => { active--; },
  require: id => id === './ReanimatedModule'
    ? { ReanimatedModule: { getSettledUpdates: () => [{ viewTag: 9, styleProps: { width: 20 } }] } }
    : { unprocessColorsInProps() {} },
});
const collector = module.exports.PropsRegistryGarbageCollector;
const view = { _syncStylePropsBackToReact: value => synced.push(value) };
collector.registerView(1, view); collector.registerView(1, view);
assert.equal(active, 1);
collector.unregisterView(1); collector.unregisterView(1);
assert.equal(active, 0, 'Nested components sharing a native tag must stop the timer once');
collector.registerView(9, view);
assert.equal(active, 1, 'The next view must restart synchronization after duplicate unregisters');
collector.syncPropsBackToReact();
assert.equal(synced[0].width, 20);
collector.unregisterView(9);
assert.equal(active, 0);
console.log('Settled values survive long pauses, refresh on re-animation, sync once before eviction, and clear on unmount; nested-view collector restarts correctly.');

const theme = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('constants/puzzle-theme.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: theme.exports, module: theme, require: () => ({ GameColors: {} }) });
const { ProofMotion, Shape, proofTempo } = theme.exports;

// Run the production hook with a deterministic UI clock. Deliver timer and animation
// completions in order so a skipped or paused landing cannot finish the run twice.
function playback(count, options, reduced = false, host = {}) {
  let now = 0, cursor = 0, nextId = 0, pendingEffects = [], result;
  const slots = [], scheduled = new Map(), spoken = [];
  const schedule = (callback, duration) => {
    const id = ++nextId;
    scheduled.set(id, { at: now + duration, callback });
    return id;
  };
  function slot(initial) {
    const i = cursor++;
    return slots[i] ??= initial();
  }
  const hooks = {
    useState(initial) {
      const state = slot(() => ({ value: typeof initial === 'function' ? initial() : initial }));
      return [state.value, next => { state.value = typeof next === 'function' ? next(state.value) : next; }];
    },
    useRef(initial) { return slot(() => ({ current: initial })); },
    useEffect(apply, deps) {
      const state = slot(() => ({}));
      if (deps && state.deps?.every((x, i) => x === deps[i])) return;
      pendingEffects.push(() => { state.cleanup?.(); state.cleanup = apply(); state.deps = deps; });
    },
    useCallback(fn) { return fn; },
    useContext() { return host; },
    useLayoutEffect(apply, deps) { hooks.useEffect(apply, deps); },
  };
  const animated = {
    Easing: { out: () => null, inOut: () => null, cubic: null }, ReduceMotion: { Never: 0 },
    runOnJS: fn => fn, useReducedMotion: () => reduced,
    useSharedValue: initial => slot(() => ({
      value: initial,
      get() { return this.value; },
      set(next) {
        scheduled.delete(this.timer);
        if (typeof next === 'number') this.value = next;
        else this.timer = schedule(() => { this.value = next.value; next.callback?.(true); }, next.duration);
      },
    })),
    cancelAnimation(shared) { scheduled.delete(shared.timer); },
    withTiming: (value, { duration }, callback) => ({ value, duration, callback }),
  };
  const announcer = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/puzzle/kit/proofAnnouncements.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports: announcer.exports, module: announcer, setTimeout: schedule, clearTimeout: id => scheduled.delete(id),
    require: () => ({ AccessibilityInfo: { announceForAccessibilityWithOptions: (text, opts) => {
      assert.equal(opts.queue, false); spoken.push(text);
    } } }),
  });
  const hook = { exports: {} };
  const code = fs.readFileSync('components/puzzle/kit/useRevealBeats.ts', 'utf8');
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports: hook.exports, module: hook, Date: { now: () => now }, setTimeout: schedule, clearTimeout: id => scheduled.delete(id),
    require: id => id === 'react' ? hooks : id === 'react-native-reanimated' ? animated : id === './proofAnnouncements' ? announcer.exports : id === '@/constants/puzzle-theme' ? theme.exports : {},
  });
  const render = () => {
    cursor = 0; pendingEffects = [];
    result = hook.exports.useRevealBeats(count, options);
    pendingEffects.forEach(apply => apply());
    return result;
  };
  return {
    render, spoken,
    setCount(next) { count = next; return render(); },
    unmount() { slots.forEach(slot => slot.cleanup?.()); },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...scheduled].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        now = next[1].at; scheduled.delete(next[0]); next[1].callback(); render();
      }
      now = end; return render();
    },
  };
}
for (const reducedMotion of [false, true]) {
  let completed = 0;
  const waiting = playback(null, { lead: 100, step: 180, hold: 120, minTotal: 0, reducedSteps: true, onDone: () => completed++ }, reducedMotion);
  assert.equal(waiting.render().preparing, true);
  assert.equal(waiting.advance(2000).settled, false);
  assert.equal(waiting.render().done, false);
  assert.equal(completed, 0);
  assert.equal(waiting.setCount(1).settled, false);
  assert.equal(waiting.render().preparing, false);
  assert.equal(waiting.advance(1000).settled, true);
  assert.equal(completed, 1);
  assert.equal(waiting.setCount(null).settled, false);
  assert.equal(waiting.setCount(0).settled, true);
}
for (const explicitPaint of [false, true]) {
  const paints = [], events = [], host = { attemptKey: 'first attempt', onInitialModelPainted: run => paints.push(run), onProofFrame: event => events.push(event.phase) };
  const gate = playback(null, { awaitInitialPaint: explicitPaint, lead: 100, step: 200, hold: 120, minTotal: 0 }, false, host);
  gate.render().onInitialModelPainted(0);
  const first = gate.setCount(2);
  assert.equal(first.nativePaintPending, !explicitPaint);
  assert.equal(gate.advance(5000).landed, 0);
  assert.deepEqual(events, []);
  first.onInitialModelPainted(0);
  assert.equal(gate.render().preparing, false);
  assert.deepEqual(paints, [0]);
  first.onInitialModelPainted(0);
  assert.equal(gate.advance(300).landed, 1);
  gate.render().replay();
  const replay = gate.render();
  first.onInitialModelPainted(0);
  assert.equal(gate.advance(5000).preparing, true);
  replay.onInitialModelPainted(1);
  gate.render().skip();
  assert.equal(gate.advance(5000).landed, 2);
  host.attemptKey = 'retry';
  const retry = gate.render();
  assert.equal(retry.preparing, true);
  retry.onInitialModelPainted(retry.runId);
  gate.render();
  replay.onInitialModelPainted(1);
  assert.equal(gate.render().preparing, false);
  assert.deepEqual(paints, [0, 1, retry.runId]);
  assert.deepEqual(events, ['ready', 'playing', 'landing', 'ready', 'skipped', 'settled', 'ready']);
}
// Start at the requested lead until the native scheduling headroom takes effect.
for (const [lead, expected] of [[0, 0], [100, 100], [179, 179], [180, 180], [200, 180], [300, 180]]) {
  const events = [];
  const clock = playback(1, { lead }, false, { attemptKey: 'lead audit', onProofFrame: ({ phase }) => events.push(phase) });
  clock.render().onInitialModelPainted(0);
  clock.render();
  if (expected) clock.advance(expected - 1);
  assert.deepEqual(events, ['ready']);
  clock.advance(expected ? 1 : 0);
  assert.deepEqual(events, ['ready', 'playing']);
  assert.equal(proofTempo({ rounds: 3, lead }).lead, expected);
  clock.unmount();
}
console.log('Verified the 180 ms first-movement cap and preserved shorter leads in the production clock and tempo helper.');
// A pause before the first motion must not advance the audit's start timestamp.
{
  const events = [];
  const host = { attemptKey: 'clock audit', onProofFrame: ({ phase, runId, landed }) => events.push([phase, runId, landed]) };
  const clock = playback(3, { lead: 100, step: 200, hold: 120, minTotal: 0 }, false, host);
  clock.render().onInitialModelPainted(0);
  clock.render().pause();
  clock.render().resume();
  clock.advance(99);
  assert.deepEqual(events, [['ready', 0, 0], ['paused', 0, 0]]);
  clock.advance(201).pause();
  clock.render().nextStep();
  clock.render().resume();
  clock.advance(1000);
  assert.deepEqual(events.slice(2), [['playing', 0, 0], ['landing', 0, 1], ['paused', 0, 1],
    ['landing', 0, 2], ['playing', 0, 2], ['landing', 0, 3], ['settled', 0, 3]]);
  clock.render().replay();
  clock.render().onInitialModelPainted(1);
  clock.render().skip();
  assert.deepEqual(events.slice(-3), [['ready', 1, 0], ['skipped', 1, 0], ['settled', 1, 3]]);
}
let completions = 0;
const join = playback(1, { lead: 100, step: 180, hold: 120, minTotal: 0, reducedSteps: true, onDone: () => completions++ });
join.render();
assert.equal(join.advance(279).landed, 0);
assert.equal(join.advance(1).landed, 1);
assert.equal(join.advance(119).settled, false);
assert.equal(join.advance(1).settled, true);
join.render().skip();
assert.equal(completions, 1);
join.render().replay();
assert.equal(join.render().landed, 0);
join.advance(120).skip();
assert.equal(join.advance(2000).settled, true);
assert.equal(completions, 2);

const group = playback(2, { lead: 100, step: 180, hold: n => n === 1 ? 1000 : 120, minTotal: 0, reducedSteps: true });
group.render();
group.advance(480).pause(); // 200 ms into the first inspection hold
assert.equal(group.advance(9000).landed, 1);
group.render().resume();
assert.equal(group.advance(979).landed, 1); // 800 ms hold + 179 ms travel
assert.equal(group.advance(1).landed, 2);
assert.equal(group.advance(120).settled, true);

const reduced = playback(3, { lead: 100, step: 180, hold: 120, minTotal: 0, reducedSteps: true }, true);
reduced.render();
reduced.advance(220).pause();
assert.equal(reduced.advance(1500).landed, 1);
reduced.render().nextStep();
assert.equal(reduced.render().landed, 2);
reduced.render().nextStep();
assert.equal(reduced.render().landed, 3);
assert.equal(reduced.render().settled, false);
reduced.render().nextStep();
assert.equal(reduced.render().settled, true);
console.log('Verified the 400 ms join, paused group holds, skip, replay and each Reduce Motion landing.');

const speech = playback(3, { lead: 100, step: 180, hold: 120, minTotal: 0 });
speech.render().announce('first', 100);
speech.render().announce('last', 100);
speech.advance(100);
assert.deepEqual(speech.spoken, ['last']);
for (const action of ['pause', 'nextStep', 'skip', 'replay', 'cancelAnnouncements']) {
  speech.render().announce('stale', 10);
  speech.render()[action]();
  speech.advance(20);
  assert.deepEqual(speech.spoken, ['last'], action);
}
speech.render().announce('edited away', 10);
speech.unmount(); speech.advance(20);
assert.deepEqual(speech.spoken, ['last']);

assert.equal(Shape.tile(24), 4.32);
assert.equal(Shape.barTop(24, 4), 1);
assert.equal(Shape.empty, '#DDE3EC');
assert.equal(Shape.emptyLip, '#C5CEDA');
assert.equal(Shape.stroke.seam, 0);
assert.equal(Shape.seamColor.toLowerCase(), '#ffffff');
assert.equal(ProofMotion.land, 140);
assert.equal(ProofMotion.finale, 240);
for (const dense of [false, true]) for (const kind of ['deal', 'pour', 'exchange', 'symmetry']) {
  // Each ten-for-one exchange is a separate operation in the supported place-value questions.
  for (const rounds of kind === 'exchange' ? [1, 2, 3] : [1, 6, 7, 12, 24, 75]) {
    const plan = proofTempo({ rounds, dense, kind });
    let elapsed = plan.lead + ProofMotion.finale, travel = 0;
    const counts = [];
    for (let i = 0; i < plan.count; i++) {
      const hold = plan.hold(i + 1);
      elapsed += plan.step(i) + hold;
      travel += plan.step(i);
      if (i > 0) assert.equal(plan.step(i), plan.roundDur);
      assert.ok(hold <= 400);
      counts.push(plan.roundsAt(i + 1));
      if (i + 1 < plan.count) assert.equal(hold, kind === 'pour' ? 0 : kind === 'exchange' ? ProofMotion.inspection : 200);
    }
    assert.ok(travel >= 999.99);
    assert.ok(plan.lead <= 200);
    assert.equal(plan.roundDur, Math.max(100, Math.min(240, 1500 / rounds)));
    assert.equal(counts.at(-1), rounds);
    assert.ok(counts.every((v, i) => i === 0 || v > counts[i - 1]));
    assert.ok(elapsed <= plan.budget, `${rounds} ${kind}, dense=${dense}, ${elapsed} ms`);
  }
}
console.log('Verified radius, seam, landing and finale tokens, round budgets, and cancellation on pause, step, skip, replay, edit and unmount.');

// On Fabric, flattening the model wrapper when it becomes touchable detaches its Skia canvases.
const surfaceModule = { exports: {} };
const jsx = (type, props, key) => ({ type, props, key });
const surfaceHaptics = [];
let surfaceFontScale = 1;
const surfaceMocks = {
  './proofHaptics': { landTick: () => surfaceHaptics.push('tick') },
  'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
  react: { createContext: value => value, useContext: value => value, useRef: current => ({ current }) },
  './RevealPlayContext': { RevealPlayContext: {} },
  'react-native': { useWindowDimensions: () => ({ fontScale: surfaceFontScale }), View: 'View', Pressable: 'Pressable', StyleSheet: { create: x => x } },
  'react-i18next': { useTranslation: () => ({ t: key => key }) },
  'react-native-reanimated': { default: { View: 'Animated.View' }, ReduceMotion: { Never: 'never' },
    FadeIn: { duration: () => ({ reduceMotion: () => 'fade' }) } }, '@shopify/react-native-skia': {},
  '@/components/puzzle/PuzzleText': { PuzzleText: 'Text' },
  '@/constants/puzzle-theme': theme.exports, '@/utils/scale': { moderateScale: x => x },
  './ProofFeedback': { ProofPlaybackContext: { Provider: 'PlaybackContext' } },
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/puzzle/kit/RevealSurface.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { exports: surfaceModule.exports, module: surfaceModule, require: id => surfaceMocks[id] });
for (const settled of [false, true]) {
  const screen = surfaceModule.exports.RevealSurface({ beats: { settled, done: settled }, children: 'canvas' });
  const model = screen.props.children.props.children[0];
  assert.equal(model.props.children[0], 'canvas');
  assert.equal(model.props.collapsable, false, 'The same native parent must survive settling');
  assert.equal(model.props.pointerEvents, settled ? 'auto' : 'none');
}
for (const runId of [0, 1]) {
  const beats = { reduced: true, runId, nativePaintPending: true, onInitialModelPainted() {} };
  const screen = surfaceModule.exports.RevealSurface({ beats, children: 'canvas' });
  const [drawing, paintProbe] = screen.props.children.props.children[0].props.children;
  assert.equal(drawing.props.children, 'canvas');
  assert.equal(paintProbe.props.runId, runId);
  assert.notEqual(String(drawing.key), String(paintProbe.key), 'Reduce Motion drawing and paint probe must have distinct sibling keys');
}
console.log('Verified that the native model wrapper survives the transition to Watch again.');

const prep = playback(null, {});
const waitingScreen = surfaceModule.exports.RevealSurface({ beats: prep.render(), children: 'canvas' });
const controlRow = waitingScreen.props.children.props.children[1].props.children[1];
const controls = controlRow.props.children.props.children.filter(Boolean);
assert.deepEqual(Array.from(controls, button => button.props.accessibilityLabel), ['reveal.pause', 'reveal.skip']);
assert.ok(controls.every(button => button.props.disabled));

const { RevealSurface, RevealPlayContext } = surfaceModule.exports;
{
  RevealPlayContext.landingHaptics = true;
  RevealPlayContext.onProofFrame = ({ phase, runId, landed }) => surfaceHaptics.push([phase, runId, landed]);
  for (const overrides of [{}, { runId: 1 }, { skipped: true }, { settled: true }]) {
    const screen = RevealSurface({ beats: { landed: 1, runId: 0, ...overrides } });
    screen.props.value.onLanding();
    screen.props.value.onLanding();
  }
  assert.deepEqual(surfaceHaptics, ['tick', ['haptic', 0, 1]]);
  delete RevealPlayContext.landingHaptics;
  delete RevealPlayContext.onProofFrame;
}
const Host = ({ children }) => children;
const presses = [];
for (const phase of ['playing', 'paused', 'settled']) {
  const beats = { settled: phase === 'settled', paused: phase === 'paused', pause() {}, resume() {},
    nextStep: phase === 'paused' ? () => presses.push('step') : undefined,
    skip() { presses.push('skip'); }, replay() { presses.push('replay'); } };
  const [inlineProbe, inlineRow] = RevealSurface({ beats }).props.children.props.children[1].props.children;
  RevealPlayContext.Controls = Host;
  RevealPlayContext.onReplay = () => presses.push('hostReplay');
  const modelChildren = RevealSurface({ beats }).props.children.props.children;
  assert.equal(modelChildren.length, 2, 'Only the drawing and the portal belong in the hosted model');
  const outlet = modelChildren[1];
  assert.equal(outlet.type, Host);
  const [probe, hostedRow] = outlet.props.children.props.children;
  assert.deepEqual(probe, inlineProbe);
  assert.equal(probe.props.importantForAccessibility, 'no-hide-descendants');
  assert.deepEqual(Array.from(probe.props.children, sample => Array.from(sample.props.children,
    chip => chip.props.children.props.children.at(-1))), [
    ['reveal.pause', 'reveal.skip'], ['reveal.resume', 'reveal.nextStep', 'reveal.skip'], ['reveal.replay'],
  ]);
  const buttons = row => beats.settled ? [row.props.children] : Array.from(row.props.children.props.children).filter(Boolean);
  const hostedButtons = buttons(hostedRow);
  assert.deepEqual(hostedButtons.map(button => button.props.accessibilityLabel), buttons(inlineRow).map(button => button.props.accessibilityLabel));
  if (phase === 'paused') hostedButtons[1].props.onPress();
  hostedButtons.at(-1).props.onPress();
  assert.equal(RevealSurface({ beats, replayable: false }).props.children.props.children[1], false);
  delete RevealPlayContext.Controls;
  delete RevealPlayContext.onReplay;
}
assert.deepEqual(presses, ['skip', 'step', 'skip', 'hostReplay', 'replay']);
// At XL each measurement sample uses precisely the same icon and target as its visible control.
surfaceFontScale = 2.5;
RevealPlayContext.Controls = Host;
for (const phase of ['playing', 'paused', 'settled']) {
  const beats = { settled: phase === 'settled', paused: phase === 'paused', pause() {}, resume() {},
    nextStep: phase === 'paused' ? () => {} : undefined, skip() {}, replay() {} };
  const portal = RevealSurface({ beats }).props.children.props.children[1];
  const [probe, row] = portal.props.children.props.children;
  const buttons = beats.settled ? [row.props.children] : Array.from(row.props.children.props.children).filter(Boolean);
  const labels = beats.settled ? ['reveal.replay'] : beats.paused ? ['reveal.resume', 'reveal.nextStep', 'reveal.skip'] : ['reveal.pause', 'reveal.skip'];
  assert.deepEqual(buttons.map(b => b.props.accessibilityLabel), labels);
  const sample = probe.props.children.find(sample => sample.props.children.length === buttons.length);
  for (const [i, button] of buttons.entries()) {
    const measured = sample.props.children[i];
    assert.deepEqual(button.props.children, measured.props.children);
    assert.equal(button.props.children.props.allowFontScaling, false);
    assert.ok(!button.props.children.props.children.includes('reveal.'));
    const targetStyle = Object.assign({}, ...measured.props.style);
    assert.deepEqual([targetStyle.width, targetStyle.height], [44, 44]);
    assert.deepEqual(button.props.style({ pressed: false })[0], measured.props.style);
  }
}
surfaceFontScale = 1;
delete RevealPlayContext.Controls;
console.log('Verified the tallest localized playback row is reserved alongside its controls in both hosted and inline layouts.');

function loadKitComponent(file, mocks = {}) {
  const component = { exports: {} };
  const source = fs.readFileSync(`components/puzzle/kit/${file}.tsx`, 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  vm.runInNewContext(outputText, { module: component, exports: component.exports, require: id => mocks[id] ?? surfaceMocks[id] });
  return component.exports;
}
const { UnitRun, UnitRunGlyph } = loadKitComponent('UnitRun', { '@shopify/react-native-skia': { Rect: 'Rect', RoundedRect: 'RoundedRect' } });
for (const [columns, rows] of [[10, 1], [1, 10], [5, 2]]) {
  const pitch = 24, width = pitch * columns, height = pitch * rows;
  const props = { width, height, columns, count: 10, filled: 3, hue: 'violet' };
  const glyph = UnitRunGlyph({ x: 11, y: 13, ...props });
  const [background, units] = glyph.props.children;
  const native = UnitRun(props);
  assert.equal(glyph.props.transform[0].translateX, 11);
  assert.equal(glyph.props.transform[1].translateY, 13);
  assert.equal(background.props.color, Shape.seamColor);
  assert.equal(native.type, 'View', 'Native faces commit with native captions');
  assert.equal(native.props.style.backgroundColor, Shape.seamColor);
  assert.equal(units.length, 10);
  const bases = units.map(unit => unit.props.children[0].props);
  for (const [i, unit] of units.entries()) {
    const [lip, face] = unit.props.children.map(shape => shape.props);
    const nativeUnit = native.props.children[i];
    const nativeBase = nativeUnit.props.style;
    const nativeFace = nativeUnit.props.children.props.style;
    assert.deepEqual([nativeBase.left, nativeBase.top, nativeBase.width, nativeBase.height, nativeBase.borderRadius],
      [lip.x, lip.y, lip.width, lip.height, lip.r]);
    assert.equal(nativeBase.borderWidth ?? 0, 0);
    assert.equal(nativeBase.backgroundColor, lip.color);
    assert.equal(nativeFace.backgroundColor, face.color);
    assert.equal(lip.color, i < 3 ? theme.exports.Quantity.violet.edge : Shape.emptyLip);
    assert.equal(face.color, i < 3 ? theme.exports.Quantity.violet.fill : Shape.empty);
    assert.deepEqual([face.x, face.y, face.width, face.height], [lip.x, lip.y, lip.width, lip.height - 3]);
    assert.deepEqual([nativeFace.width, nativeFace.height], [face.width, face.height]);
    if (i % columns) assert.ok(Math.abs(lip.x - (bases[i - 1].x + bases[i - 1].width) - 4) < 1e-6);
    if (i >= columns) assert.ok(Math.abs(lip.y - (bases[i - columns].y + bases[i - columns].height) - 4) < 1e-6);
  }
  assert.ok(Math.abs(bases.at(-1).x + bases.at(-1).width - width) < 1e-6);
  assert.ok(Math.abs(bases.at(-1).y + bases.at(-1).height - height) < 1e-6);
}
const { ProofCaption } = loadKitComponent('Focus');
for (const text of ['8', '12', '10:15 − 45 minutes = 09:30', '08:45 + 30 minutes = 09:15']) {
  const lane = ProofCaption({ text, reserveTexts: ['8', '12'] });
  const visible = lane.props.children;
  assert.equal(lane.props.accessibilityLabel, text);
  assert.equal(visible.type, 'View', 'Replace the caption in place at landing');
  assert.equal(visible.props.children.props.children.props.children, text);
  const caption = visible.props.children.props.children;
  const nativeText = caption.type(caption.props);
  assert.equal(nativeText.props.numberOfLines, undefined, 'Allow every operand and the final value to wrap');
  assert.equal(nativeText.props.children, text);
}
console.log('Verified layout preparation before playback, same-render captions, and ten equal pieces with four-point gaps and three-point bottom lips.');

const { LinkedDetail } = loadKitComponent('DenseLayout', { './ProofFeedback': { ProofPlaybackContext: { playback: true } }, './Focus': {} });
const drawings = [];
LinkedDetail({ groups: [0, 1], active: 0, renderOverview: groups => groups, renderGroup: (i, size) => drawings.push([i, size]) });
assert.deepEqual(drawings, [[0, 'overview'], [1, 'overview']]);
console.log('Verified per-attempt and replay paint gates, stale acknowledgements, wrapping caption and overview-only checked proofs.');
