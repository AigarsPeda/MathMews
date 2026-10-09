import { spawnSync } from 'node:child_process';
const checks = ['check-crash-recovery', 'check-room-camera', 'check-room-transition', 'check-native-room', 'check-operation-path', 'check-number-line', 'check-game-systems', 'check-video-lifecycle', 'check-room-activities', 'check-room-depth', 'check-room-decoration-motion', 'check-native-menus', 'check-app-icons', 'check-cat-play', 'check-pet-speech-anchor', 'check-pet-speech-lifecycle', 'check-store-expansion', 'check-store-categories', 'check-asset-budget'];
for (const check of checks) {
  const result = spawnSync(process.execPath, [`scripts/${check}.mjs`], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
