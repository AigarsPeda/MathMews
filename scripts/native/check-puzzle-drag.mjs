/** Run real iOS touch gestures against an installed development build. */
import { spawn, execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, open, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const teachingTests = process.argv.includes('--bridge-teaching');
const activityTests = process.argv.includes('--activity-mix');
const fractionsIntroTests = process.argv.includes('--fractions-intro');
const layoutTests = process.argv.includes('--layout') || activityTests || fractionsIntroTests;
const bridgeFeedbackTests = process.argv.includes('--bridge-feedback');
const catPlanTests = process.argv.includes('--cat-plans');
const actionMotionTests = process.argv.includes('--action-motion');
const everydayTests = process.argv.includes('--everyday');
const fractionHelpTests = process.argv.includes('--fraction-help');
const geometryHelpTests = process.argv.includes('--geometry-help');
const bridgeTests = process.argv.includes('--bridge');
const geometryTests = process.argv.includes('--geometry');
const decimalModelTests = process.argv.includes('--decimal-models');
const fractionModelTests = process.argv.includes('--fraction-models');
const placeValueTests = process.argv.includes('--place-value');
const coldReplayTests = process.argv.includes('--replay-cold');
const replayTests = process.argv.includes('--replay') || coldReplayTests;
const pathTests = process.argv.includes('--path') || replayTests;
const berryTests = process.argv.includes('--berry');
const sceneTests = process.argv.includes('--scenes');
const companionTests = process.argv.includes('--companion');
const numberLineTests = process.argv.includes('--number-line');
const hardQuestionTests = process.argv.includes('--hard-questions');
const varietyTests = process.argv.includes('--variety');
const lifeTests = process.argv.includes('--lives');
const homeLifeTests = process.argv.includes('--home-lives');
const timedTests = process.argv.includes('--timed-challenges');
const progressTests = process.argv.includes('--lesson-progress');
const testName = process.argv.includes('--test') ? process.argv[process.argv.indexOf('--test') + 1] : fractionsIntroTests ? 'testFractionsIntro' : activityTests ? 'testActivityMix' : layoutTests ? 'testLayout' : undefined;
if (testName !== undefined && !/^test\w+$/.test(testName)) throw new Error('Pass a single XCTest method name after --test.');
const sources = path.join(root, fractionsIntroTests ? 'scripts/native/fractions-intro' : activityTests ? 'scripts/native/activity-mix' : teachingTests ? 'scripts/native/bridge-teaching' : layoutTests ? 'scripts/native/puzzle-layout' : replayTests ? 'scripts/native/puzzle-replay' : catPlanTests ? 'scripts/native/cat-plans' : actionMotionTests ? 'scripts/native/action-motion' : everydayTests ? 'scripts/native/everyday' : bridgeFeedbackTests ? 'scripts/native/bridge-feedback' : fractionHelpTests ? 'scripts/native/fraction-help' : geometryHelpTests ? 'scripts/native/geometry-help' : bridgeTests ? 'scripts/native/bridge' : geometryTests ? 'scripts/native/geometry' : decimalModelTests ? 'scripts/native/decimal-models' : fractionModelTests ? 'scripts/native/fraction-models' : placeValueTests ? 'scripts/native/place-value' : pathTests ? 'scripts/native/puzzle-path' : berryTests ? 'scripts/native/berry' : progressTests ? 'scripts/native/lesson-progress' : timedTests ? 'scripts/native/timed-challenges' : homeLifeTests ? 'scripts/native/home-lives' : lifeTests ? 'scripts/native/lives' : varietyTests ? 'scripts/native/practice-variety' : hardQuestionTests ? 'scripts/native/hard-questions' : numberLineTests ? 'scripts/native/number-line' : companionTests ? 'scripts/native/puzzle-companion' : sceneTests ? 'scripts/native/puzzle-scenes' : 'scripts/native/puzzle-drag');
const route = fractionsIntroTests ? 'fractions-intro-qa' : activityTests ? 'activity-mix-qa' : teachingTests ? 'bridge-teaching-qa' : layoutTests ? 'puzzle-layout-qa' : coldReplayTests ? 'cold-replay-qa' : replayTests ? 'replay-qa' : catPlanTests ? 'cat-plans-qa' : actionMotionTests ? 'action-motion-qa' : everydayTests ? 'everyday-qa' : bridgeFeedbackTests ? 'bridge-feedback-qa' : fractionHelpTests ? 'fraction-help-qa' : geometryHelpTests ? 'geometry-help-qa' : bridgeTests ? 'bridge-qa' : geometryTests ? 'geometry-qa' : decimalModelTests ? 'decimal-models-qa' : fractionModelTests ? 'fraction-models-qa' : placeValueTests ? 'place-value-qa' : pathTests ? 'path-qa' : berryTests ? 'berry-qa' : progressTests ? 'lesson-progress-qa' : timedTests ? 'timed-challenges-qa' : homeLifeTests ? 'home-lives-qa' : lifeTests ? 'lives-qa' : varietyTests ? 'practice-variety-qa' : hardQuestionTests ? 'hard-questions-qa' : numberLineTests ? 'number-line-qa' : companionTests ? 'companion-qa' : sceneTests ? 'scene-qa' : 'drag-qa';
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
  await copyFile(path.join(sources, coldReplayTests ? 'cold-fixture.tsx' : 'fixture.tsx'), fixture);
  if (teachingTests || layoutTests || catPlanTests || actionMotionTests || everydayTests || bridgeFeedbackTests || fractionHelpTests || geometryHelpTests || bridgeTests || geometryTests || decimalModelTests || fractionModelTests || placeValueTests || pathTests || lifeTests || homeLifeTests || timedTests || progressTests) {
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
  await copyFile(path.join(sources, coldReplayTests ? 'ColdReplayTests.swift' : 'NativeDragTests.swift'), path.join(work, 'NativeDragTests.swift'));
  await run('ruby', [path.join(root, 'scripts/native/puzzle-drag/create-project.rb'), work]);
  // A cold JS load includes the freshly created Expo Router route. An existing
  // runtime can otherwise keep a cached route manifest and show Unmatched Route.
  await run('xcrun', ['simctl', 'terminate', device, 'com.mathmews.app']).catch(() => {});
  await run('xcrun', ['simctl', 'launch', device, 'com.mathmews.app']);
  // A native readiness check avoids racing the root's launch-URL reset and
  // loading gate. Send the isolated fixture link after Home is interactive.
  if (teachingTests || layoutTests || catPlanTests || actionMotionTests || everydayTests || bridgeFeedbackTests || fractionHelpTests || geometryHelpTests || bridgeTests || geometryTests || placeValueTests || fractionModelTests || decimalModelTests || pathTests) {
    const startupLog = await open(path.join(work, 'startup.log'), 'w');
    try {
      await run('xcodebuild', ['test', '-project', path.join(work, 'NativeDrag.xcodeproj'), '-scheme', 'NativeDragTests',
        '-destination', `platform=iOS Simulator,id=${device}`, '-parallel-testing-enabled', 'NO',
        '-collect-test-diagnostics', 'never', '-derivedDataPath', path.join(work, 'build'),
        '-resultBundlePath', path.join(work, 'startup.xcresult'), 'CODE_SIGNING_ALLOWED=NO',
        '-only-testing:NativeDragTests/NativeLaunchTests/testHomeReady'], startupLog);
    } finally { await startupLog.close(); }
  }
  await run('xcrun', ['simctl', 'openurl', device, teachingTests || layoutTests || catPlanTests || actionMotionTests || everydayTests || bridgeFeedbackTests || fractionHelpTests || geometryHelpTests || bridgeTests || geometryTests || placeValueTests || fractionModelTests || decimalModelTests ? `mathmews:///${route}` : `mathmews://${route}`]);
  const log = await open(path.join(work, 'test.log'), 'w');
  try {
    console.log(`Testing native ${teachingTests ? 'equation and ratio clarity' : layoutTests ? 'puzzle layout' : coldReplayTests ? 'cold app restart during timed replay' : replayTests ? 'puzzle replay and next-level progression' : bridgeFeedbackTests ? 'bridge feedback' : fractionHelpTests ? 'fraction help' : geometryHelpTests ? 'geometry help' : bridgeTests ? 'bridge' : geometryTests ? 'geometry' : decimalModelTests ? 'decimal models' : fractionModelTests ? 'fraction models' : placeValueTests ? 'place-value' : pathTests ? 'ten-step path' : berryTests ? 'Berry puzzle flow' : progressTests ? 'visual lesson progress' : timedTests ? 'timed challenges and expanded curriculum' : homeLifeTests ? 'home lives header' : lifeTests ? 'three-life system' : varietyTests ? 'practice variety' : hardQuestionTests ? 'Hard questions' : numberLineTests ? 'number-line selection' : companionTests ? 'cat companion' : sceneTests ? 'task scenes' : 'drag'} on ${device}. Log and screenshots: ${work}`);
    await run('xcodebuild', [
      'test', '-project', path.join(work, 'NativeDrag.xcodeproj'), '-scheme', 'NativeDragTests',
      '-destination', `platform=iOS Simulator,id=${device}`, '-parallel-testing-enabled', 'NO',
      '-collect-test-diagnostics', 'never',
      '-derivedDataPath', path.join(work, 'build'), '-resultBundlePath', path.join(work, 'result.xcresult'),
      'CODE_SIGNING_ALLOWED=NO',
      ...(testName ? [`-only-testing:NativeDragTests/NativeDragTests/${testName}`] : []),
    ], log);
  } finally { await log.close(); }
  console.log(`Native ${teachingTests ? 'Equation and ratio clarity' : layoutTests ? 'Puzzle layout' : coldReplayTests ? 'Cold-replay' : replayTests ? 'Puzzle-replay' : catPlanTests ? 'Cat plans' : actionMotionTests ? 'Action motion' : everydayTests ? 'Everyday categories' : bridgeFeedbackTests ? 'Bridge feedback' : fractionHelpTests ? 'Fraction help' : geometryHelpTests ? 'Geometry help' : bridgeTests ? 'Bridge' : geometryTests ? 'Geometry' : decimalModelTests ? 'Decimal models' : fractionModelTests ? 'Fraction models' : placeValueTests ? 'Place-value' : pathTests ? 'ten-step path' : berryTests ? 'Berry puzzle flow' : progressTests ? 'Lesson-progress' : timedTests ? 'Timed-challenge' : homeLifeTests ? 'Home-life header' : lifeTests ? 'Three-life' : varietyTests ? 'Practice-variety' : hardQuestionTests ? 'Hard-question' : numberLineTests ? 'number-line selection' : companionTests ? 'cat-companion' : sceneTests ? 'task-scene' : 'basket, pattern and number-order'} tests passed. Result bundle: ${path.join(work, 'result.xcresult')}`);
} finally {
  // Leave the game at its normal entry point before removing the temporary route.
  await run('xcrun', ['simctl', 'openurl', device, 'mathmews://']).catch(error => console.error(error.message));
  await rm(fixture, { force: true });
}
