import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(dev) {
  const cache = new Map(), imports = [], routes = [], subscribers = [];
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    react: { useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
      useSyncExternalStore: (subscribe, get) => { subscribers.push(subscribe); return get(); } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { StyleSheet: { create: value => value }, Text: 'Text', View: 'View', Pressable: 'Pressable' },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView' },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    'expo-router': { Redirect: 'Redirect', useRouter: () => ({ replace: route => routes.push(route), dismissTo: route => routes.push(route) }) },
    '@/components/recovery/RecoveryBoundary': { RecoveryBoundary: 'RecoveryBoundary' },
    '@/constants/game': { GameColors: {} },
  };
  function load(id) {
    if (id in mocks) return mocks[id];
    if (cache.has(id)) return cache.get(id);
    imports.push(id);
    if (id.includes('/scripts/native/')) {
      const file = id.replace('@/', '') + '.tsx';
      assert.ok(fs.existsSync(file), file);
      const source = fs.readFileSync(file, 'utf8');
      assert.match(source, /export default function/);
      if (id.includes('cat-capture')) assert.match(source, /export function CatCapturePreview/);
      return { default: () => null, CatCapturePreview: () => null };
    }
    const file = ['.ts', '.tsx'].map(ext => id.replace('@/', '') + ext).find(fs.existsSync);
    assert.ok(file, id);
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText, { __DEV__: dev, require: load, exports: module.exports, module });
    cache.set(id, module.exports);
    return module.exports;
  }
  return { load, imports, routes, subscribers };
}
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(2).flatMap(nodes)];
}
const h = harness(true);
const { DEVELOPER_TESTS: tests } = h.load('@/constants/developer-tests');
const fixtures = fs.readdirSync('scripts/native', { recursive: true }).filter(file => /(?:^|\/)\w[^/]*fixture\.tsx$/.test(file) || file.endsWith('/fixture.tsx'));
assert.equal(tests.length, fixtures.length, 'Every existing fixture is in Settings');
assert.equal(new Set(tests.map(test => test.id)).size, tests.length);
const mode = h.load('@/lib/developer-mode');
assert.equal(mode.getDeveloperMode(), null, 'Fresh sessions start off');
mode.useDeveloperMode();
let updates = 0;
const unsubscribe = h.subscribers[0](() => updates++);
const { DeveloperTestHost } = h.load('@/components/dev/DeveloperTestHost');
for (const test of tests) {
  assert.equal(typeof test.load(), 'function', test.id);
  mode.setDeveloperMode(test.id);
  assert.equal(mode.getDeveloperMode(), test.id);
  const tree = DeveloperTestHost(), all = nodes(tree);
  const off = all.find(node => node.type === 'Pressable' && nodes(node).some(child => child.props?.children === 'developer.off'));
  const boundary = all.find(node => node.type === 'RecoveryBoundary');
  assert.ok(off && boundary, `${test.id} has an exit outside its error boundary`);
  assert.ok(!nodes(boundary).includes(off));
  off.props.onPress();
  assert.equal(mode.getDeveloperMode(), null);
  assert.equal(h.routes.at(-1), '/');
  assert.equal(DeveloperTestHost().type, 'Redirect');
}
assert.equal(updates, tests.length * 2);
unsubscribe(); mode.setDeveloperMode('missing'); assert.equal(mode.getDeveloperMode(), null);
const release = harness(false);
assert.equal(release.load('@/constants/developer-tests').DEVELOPER_TESTS.length, 0);
release.load('@/lib/developer-mode').setDeveloperMode('cat-feeding');
assert.equal(release.load('@/lib/developer-mode').getDeveloperMode(), null);
for (const route of ['@/app/dev-test', '@/app/settings/developer']) assert.equal(release.load(route).default().type, 'Redirect');
assert.ok(!release.imports.some(id => id.includes('/components/dev/') || id.includes('/scripts/native/')));
console.log(`Verified all ${tests.length} test screens have an off control, session reset, subscriptions, and release route guards.`);
