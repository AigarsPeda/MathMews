import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const inventory = JSON.parse(fs.readFileSync('scripts/3d/inventory.json', 'utf8')).entries;
const requiredModels = [
  ...inventory.map(entry => entry.id),
  'cat-orange', 'cat-grey', 'cat-white', 'airflow', 'bowl-food-spill',
];
for (const id of requiredModels) {
  const file = path.join('assets/3d/native', `${id}.glb`);
  assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(), `Missing required native model: ${id}`);
}
console.log(`Verified ${requiredModels.length} required native model files.`);
