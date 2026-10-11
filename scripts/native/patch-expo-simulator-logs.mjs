import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const packageUrl = pathToFileURL(require.resolve('@expo/cli/package.json'));
const version = JSON.parse(readFileSync(packageUrl, 'utf8')).version;
if (version !== '57.0.27') throw new Error(`Review the simulator log filter before upgrading Expo CLI ${version}.`);

const logUrl = new URL('build/src/start/platforms/ios/simctlLogging.js', packageUrl);
const source = readFileSync(logUrl, 'utf8');
const marker = '// Math Mews: suppress only these repeated Apple diagnostics.';
if (!source.includes(marker)) {
  const before = 'function onMessage(simLog) {\n    let hasLogged = false;';
  if (!source.includes(before)) throw new Error('Expo simulator log filter context changed.');
  const after = `function onMessage(simLog) {
    ${marker}
    // Keep faults, other native errors, and JS logs. Raw logs remain in Console.
    if (process.env.EXPO_RAW_SIMULATOR_LOGS !== '1' && simLog.messageType !== 'Fault' && (
        (simLog.subsystem === 'com.apple.coreanimation' && /^cannot add handler to 0 from 0 [–-] dropping$/.test(simLog.eventMessage ?? '')) ||
        (simLog.subsystem === 'com.apple.UIKit' && (simLog.eventMessage ?? '').startsWith('RCTScrollViewComponentView implements focusItemsInRect:'))
    )) return;
    let hasLogged = false;`;
  writeFileSync(logUrl, source.replace(before, after));
}
console.log('Expo simulator log filter ready.');
