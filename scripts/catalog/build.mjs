/** npm run catalog:build -- room31 [room32 ...]; omit IDs to rebuild all rooms. */
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { planCatalog, syncCatalog } from './sync.mjs';

const args = process.argv.slice(2);
// Validate selection before sync writes any generated files.
const plan = planCatalog(process.cwd());
const ids = args.length ? [...new Set(args)] : plan.rooms.map(room => room.id);
for (const id of ids) if (!plan.rooms.some(room => room.id === id)) throw new Error(`Unknown room: ${id}`);
const result = syncCatalog(process.cwd());
const blender = process.env.BLENDER_BIN || (process.platform === 'darwin' ? '/Applications/Blender.app/Contents/MacOS/Blender' : 'blender');
const env = { ...process.env, BRAINPET_BLENDER_ASSET_DIR: process.env.BRAINPET_BLENDER_ASSET_DIR || path.join(os.tmpdir(),'brainpet-catalog-blends') };
function run(command,args) {
  const result = spawnSync(command,args,{stdio:'inherit',env});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
for (const id of ids) run(blender,['--background','--python-exit-code','1','--python','scripts/3d/render_assets.py','--','--only',id,'--refresh']);
run(blender,['--background','--python-exit-code','1','--python','scripts/3d/export-native.py','--','--items',...ids.map(id => `--id=${id}`)]);
run(process.execPath,['scripts/3d/verify.mjs']);
console.log(`Built ${ids.length} rooms.${result.migration ? ` Apply ${result.migration} to register their initial server prices.` : ''}`);
