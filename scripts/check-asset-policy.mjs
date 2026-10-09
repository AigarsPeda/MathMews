/** Catalog additions and size growth are allowed; missing required models are not. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./check-asset-catalog.mjs', import.meta.url));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mathmews-asset-policy-'));
try {
  const native = path.join(fixture, 'assets/3d/native');
  fs.mkdirSync(native, { recursive: true });
  fs.mkdirSync(path.join(fixture, 'scripts/3d'), { recursive: true });
  fs.writeFileSync(path.join(fixture, 'scripts/3d/inventory.json'), JSON.stringify({ entries: [{ id: 'test-item' }] }));
  for (const id of ['test-item', 'cat-orange', 'cat-grey', 'cat-white', 'airflow', 'bowl-food-spill']) {
    fs.writeFileSync(path.join(native, `${id}.glb`), 'fixture');
  }
  const summary = path.join(fixture, 'summary.md');
  const run = () => spawnSync(process.execPath, [script], {
    cwd: fixture, encoding: 'utf8',
    env: { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: summary },
  });
  const baseline = run();
  assert.equal(baseline.status, 0, baseline.stderr);
  assert.ok(!baseline.stdout.includes('::warning'));

  const extra = path.join(native, 'new-room-effect.glb');
  fs.writeFileSync(extra, 'fixture');
  assert.equal(run().status, 0, 'Additional models must not require changing a fixed file count');
  fs.truncateSync(extra, 61 * 1024 ** 2);
  const image = path.join(fixture, 'assets/large.png');
  fs.writeFileSync(image, 'fixture');
  fs.truncateSync(image, 40 * 1024 ** 2);
  const oversized = run();
  assert.equal(oversized.status, 0, oversized.stderr);
  assert.ok(!oversized.stdout.includes('::warning'));
  assert.ok(!oversized.stdout.includes('MiB'));
  assert.equal(oversized.stderr, '');
  assert.ok(!fs.existsSync(summary), 'Asset checks must not generate a size report');

  fs.renameSync(path.join(native, 'test-item.glb'), path.join(native, 'unrelated-item.glb'));
  const missing = run();
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Missing required native model: test-item/);
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
console.log('Verified new models and oversized assets pass without size warnings or reports, while missing required models fail.');
