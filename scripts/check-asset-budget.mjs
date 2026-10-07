import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function assetFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? assetFiles(file) : /\.(png|webp|mp4|glb)$/.test(file) ? [file] : [];
  });
}
const files = assetFiles('assets');
const models = files.filter(file => file.endsWith('.glb'));
const bytes = paths => paths.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const modelBytes = bytes(models), totalBytes = bytes(files);
assert.equal(models.length, 293, 'Ship the complete native catalog, cats, and room effects');
assert.ok(modelBytes <= 60 * 1024 ** 2, 'Native models exceed the 60 MiB budget');
assert.ok(totalBytes <= 100 * 1024 ** 2, 'Game assets exceed the 100 MiB budget');
console.log(`Native catalog: ${models.length} GLBs, ${(modelBytes / 1024 ** 2).toFixed(1)} MiB. All game media: ${(totalBytes / 1024 ** 2).toFixed(1)} MiB.`);
