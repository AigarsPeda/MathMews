// Release the listener-list lock before invoking callbacks.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../../node_modules/react-native-filament/', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
if (version !== '1.11.0') throw new Error('Review the Filament listener cancellation patch before upgrading react-native-filament.');
const patch = readFileSync(new URL('./patches/react-native-filament-1.11.0-listeners.patch', import.meta.url), 'utf8');
const options = { cwd: fileURLToPath(root), input: patch, stdio: ['pipe', 'pipe', 'pipe'] };

const expected = {
  "cpp/RNFListenerManager.h": {
    "before": "b59a469d5f172a86b07e29d1f2481031d014f50b0839efdc1e8aef86e9c3a1bc",
    "after": "a61ef806ba4fdf2ed2f5c692c8a4a76e4831769ecba8a9b3b85a4f017fb663fe"
  },
  "cpp/RNFListener.h": {
    "before": "892a2aa943417b2fa1926da3a7b857993f1aa28bfb5e58be5a26562a336fcad2",
    "after": "5ed678513893492c7809ee072b2f485266820afe77a1c7514d1fc761112f0713"
  },
  "cpp/RNFListener.cpp": {
    "before": "a94842ad24ca70384129ba06f98dddfee66e50ea6eebea1868a317d86af9971d",
    "after": "5a72d3331ccfe4d8682574ade3aaa794617bc6396a0a4139023f54ed06fd5995"
  },
  "cpp/RNFChoreographer.cpp": {
    "before": "902322a42a8446917027e556990dc895161e7ba7018a958648b7e13341e5f549",
    "after": "fc996ea0cc6466257907bd4cbc66aabdd35b3e38ae0cbe60dc7537cf5f9bc4b2"
  }
};
const hashes = () => Object.fromEntries(Object.keys(expected).map(file => [file,
  createHash('sha256').update(readFileSync(new URL(file, root))).digest('hex')]));
const matches = (actual, state) => Object.entries(expected).every(([file, hash]) => actual[file] === hash[state]);
const actual = hashes();
if (!matches(actual, 'after')) {
  if (!matches(actual, 'before')) throw new Error('Filament listener patch sources changed or are partially patched.');
  execFileSync('patch', ['-p1', '--force', '--fuzz=0', '--dry-run'], options);
  execFileSync('patch', ['-p1', '--force', '--fuzz=0'], options);
  if (!matches(hashes(), 'after')) throw new Error('Filament listener patch verification failed.');
}
console.log('Filament listener cancellation does not wait behind rendering.');
