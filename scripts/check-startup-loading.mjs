/** Loading must recover from failed assets without reporting fake completion. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function execute(file, require, extra = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require, Set, ...extra }, { filename: file });
  return module.exports;
}
const assetMocks = {
  '@/constants/cat-decorations': { CAT_DECORATION_CATALOG: { a: { source: 1 }, b: { source: 2 }, c: { source: 3 } } },
  '@/constants/cat-beds': { CAT_BED_SOURCES: { duplicate: 1 } },
  '@/constants/cat-rooms': { CAT_ROOM_SOURCES: {} },
  '@/assets/3d/native/cat-orange.glb': 1,
  '@/constants/cat-toys': { CAT_TOY_SOURCES: {} },
  'react-native': { Platform: { OS: 'ios' } },
  'expo-asset': { Asset: { fromModule: id => ({ downloaded: false, uri: String(id), downloadAsync: async () => { if (id === 2) throw Error('offline'); } }) } },
  'expo-image': { Image: { prefetch: async uri => uri !== '3' } },
};
const assets = execute('utils/prefetch-game-assets.ts', id => { assert.ok(id in assetMocks, id); return assetMocks[id]; });
const reports = [];
await assets.prefetchGameAssets(progress => reports.push(progress));
const final = reports.at(-1);
assert.equal(final.total, 3, 'Duplicate asset modules must not inflate progress');
assert.equal(final.completed, 3, 'Failed downloads must settle rather than hang startup');
assert.equal(final.failed, 2, 'Only successful assets count as ready');
assert.equal(final.completed - final.failed, 1);

let report, finish, timeout, cleared = false;
const gate = execute('lib/init-game-asset-prefetch.ts', () => ({ prefetchGameAssets: callback => {
  report = callback;
  callback({ completed: 0, total: 3, failed: 0 });
  return new Promise(resolve => { finish = resolve; });
} }), { setTimeout: callback => { timeout = callback; return 1; }, clearTimeout: () => { cleared = true; } });
let events = 0;
const unsubscribe = gate.subscribeGameAssetLoading(() => events++);
report({ completed: 1, total: 3, failed: 0 });
timeout();
const partial = gate.getGameAssetLoadingSnapshot();
assert.equal(partial.mayContinue, true, 'Slow downloads must not block gameplay forever');
assert.equal(partial.finished, false, 'Deadline must not claim downloads finished');
assert.equal(partial.completed, 1, 'Deadline must not advance actual progress');
report({ completed: 3, total: 3, failed: 1 });
finish();
await gate.gameAssetsPrefetchPromise;
assert.equal(gate.getGameAssetLoadingSnapshot().finished, true);
assert.equal(gate.getGameAssetLoadingSnapshot().failed, 1);
assert.equal(partial.completed, 1, 'Published snapshots must remain immutable for React');
assert.equal(cleared, true);
const priorEvents = events;
unsubscribe();
report({ completed: 3, total: 3, failed: 1 });
assert.equal(events, priorEvents, 'Unmounted listeners must be released');
console.log('Verified real loading counts, failed downloads, bounded waits, continued background work and subscription cleanup.');

let heldVisuals = 0, releaseVisual;
const visual = execute('contexts/StartupVisualContext.ts', id => {
  assert.equal(id, 'react');
  return {
    createContext: value => ({ value }),
    useContext: context => context.value,
    useLayoutEffect: callback => { releaseVisual?.(); releaseVisual = callback(); },
  };
});
visual.StartupVisualContext.value = () => { heldVisuals++; return () => { heldVisuals--; }; };
visual.useStartupVisualReady(false);
assert.equal(heldVisuals, 1, 'A mounted undecoded visual must hold the loading cover');
visual.useStartupVisualReady(true);
assert.equal(heldVisuals, 0, 'A decoded first frame must release the loading cover');
visual.useStartupVisualReady(false);
releaseVisual();
assert.equal(heldVisuals, 0, 'Unmounting a pending visual must release its loading hold');
console.log('Verified first-frame visual readiness and unmount cleanup.');
