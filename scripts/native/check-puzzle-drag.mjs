/** Run real iOS touch gestures against an installed development build. */
import { spawn, execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, open, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bossTests = process.argv.includes('--bosses');
const sceneTests = process.argv.includes('--scenes');
const companionTests = process.argv.includes('--companion');
const numberLineTests = process.argv.includes('--number-line');
const hardQuestionTests = process.argv.includes('--hard-questions');
const varietyTests = process.argv.includes('--variety');
const lifeTests = process.argv.includes('--lives');
const homeLifeTests = process.argv.includes('--home-lives');
const timedTests = process.argv.includes('--timed-challenges');
const progressTests = process.argv.includes('--lesson-progress');
const achievementTests = process.argv.includes('--achievements');
const testName = process.argv.includes('--test') ? process.argv[process.argv.indexOf('--test') + 1] : undefined;
if (testName !== undefined && !/^test\w+$/.test(testName)) throw new Error('Pass a single XCTest method name after --test.');
const sources = path.join(root, achievementTests ? 'scripts/native/achievements' : progressTests ? 'scripts/native/lesson-progress' : timedTests ? 'scripts/native/timed-challenges' : homeLifeTests ? 'scripts/native/home-lives' : lifeTests ? 'scripts/native/lives' : varietyTests ? 'scripts/native/practice-variety' : hardQuestionTests ? 'scripts/native/hard-questions' : numberLineTests ? 'scripts/native/number-line' : bossTests ? 'scripts/native/boss-stories' : companionTests ? 'scripts/native/puzzle-companion' : sceneTests ? 'scripts/native/puzzle-scenes' : 'scripts/native/puzzle-drag');
const route = achievementTests ? 'achievements-qa' : progressTests ? 'lesson-progress-qa' : timedTests ? 'timed-challenges-qa' : homeLifeTests ? 'home-lives-qa' : lifeTests ? 'lives-qa' : varietyTests ? 'practice-variety-qa' : hardQuestionTests ? 'hard-questions-qa' : numberLineTests ? 'number-line-qa' : bossTests ? 'boss-qa' : companionTests ? 'companion-qa' : sceneTests ? 'scene-qa' : 'drag-qa';
const device = process.argv[process.argv.indexOf('--device') + 1];
if (!process.argv.includes('--device') || !/^[0-9A-F-]{36}$/i.test(device ?? '')) {
  throw new Error('Pass --device <simulator UDID> explicitly. Use xcrun simctl list devices booted to find it.');
}
const work = await mkdtemp(path.join(tmpdir(), 'brainpet-native-drag-'));
const fixture = path.join(root, `app/${route}.tsx`);
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
  if (bossTests || lifeTests || homeLifeTests || timedTests || progressTests || achievementTests) {
    // A long visual run must not receive source refreshes from other work.
    // Read the app container rather than the simulator's global defaults domain.
    const container = execFileSync('xcrun', ['simctl', 'get_app_container', device, 'com.mathmews.app', 'data'], { encoding: 'utf8' }).trim();
    const preferences = path.join(container, 'Library/Preferences/com.mathmews.app.plist');
    let previous = true; // React Native's default when no setting has been saved.
    if (await access(preferences).then(() => true, () => false)) {
      const data = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', preferences], { encoding: 'utf8' }));
      previous = data.RCTDevMenu?.hotLoadingEnabled ?? true;
    }
    await writeFile(fixture, (await readFile(fixture, 'utf8')).replace('const PREVIOUS_FAST_REFRESH = true;', `const PREVIOUS_FAST_REFRESH = ${!!previous};`));
  }
  await copyFile(path.join(sources, 'NativeDragTests.swift'), path.join(work, 'NativeDragTests.swift'));
  await run('ruby', [path.join(root, 'scripts/native/puzzle-drag/create-project.rb'), work]);
  // A cold JS load includes the freshly created Expo Router route. An existing
  // runtime can otherwise keep a cached route manifest and show Unmatched Route.
  await run('xcrun', ['simctl', 'terminate', device, 'com.mathmews.app']).catch(() => {});
  await run('xcrun', ['simctl', 'launch', device, 'com.mathmews.app']);
  // A native readiness check avoids racing the root's launch-URL reset and
  // loading gate. Send the isolated fixture link after Home is interactive.
  if (achievementTests) {
    const startupLog = await open(path.join(work, 'startup.log'), 'w');
    try {
      await run('xcodebuild', ['test', '-project', path.join(work, 'NativeDrag.xcodeproj'), '-scheme', 'NativeDragTests',
        '-destination', `platform=iOS Simulator,id=${device}`, '-parallel-testing-enabled', 'NO',
        '-collect-test-diagnostics', 'never', '-derivedDataPath', path.join(work, 'build'),
        '-resultBundlePath', path.join(work, 'startup.xcresult'), 'CODE_SIGNING_ALLOWED=NO',
        '-only-testing:NativeDragTests/NativeLaunchTests/testHomeReady'], startupLog);
    } finally { await startupLog.close(); }
  }
  await run('xcrun', ['simctl', 'openurl', device, `mathmews://${route}`]);
  const log = await open(path.join(work, 'test.log'), 'w');
  try {
    console.log(`Testing native ${achievementTests ? 'achievement sequence and sharing' : progressTests ? 'visual lesson progress' : timedTests ? 'timed challenges and expanded curriculum' : homeLifeTests ? 'home lives header' : lifeTests ? 'three-life system' : varietyTests ? 'practice variety' : hardQuestionTests ? 'Hard questions' : numberLineTests ? 'number-line selection' : bossTests ? 'boss stories' : companionTests ? 'cat companion' : sceneTests ? 'task scenes' : 'drag'} on ${device}. Log and screenshots: ${work}`);
    await run('xcodebuild', [
      'test', '-project', path.join(work, 'NativeDrag.xcodeproj'), '-scheme', 'NativeDragTests',
      '-destination', `platform=iOS Simulator,id=${device}`, '-parallel-testing-enabled', 'NO',
      '-collect-test-diagnostics', 'never',
      '-derivedDataPath', path.join(work, 'build'), '-resultBundlePath', path.join(work, 'result.xcresult'),
      'CODE_SIGNING_ALLOWED=NO',
      ...(testName ? [`-only-testing:NativeDragTests/NativeDragTests/${testName}`] : achievementTests ? ['-only-testing:NativeDragTests/NativeDragTests'] : []),
    ], log);
  } finally { await log.close(); }
  console.log(`Native ${achievementTests ? 'Achievement' : progressTests ? 'Lesson-progress' : timedTests ? 'Timed-challenge' : homeLifeTests ? 'Home-life header' : lifeTests ? 'Three-life' : varietyTests ? 'Practice-variety' : hardQuestionTests ? 'Hard-question' : numberLineTests ? 'number-line selection' : bossTests ? 'boss-story' : companionTests ? 'cat-companion' : sceneTests ? 'task-scene' : 'basket, pattern and number-order'} tests passed. Result bundle: ${path.join(work, 'result.xcresult')}`);
} finally {
  // Leave the game at its normal entry point before removing the temporary route.
  await run('xcrun', ['simctl', 'openurl', device, 'mathmews://']).catch(error => console.error(error.message));
  await rm(fixture, { force: true });
}
