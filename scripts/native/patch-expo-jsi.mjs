import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../node_modules/expo-modules-jsi/', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
if (version !== '57.1.1') throw new Error('Review the Swift interface patch before upgrading ExpoModulesJSI.');

const file = new URL('apple/scripts/build-xcframework.sh', root);
const source = readFileSync(file, 'utf8');
const before = String.raw`/^extension __ObjC\./`;
const after = '/^extension __ObjC[.:]/';
if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error('ExpoModulesJSI interface sanitizer context changed.');
  writeFileSync(file, source.replace(before, after));
}

console.log('ExpoModulesJSI Swift interface sanitizer supports dot and scoped namespace syntax.');
