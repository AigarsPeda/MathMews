import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

// These exercise UI rendering/drag internals, not auth, wallets or persistence.
const ui = ['test-screen-renders.mjs', 'test-room-drag-motion.mjs', 'test-room-drag-surface.mjs'];
const args = process.argv.slice(2);
if (args.some(arg => !['--ui', '--list'].includes(arg))) {
  console.error('Usage: node scripts/check-backend.mjs [--ui] [--list]');
  process.exit(1);
}
const checks = (args.includes('--ui') ? ui : fs.readdirSync('scripts/backend')
  .filter(file => /^test-.*\.mjs$/.test(file) && !ui.includes(file)))
  .sort().map(file => `scripts/backend/${file}`);
if (args.includes('--list')) {
  console.log(checks.join('\n'));
} else {
  const result = spawnSync(process.execPath, ['--test', ...checks], { stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  process.exit(result.status ?? 1);
}
