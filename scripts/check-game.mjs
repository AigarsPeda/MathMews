import { spawnSync } from 'node:child_process';
const checks = ['check-world-clock', 'check-crash-recovery', 'check-room-camera', 'check-room-transition', 'check-native-room', 'check-operation-path', 'check-function-machine', 'check-number-line', 'check-game-systems', 'check-video-lifecycle', 'check-room-activities', 'check-cat-bedtime', 'check-room-depth', 'check-room-decoration-motion', 'check-room-decoration-controls', 'check-room-controls-transition', 'check-native-menus', 'check-app-icons', 'check-cat-play', 'check-pet-speech-anchor', 'check-pet-speech-lifecycle', 'check-store-expansion', 'check-store-categories', 'check-store-placement-flow', 'check-asset-policy', 'check-asset-catalog'];
checks.push('check-placement-bounds', 'check-room-item-placement', 'check-room-performance', 'check-room-picking', 'check-world-weather', 'check-weather-control', 'check-curtains', 'check-pet-stat-animation', 'check-contact-shadows', 'check-native-shadows', 'check-wall-spotlights', 'check-fridges', 'check-item-interactions');
checks.push('check-simple-graphics-layout');
checks.push('check-cat-locomotion');
checks.push('check-cat-task-chains');
checks.push('check-room-activity-notice');
checks.push('check-cat-command-motion');
checks.push('check-cat-turning');
checks.push('check-cat-gaits');
checks.push('check-cat-jumps');
checks.push('check-cat-jump-anatomy');
checks.push('check-cat-landing-walk');
checks.push('check-rocking-chair-navigation');
checks.push('check-furniture-perches');
checks.push('check-furniture-transfers');
checks.push('check-catalog-furniture-jumps');
checks.push('check-close-furniture-jumps');
checks.push('check-cat-tail-contact');
checks.push('check-cat-expression');
checks.push('check-cat-waking');
checks.push('check-cat-fluid-motion');
checks.push('check-cat-room-flow');
checks.push('check-curriculum');
for (const check of checks) {
  const result = spawnSync(process.execPath, [`scripts/${check}.mjs`], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
