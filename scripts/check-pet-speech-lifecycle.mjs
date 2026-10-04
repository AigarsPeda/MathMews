/** Exercise the real speech hook with navigation and a deterministic clock. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const slots = [], effects = [], timers = new Map();
let index = 0, now = 0, nextTimer = 0, changed = false;
let focusCallback, focusCleanup, context = "Let's solve a puzzle!", speech;
const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
const React = {
  useState(initial) {
    const i = index++;
    if (!(i in slots)) slots[i] = initial;
    return [slots[i], value => {
      if (!Object.is(slots[i], value)) { slots[i] = value; changed = true; }
    }];
  },
  useRef(initial) {
    const i = index++;
    return slots[i] ??= { current: initial };
  },
  useCallback(callback, deps) {
    const i = index++;
    if (!sameDeps(slots[i]?.deps, deps)) slots[i] = { callback, deps };
    return slots[i].callback;
  },
  useEffect(callback, deps) {
    const i = index++;
    if (!sameDeps(slots[i]?.deps, deps)) {
      effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: callback() }; });
    }
  },
};
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('hooks/use-pet-speech.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, {
  module, exports: module.exports,
  require: id => id === 'react' ? React : { useFocusEffect: callback => { focusCallback = callback; } },
  setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; },
  clearTimeout: id => timers.delete(id),
});
function render(nextContext = context) {
  context = nextContext;
  do {
    changed = false; index = 0;
    speech = module.exports.usePetSpeech(context);
    while (effects.length) effects.shift()();
  } while (changed);
}
function advance(ms) {
  now += ms;
  for (const [id, timer] of timers) {
    if (timer.at <= now) { timers.delete(id); timer.callback(); }
  }
  render();
}
function focus() { focusCleanup = focusCallback(); render(); }
function blur() { focusCleanup(); render(); }
function action(text) { speech.showSpeech(text); render(); }

render(); focus();
assert.equal(speech.speechMessage, context);
advance(3499);
assert.equal(speech.speechMessage, context, 'Reminder must remain readable');
advance(1);
assert.equal(speech.speechMessage, null, 'Reminder must release the room');
render(); advance(10000);
assert.equal(speech.speechMessage, null, 'Ordinary rerenders must not restart a reminder');

blur(); focus();
action('Purr!'); advance(1000);
render('I am hungry!');
assert.equal(speech.speechMessage, 'Purr!', 'A changed mood must not interrupt action feedback');
advance(1800);
assert.equal(speech.speechMessage, null, 'Action expiry must not resurrect the contextual reminder');
advance(5000);
assert.equal(speech.speechMessage, null);
render('Time for bed!');
assert.equal(speech.speechMessage, 'Time for bed!', 'A new need may show a fresh brief reminder');
action('First response'); advance(1500); action('Latest response'); advance(1300);
assert.equal(speech.speechMessage, 'Latest response', 'An older timeout must not dismiss a newer response');
advance(1500);
assert.equal(speech.speechMessage, null);

action('Leaving'); blur();
assert.equal(timers.size, 0, 'Leaving Home must cancel pending speech timers');
render('Changed while away'); advance(5000);
assert.equal(speech.speechMessage, null, 'An unfocused screen must stay quiet');
focus();
assert.equal(speech.speechMessage, 'Changed while away', 'Return to Home must use the latest context');
blur();
for (const slot of slots) slot?.cleanup?.();
assert.equal(timers.size, 0, 'Unmount must leave no speech timers');
console.log('Pet speech timing, action priority, and navigation cleanup checks passed.');
