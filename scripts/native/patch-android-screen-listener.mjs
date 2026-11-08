// Backport https://github.com/software-mansion/react-native-screens/pull/4413
// while Expo SDK 57 pins screens 4.26.x. Only the four native listener files change.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../../node_modules/react-native-screens/', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
if (version !== '4.26.2') throw new Error('Review the Android screen-listener backport before upgrading react-native-screens.');
const patch = readFileSync(new URL('./patches/react-native-screens-4.26.2-removal-listener.patch', import.meta.url), 'utf8');
const options = { cwd: fileURLToPath(root), input: patch, stdio: ['pipe', 'pipe', 'pipe'] };

const expected = {
  "android/src/main/cpp/NativeProxy.cpp": {
    "before": "b1295187e684e48ea2620f09a35a646129ada4d705caa258694bb1a06bde36a2",
    "after": "d1d006db671bf07d62dd8d486eac7d3027efa320cfe5cc25b8981e913ce019a9"
  },
  "android/src/main/cpp/NativeProxy.h": {
    "before": "819ac75f33a7b621c79a5dec27154dc119b4b0c0dc2a561779691d5fad9837b6",
    "after": "31fa7da8d2d614a3000f461a51bfa3f120c11cb1909c2e029da72cf1c162edcc"
  },
  "cpp/RNSScreenRemovalListener.cpp": {
    "before": "522ce1151eb7a484730ba60360e0c377d2ecd0607c237aef2ebe5ad3dd660b03",
    "after": "8fce5565911f4241803f851a94e76ad94547e5f9ad4ed547d82971522c2b4613"
  },
  "cpp/RNSScreenRemovalListener.h": {
    "before": "3eb22b7fd1365f6b111b9e065a37b46a3f41d7e5b51c8db3413ddf8a6595cdc8",
    "after": "a61f5280c833689328c23d7c99c42b840bd8c8492f0a89996e54f9c7c5f75485"
  }
};
const hashes = () => Object.fromEntries(Object.keys(expected).map(file => [file,
  createHash('sha256').update(readFileSync(new URL(file, root))).digest('hex')]));
const matches = (actual, state) => Object.entries(expected).every(([file, hash]) => actual[file] === hash[state]);
const actual = hashes();
if (!matches(actual, 'after')) {
  if (!matches(actual, 'before')) throw new Error('Android screen-listener patch sources changed or are partially patched.');
  execFileSync('patch', ['-p1', '--force', '--fuzz=0', '--dry-run'], options);
  execFileSync('patch', ['-p1', '--force', '--fuzz=0'], options);
  if (!matches(hashes(), 'after')) throw new Error('Android screen-listener patch verification failed.');
}
console.log('Android screen-removal listener initialization and teardown are synchronized.');
