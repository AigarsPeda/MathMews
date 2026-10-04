import { spawnSync } from 'node:child_process';
const checks = ['check-game-systems', 'check-atlas-loading', 'check-video-lifecycle', 'check-sprite-continuity', 'check-room-activities', 'check-room-depth', 'check-room-decoration-motion', 'check-native-menus', 'check-cat-play', 'check-pet-speech-anchor', 'check-asset-budget'];
for (const check of checks) {
  const result = spawnSync(process.execPath, [`scripts/${check}.mjs`], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
