/** Exercise the root layout's consumed-link cleanup without loading native providers. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(fs.readFileSync('app/_layout.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
for (const platform of ['ios', 'android', 'web']) {
  const effects = [];
  let cached = 'mathmews://puzzles?topic=numbers&lesson=easy-numbers-small', listener, removed = 0;
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    react: { useEffect: effect => effects.push(effect) },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Platform: { OS: platform }, useColorScheme: () => 'light', Dimensions: { get: () => ({ width: 390, height: 844 }) }, View: 'View' },
    'expo-router': { DarkTheme: { colors: {} }, DefaultTheme: { colors: {} }, Stack: { Screen: 'Screen' }, ThemeProvider: 'ThemeProvider' },
    'react-native-safe-area-context': { initialWindowMetrics: null, SafeAreaProvider: 'SafeAreaProvider' },
    'expo-linking': {
      clearInitialURL() { cached = null; },
      addEventListener(event, callback) { assert.equal(event, 'url'); listener = callback; return { remove() { removed++; } }; },
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: id => mocks[id] ?? new Proxy({}, { get: (_, name) => name === 'GameColors' ? {} : String(name) }) });
  module.exports.default();
  assert.ok(cached, 'Rendering cannot erase a launch link before Router initializes');
  const cleanup = effects[0]();
  if (platform === 'ios') {
    assert.equal(cached, null, 'A consumed cold launch link cannot replay on refresh');
    const event = { url: 'mathmews://settings' };
    cached = event.url; listener(event);
    assert.equal(event.url, 'mathmews://settings', 'The incoming event remains available to Router');
    assert.equal(cached, null, 'A warm link cannot become the next refresh destination');
    cleanup(); assert.equal(removed, 1, 'Unmounting removes the URL listener');
  } else {
    assert.ok(cached, 'Other platform launch handling stays unchanged');
    assert.equal(listener, undefined);
  }
}
console.log('Launch links survive routing, are consumed before iOS refresh, and unsubscribe cleanly.');
