import { spawnSync } from 'node:child_process';

// Default CI protects saved data, money, learning and completion of user actions.
// Add a check here only if its failure demonstrates a broken user flow or data.
const core = [
  "check-world-clock",
  "check-crash-recovery",
  "check-game-systems",
  "check-store-placement-flow",
  "check-room-editing",
  "check-room-transition",
  "check-cat-task-chains",
  "check-cat-collision-recovery",
  "check-filament-shared-value",
  "check-filament-surface-lifetime",
  "check-curriculum",
  "check-puzzle-experience",
  "check-puzzle-replay",
  "check-puzzle-clarity",
  "check-puzzle-drag",
  "check-result-dismissal",
  "check-answer-feedback",
  "check-locales",
  "puzzles/test-catalog"
];

// Detailed rendering, animation anatomy, catalog sweeps and timing measurements
// belong to explicit feature/release audits, not every unrelated change.
const extended = [
  "check-room-camera",
  "check-native-room",
  "check-operation-path",
  "check-number-line",
  "check-video-lifecycle",
  "check-room-activities",
  "check-cat-bedtime",
  "check-room-depth",
  "check-room-decoration-motion",
  "check-room-decoration-controls",
  "check-room-controls-transition",
  "check-native-menus",
  "check-app-icons",
  "check-cat-play",
  "check-pet-speech-anchor",
  "check-pet-speech-lifecycle",
  "check-store-expansion",
  "check-store-categories",
  "check-asset-policy",
  "check-placement-bounds",
  "check-room-item-placement",
  "check-room-drag-performance",
  "check-room-performance",
  "check-room-picking",
  "check-world-weather",
  "check-weather-control",
  "check-curtains",
  "check-pet-stat-animation",
  "check-contact-shadows",
  "check-native-shadows",
  "check-wall-spotlights",
  "check-fridges",
  "check-item-interactions",
  "check-simple-graphics-layout",
  "check-puzzle-progress",
  "check-puzzle-objects",
  "check-cat-locomotion",
  "check-room-activity-notice",
  "check-cat-command-motion",
  "check-cat-turning",
  "check-cat-gaits",
  "check-cat-jumps",
  "check-cat-jump-anatomy",
  "check-cat-landing-walk",
  "check-cat-motion-flow",
  "check-rocking-chair-navigation",
  "check-furniture-perches",
  "check-furniture-transfers",
  "check-catalog-furniture-jumps",
  "check-close-furniture-jumps",
  "check-cat-tail-contact",
  "check-cat-expression",
  "check-cat-command-attention",
  "check-cat-paw-contact",
  "check-cat-waking",
  "check-cat-sleeping",
  "check-cat-fluid-motion",
  "check-cat-anticipation",
  "check-cat-walking-turns",
  "check-cat-pivot-rhythm",
  "check-cat-exploration",
  "check-cat-spine",
  "check-cat-restarting",
  "check-cat-room-flow",
  "check-fraction-animation"
];

const suites = { core, extended, all: [...core, ...extended] };
const args = process.argv.slice(2);
const suite = args.find(arg => arg.startsWith('--suite='))?.slice(8) ?? 'core';
if (!Object.hasOwn(suites, suite) || args.some(arg => arg !== '--list' && !arg.startsWith('--suite='))) {
  console.error('Usage: node scripts/check-game.mjs [--suite=core|extended|all] [--list]');
  process.exit(1);
}
const checks = suites[suite];
if (args.includes('--list')) {
  console.log(checks.join('\n'));
} else {
  console.log(`Running ${checks.length} ${suite} game checks.`);
  for (const check of checks) {
    const started = Date.now();
    console.log(`Checking ${check}...`);
    const result = spawnSync(process.execPath, [`scripts/${check}.mjs`], { stdio: 'inherit' });
    if (result.error) console.error(result.error.message);
    if (result.status !== 0) process.exit(result.status ?? 1);
    console.log(`Passed ${check} (${((Date.now() - started) / 1000).toFixed(1)}s).`);
  }
}
