/** A failed speculative page must not hold up visible frames or care completion. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let slots = [], index = 0, effects = [], failureCount = 0;
const requests = [];
let fail = new Set([2]);
const slot = initial => { const i = index++; if (!(i in slots)) slots[i] = initial(); return [i, slots[i]]; };
const react = {
  useRef: value => slot(() => ({ current: value }))[1],
  useState: value => { const [i, current] = slot(() => value); return [current, next => { slots[i] = next; }]; },
  useEffect: (fn, deps) => {
    const [i, old] = slot(() => null);
    if (!old || deps.some((value, n) => value !== old.deps[n])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
  },
};
const mocks = {
  react,
  'react-native': { Image: { resolveAssetSource: uri => ({ uri }) } },
  '@shopify/react-native-skia': { Skia: {
    Data: { fromURI: async uri => { requests.push(uri); if (fail.has(uri)) throw Error('decode failed'); return uri; } },
    Image: { MakeImageFromEncoded: data => ({ texture: data }) },
  } },
};
const module = { exports: {} };
const source = ts.transpileModule(fs.readFileSync('pet-display/media/sprite/use-atlas-pages.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
vm.runInNewContext(source, { module, exports: module.exports, require: id => mocks[id], setTimeout, clearTimeout });
const sources = [1, 2];
function render() {
  index = 0; effects = [];
  const result = module.exports.useAtlasPages(sources, 0, false, true, () => failureCount++);
  effects.forEach(fn => fn()); return result;
}
render(); await new Promise(resolve => setTimeout(resolve, 0));
const pages = render();
assert.equal(pages.length, 1); assert.equal(pages[0].image.texture, 1);
assert.equal(failureCount, 0); assert.equal(requests.filter(id => id === 2).length, 2, 'Prefetch retries are bounded');
for (const entry of slots) entry?.cleanup?.();
slots = []; fail = new Set([1, 2]); requests.length = 0;
render(); await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(render().length, 0); assert.equal(failureCount, 1, 'An unrecoverable current page releases the semantic action');
assert.equal(requests.filter(id => id === 1).length, 2);
for (const entry of slots) entry?.cleanup?.();
console.log('Verified independent page commits, bounded decode retries, and semantic recovery on current-page failure.');
