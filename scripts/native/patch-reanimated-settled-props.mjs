// Runtime backport of https://github.com/software-mansion/react-native-reanimated/pull/9527
// Keep settled animated props until React receives them, including after native sheets.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../../node_modules/react-native-reanimated/', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
if (version !== '4.5.1') throw new Error('Review the Reanimated settled-props backport before upgrading react-native-reanimated.');
const patch = readFileSync(new URL('./patches/react-native-reanimated-4.5.1-settled-props.patch', import.meta.url), 'utf8');
const options = { cwd: fileURLToPath(root), input: patch, stdio: ['pipe', 'pipe', 'pipe'] };

const expected = {
  "Common/cpp/reanimated/Fabric/updates/AnimatedPropsRegistry.cpp": {
    "before": "1f153f9634adbb1cbfb399a26f2d17602950bfe635dfe01ce0c40a2272e1cd02",
    "after": "ac007cf6739eea8d980970fbb35042ed7fd3b86caaef2108abe6260afa303729"
  },
  "Common/cpp/reanimated/Fabric/updates/AnimatedPropsRegistry.h": {
    "before": "ce11352cf97a15f55ed3a5cd472655e566eaa42f5f80824df3644a74d00ee455",
    "after": "8972cc10a6631c5da161c6e8ac31d48c5adfdf18a73984550f628aee6d2832a2"
  },
  "Common/cpp/reanimated/NativeModules/ReanimatedModuleProxy.cpp": {
    "before": "73e9fc0cda526a17ba20e5c6e8b30bf8039253e48d67b1ec2cf0b93515743b26",
    "after": "aca4af7a3b30621224350d4de485f7bff96541a201b395371a18112d89abbc91"
  },
  "src/PropsRegistryGarbageCollector.ts": {
    "before": "96ee11bcd4391814bf6d81235b4fc72fe9b0f4066bc49695b6e7d8bba5f9ebc5",
    "after": "998045201664412b5eb1db9d19ebb49725e027eef6635be50fbf16830b0a0e23"
  },
  "src/createAnimatedComponent/AnimatedComponent.tsx": {
    "before": "63d3d5b621c02625b4764702d5a1431984db42ffc35f4bc52d4aa70c2a3691e2",
    "after": "57954496830b20e0289ec954f98bd39de9fbcb1e85ebc3d067b1209a80ab17ed"
  }
};
const hashes = () => Object.fromEntries(Object.keys(expected).map(file => [file,
  createHash('sha256').update(readFileSync(new URL(file, root))).digest('hex')]));
const matches = (actual, state) => Object.entries(expected).every(([file, hash]) => actual[file] === hash[state]);
const actual = hashes();
if (!matches(actual, 'after')) {
  if (!matches(actual, 'before')) throw new Error('Reanimated settled-props patch sources changed or are partially patched.');
  execFileSync('patch', ['-p1', '--force', '--fuzz=0', '--dry-run'], options);
  execFileSync('patch', ['-p1', '--force', '--fuzz=0'], options);
  if (!matches(hashes(), 'after')) throw new Error('Reanimated settled-props patch verification failed.');
}
console.log('Reanimated settled values survive delayed synchronization and re-animation.');
