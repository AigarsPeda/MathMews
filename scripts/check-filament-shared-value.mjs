import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let rendering = false, cursor = 0;
const slots = [], effects = [], uiQueue = [], filamentQueue = [];
const sameDependencies = (previous, next) => previous && previous.length === next.length && previous.every((value, index) => Object.is(value, next[index]));
const react = {
  useRef(initial) {
    const index = cursor++;
    slots[index] ??= { current: initial };
    return slots[index];
  },
  useEffect(effect, dependencies) {
    const index = cursor++;
    if (sameDependencies(slots[index]?.dependencies, dependencies)) return;
    effects.push(() => {
      slots[index]?.cleanup?.();
      slots[index] = { dependencies, cleanup: effect() };
    });
  },
};
const workletContext = { createRunAsync: callback => value => filamentQueue.push(() => callback(value)) };
const mocks = {
  react,
  'react-native-filament': { useFilamentContext: () => ({ workletContext }) },
  'react-native-reanimated': { runOnUI: callback => () => uiQueue.push(callback) },
  'react-native-worklets-core': { useSharedValue: initial => react.useRef({ value: initial }).current },
};
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('hooks/use-filament-shared-value.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module, exports: module.exports, require: name => mocks[name] });
const { useFilamentSharedValue } = module.exports;

function shared(initial) {
  let value = initial, reads = 0;
  const listeners = new Map();
  return {
    get value() {
      assert.equal(rendering, false, 'A Reanimated value must never be read during render');
      reads++;
      return value;
    },
    get() { return this.value; },
    set(next) { value = next; for (const listener of listeners.values()) listener(next); },
    addListener: (id, listener) => listeners.set(id, listener),
    removeListener: id => listeners.delete(id),
    get reads() { return reads; },
    listeners,
  };
}
function render(source, initialValue) {
  cursor = 0;
  rendering = true;
  try { return useFilamentSharedValue(source, initialValue); }
  finally { rendering = false; }
}
function drain(queue) { while (queue.length) queue.shift()(); }
function commit() { drain(effects); drain(uiQueue); drain(filamentQueue); }

const first = shared(3);
const target = render(first, 0);
assert.equal(target.value, 0);
assert.equal(first.reads, 0, 'Initialization uses the explicit fallback');
first.set(5);
commit();
assert.equal(target.value, 5, 'Initial synchronization reads the latest value after commit');
assert.equal(first.listeners.size, 1);
first.set(9);
drain(filamentQueue);
assert.equal(target.value, 9, 'UI changes reach the Filament runtime');
const reads = first.reads;
assert.equal(render(first, 0), target);
commit();
assert.equal(first.reads, reads, 'Renders do not re-read the source or resubscribe');
assert.equal(first.listeners.size, 1);

const replacement = shared(undefined);
assert.equal(render(replacement, undefined), target);
commit();
assert.equal(target.value, undefined, 'An undefined drag base is synchronized too');
assert.equal(first.listeners.size, 0, 'Replacing a source detaches its listener');
assert.equal(replacement.listeners.size, 1);
first.set(100);
drain(filamentQueue);
assert.equal(target.value, undefined, 'Detached sources cannot change the bridge');
replacement.set({ session: 2 });
drain(filamentQueue);
assert.deepEqual(target.value, { session: 2 });
for (const slot of slots) slot?.cleanup?.();
drain(uiQueue);
assert.equal(replacement.listeners.size, 0, 'Unmounting removes the active listener');

console.log('Filament bridge initializes, tracks updates and source replacement, and cleans up without render-time Reanimated reads.');
