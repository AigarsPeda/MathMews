/** Run real iOS touch gestures against an installed development build. */
import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sources = path.join(root, 'scripts/native/puzzle-drag');
const device = process.argv[process.argv.indexOf('--device') + 1];
if (!process.argv.includes('--device') || !/^[0-9A-F-]{36}$/i.test(device ?? '')) {
  throw new Error('Pass --device <simulator UDID> explicitly. Use xcrun simctl list devices booted to find it.');
}
const work = await mkdtemp(path.join(tmpdir(), 'brainpet-native-drag-'));
const fixture = path.join(root, 'app/drag-qa.tsx');
const run = (command, args, log) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, stdio: log ? ['ignore', log.fd, log.fd] : 'inherit' });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}. Results: ${work}`)));
});
// Exclusive creation avoids overwriting another developer's screen or test run.
const handle = await open(fixture, 'wx');
await handle.close();
try {
  await copyFile(path.join(sources, 'fixture.tsx'), fixture);
  await copyFile(path.join(sources, 'NativeDragTests.swift'), path.join(work, 'NativeDragTests.swift'));
  await run('ruby', [path.join(sources, 'create-project.rb'), work]);
  await run('xcrun', ['simctl', 'openurl', device, 'mathmews://drag-qa']);
  const log = await open(path.join(work, 'test.log'), 'w');
  try {
    console.log(`Testing native drag on ${device}. Log and screenshots: ${work}`);
    await run('xcodebuild', [
      'test', '-project', path.join(work, 'NativeDrag.xcodeproj'), '-scheme', 'NativeDragTests',
      '-destination', `platform=iOS Simulator,id=${device}`, '-parallel-testing-enabled', 'NO',
      '-derivedDataPath', path.join(work, 'build'), '-resultBundlePath', path.join(work, 'result.xcresult'),
      'CODE_SIGNING_ALLOWED=NO',
    ], log);
  } finally { await log.close(); }
  console.log(`Native basket and pattern tests passed. Result bundle: ${path.join(work, 'result.xcresult')}`);
} finally {
  // Leave the game at its normal entry point before removing the temporary route.
  await run('xcrun', ['simctl', 'openurl', device, 'mathmews://']).catch(error => console.error(error.message));
  await rm(fixture, { force: true });
}
