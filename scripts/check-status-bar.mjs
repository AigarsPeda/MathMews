/** Verify native status-bar control survives Expo generation and theme changes. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const plist = createRequire(import.meta.url)('@expo/plist').default;

const config = JSON.parse(execFileSync(process.execPath,
  ['node_modules/expo/bin/cli', 'config', '--type', 'introspect', '--json'],
  { encoding: 'utf8', env: { ...process.env, EXPO_NO_DOTENV: '1' } }));
assert.equal(config._internal.modResults.ios.infoPlist.UIViewControllerBasedStatusBarAppearance, true,
  'Expo prebuild must retain view-controller-based status bars');
const nativePlist = 'ios/MathMews/Info.plist';
if (fs.existsSync(nativePlist)) {
  assert.equal(plist.parse(fs.readFileSync(nativePlist, 'utf8')).UIViewControllerBasedStatusBarAppearance, true,
    'The existing native project must use the same status-bar mode');
}

let colorScheme = 'light';
const module = { exports: {} };
const code = ts.transpileModule(fs.readFileSync('app/_layout.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
vm.runInNewContext(code, { module, exports: module.exports, require: id => {
  if (id === 'react/jsx-runtime') return {
    jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }),
  };
  if (id === 'react-native') return {
    View: 'View', useColorScheme: () => colorScheme,
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
  };
  if (id === 'react-native-safe-area-context') return { SafeAreaProvider: 'SafeAreaProvider', initialWindowMetrics: null };
  if (id === 'expo-router') return {
    Stack: { Screen: 'Screen' }, ThemeProvider: 'ThemeProvider', DarkTheme: 'dark', DefaultTheme: 'light',
  };
  assert.notEqual(id, 'expo-status-bar', 'The root must not mount legacy global status-bar control');
  return new Proxy({}, { get: (_, name) => name === 'GameColors' ? { background: '#FFF5EB' } : name });
} });
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node?.props ? [node, ...nodes(node.props.children)] : [];
}
for (const [theme, expectedStyle] of [['light', 'dark'], ['dark', 'light'], [null, 'dark']]) {
  colorScheme = theme;
  const stack = nodes(module.exports.default()).find(node => node.type?.Screen === 'Screen');
  assert.equal(stack.props.screenOptions.statusBarStyle, expectedStyle,
    'Native-stack status-bar text must follow the system theme');
}
console.log('Verified generated/native status-bar settings and native-stack theme changes without legacy global control.');
