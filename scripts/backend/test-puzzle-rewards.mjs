/** Run the real seed generator against an isolated filesystem with future curriculum IDs. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

test('new boss stages receive double rewards; practice and challenges retain regular rates; rerunning is idempotent', () => {
  const catalog = { lessons: ['easy', 'medium', 'hard'].map(tier => ({ levels: [
    { kind: 'boss', puzzleIds: [`future-${tier}-stage`] },
    { kind: 'practice', puzzleIds: [`future-${tier}-practice`] },
    { kind: 'challenge', puzzleIds: [`future-${tier}-challenge`] },
  ] })) };
  const files = new Map([['data/puzzle-curriculum.json', JSON.stringify(catalog)]]);
  for (const tier of ['easy', 'medium', 'hard']) {
    files.set(`assets/puzzles/${tier}.json`, JSON.stringify(['stage', 'practice', 'challenge'].map(kind => ({ id: `future-${tier}-${kind}` }))));
  }
  const writes = [];
  const mockFs = {
    readFileSync: path => { assert.ok(files.has(path), path); return files.get(path); },
    readdirSync: dir => [...files.keys()].filter(path => path.startsWith(dir + '/')).map(path => path.slice(dir.length + 1)),
    writeFileSync: (path, text, options) => { assert.equal(options.flag, 'wx'); assert.equal(files.has(path), false); files.set(path, text); writes.push(text); },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('scripts/backend/generate-wallet-catalog.mjs', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, allowJs: true },
    fileName: 'generator.ts',
  }).outputText;
  function run() {
    vm.runInNewContext(source, { module, exports: module.exports, console: { log() {} }, process: { cwd: () => '/fixture' }, require: id => {
      if (id === 'node:fs') return mockFs;
      if (id === '../catalog/sync.mjs') return { syncCatalog: () => ({}) };
      throw new Error(id);
    } });
  }
  run();
  assert.equal(writes.length, 1);
  for (const [tier, first, replay] of [['easy', 4, 2], ['medium', 7, 3], ['hard', 9, 4]]) {
    assert.ok(writes[0].includes(`('future-${tier}-stage',${first * 2},${replay * 2})`));
    for (const kind of ['practice', 'challenge']) assert.ok(writes[0].includes(`('future-${tier}-${kind}',${first},${replay})`));
  }
  run();
  assert.equal(writes.length, 1, 'Existing registrations are preserved on subsequent generator runs');
});
