/** Check that result actions wait for each platform's sheet dismissal completion. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(file, extraMocks = {}) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const react = {
    useRef(initial) {
      const index = cursor++;
      slots[index] ??= { current: initial };
      return slots[index];
    },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        effects.push(() => {
          previous?.cleanup?.();
          slots[index] = { deps, cleanup: effect() };
        });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Platform: { OS: 'ios' }, StyleSheet: { create: styles => styles }, View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView' },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    '@/utils/scale': { moderateScale: value => value },
    '@/constants/game': { GameColors: { background: '#FFF5EB' }, LIFE_BUY_COST: 10 },
    ...Object.fromEntries([
      ['@/components/ui/IconText', 'IconText'], ['@/components/ui/AppIcon', 'AppIcon'],
      ['@/components/puzzle/BossStoryScene', 'BossStoryScene'], ['@/components/puzzle/PuzzleCatCompanion', 'PuzzleCatCompanion'],
      ['@/components/ui/AppBottomSheet', 'AppBottomSheet'],
    ].map(([id, name]) => [id, { [name]: name }])),
    ...extraMocks,
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module, exports: module.exports, require: id => {
    assert.ok(id in mocks, `Mock ${id}`);
    return mocks[id];
  } });
  return {
    render(name, props) {
      cursor = 0;
      const tree = module.exports[name](props);
      const pending = effects;
      effects = [];
      pending.forEach(effect => effect());
      return tree;
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node?.props ? [node, ...nodes(node.props.children)] : [];
}

for (const action of ['next', 'retry', 'home', 'swipe']) {
  const view = harness('components/puzzle/ResultOverlay.tsx');
  const calls = [];
  const props = { visible: true, correct: action !== 'retry', petType: 'cat', petMood: 'correct',
    petName: 'Minka', encouragement: 'Good job', message: 'Great job!', detail: '26',
    onContinue: () => calls.push('continue'), onGoHome: () => calls.push('home') };
  let sheet = view.render('ResultOverlay', props);
  const buttons = nodes(sheet.props.children(600)).filter(node => node.type === 'Pressable');
  const press = action === 'swipe' ? sheet.props.onClose : buttons[action === 'home' ? 1 : 0].props.onPress;
  press();
  press();
  assert.deepEqual(calls, [], `${action} must wait for the sheet to close`);
  sheet = view.render('ResultOverlay', props);
  assert.equal(sheet.props.visible, false, `${action} starts closing while its parent still holds the result`);
  assert.ok(nodes(sheet.props.children(600)).filter(node => node.type === 'Pressable').every(node => node.props.disabled), 'Actions are disabled while closing');
  sheet.props.onClose();
  sheet.props.onDismissComplete();
  sheet.props.onDismissComplete();
  assert.deepEqual(calls, [action === 'home' ? 'home' : 'continue'], `${action} runs exactly once after dismissal`);

  // A retained overlay can be shown again for another answer.
  view.render('ResultOverlay', { ...props, visible: false });
  view.render('ResultOverlay', props);
  sheet = view.render('ResultOverlay', props);
  assert.equal(sheet.props.visible, true);
  sheet.props.onClose();
  sheet = view.render('ResultOverlay', props);
  sheet.props.onDismissComplete();
  assert.equal(calls.length, 2, 'A subsequent result can continue once');
}

const modifiers = Object.fromEntries(['frame', 'presentationBackground', 'presentationDetents', 'presentationDragIndicator'].map(name => [name, value => ({ name, value })]));
for (const correct of [true, false]) {
  for (const lateCloseEvent of [true, false]) {
    const view = harness('components/puzzle/ResultOverlay.tsx');
    let continued = 0;
    const props = { visible: true, correct, onContinue: () => { continued++; } };
    const sheet = view.render('ResultOverlay', props);
    // Native swipe dismissal can finish before the presentation-change event arrives.
    sheet.props.onDismissComplete();
    assert.equal(continued, 1, 'A completed swipe advances or retries even without an earlier close event');
    if (lateCloseEvent) sheet.props.onClose();
    sheet.props.onDismissComplete();
    assert.equal(continued, 1, 'Late or repeated native events cannot continue twice');
  }
}
{
  const view = harness('components/puzzle/ResultOverlay.tsx');
  let continued = 0;
  const props = { visible: true, correct: true, onContinue: () => { continued++; } };
  view.render('ResultOverlay', props);
  view.render('ResultOverlay', { ...props, visible: false }).props.onDismissComplete();
  assert.equal(continued, 0, 'An external visibility change does not choose a result action');
}

const appSheet = harness('components/ui/AppBottomSheet.tsx', {
  '@expo/ui': { RNHostView: 'RNHostView' },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
  './SheetPresentation': { SheetPresentation: 'SheetPresentation' },
});
const completed = () => {};
assert.equal(appSheet.render('AppBottomSheet', { visible: false, onClose: () => {}, onDismissComplete: completed }).props.onDismissComplete,
  completed, 'The shared sheet forwards completion to its platform adapter');

const ios = harness('components/ui/SheetPresentation.ios.tsx', {
  '@expo/ui/swift-ui': { Host: 'Host', BottomSheet: 'BottomSheet', Group: 'Group' },
  '@expo/ui/swift-ui/modifiers': modifiers,
});
const events = [];
const props = { visible: true, expanded: true, onClose: () => events.push('close'), onDismissComplete: () => events.push('dismissed') };
const sheet = nodes(ios.render('SheetPresentation', props)).find(node => node.type === 'BottomSheet');
sheet.props.onIsPresentedChange(false);
assert.deepEqual(events, ['close'], 'iOS presentation changes only request closing');
sheet.props.onDismiss();
assert.deepEqual(events, ['close', 'dismissed'], 'iOS completion comes from the native dismissal event');

for (const cancelled of [false, true]) {
  let finishHide;
  const android = harness('components/ui/SheetPresentation.android.tsx', {
    '@expo/ui/jetpack-compose': { Host: 'Host', Column: 'Column', ModalBottomSheet: 'ModalBottomSheet' },
    '@expo/ui/jetpack-compose/modifiers': { fillMaxHeight: () => ({}) },
  });
  const calls = [];
  const props = { visible: true, expanded: true, onClose: () => calls.push('close'), onDismissComplete: () => calls.push('dismissed') };
  const sheet = nodes(android.render('SheetPresentation', props)).find(node => node.type === 'ModalBottomSheet');
  sheet.props.ref.current = { hide: () => new Promise(resolve => { finishHide = resolve; }) };
  android.render('SheetPresentation', { ...props, visible: false });
  assert.deepEqual(calls, [], 'Android waits for hide() to finish');
  if (cancelled) android.unmount();
  finishHide();
  await Promise.resolve();
  assert.deepEqual(calls, cancelled ? [] : ['dismissed'], 'Only an active Android sheet completes its pending action');
  if (!cancelled) assert.equal(android.render('SheetPresentation', { ...props, visible: false }), null);
}

const web = harness('components/ui/SheetPresentation.tsx', {
  vaul: { Drawer: Object.fromEntries(['Root', 'Portal', 'Overlay', 'Content', 'Title', 'Handle'].map(name => [name, name])) },
});
const webEvents = [];
const drawer = web.render('SheetPresentation', { visible: true, expanded: true,
  onClose: () => webEvents.push('close'), onDismissComplete: () => webEvents.push('dismissed') });
drawer.props.onOpenChange(false);
drawer.props.onAnimationEnd(true);
assert.deepEqual(webEvents, ['close'], 'Web opening events do not complete a dismissal');
drawer.props.onAnimationEnd(false);
assert.deepEqual(webEvents, ['close', 'dismissed']);

console.log('Result actions wait for dismissal, ignore duplicate taps, and work on subsequent results. Platform completion checks passed.');

// Run the production route selection, preload effect and continuation together.
const playSource = ts.createSourceFile('app/play.tsx', fs.readFileSync('app/play.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(predicate) {
  let result;
  function visit(node) { if (predicate(node)) result = node; ts.forEachChild(node, visit); }
  visit(playSource);
  assert.ok(result, 'Find production play callback');
  return result;
}
function callback(node, context) {
  return vm.runInNewContext(ts.transpileModule(`(${node.getText(playSource)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, context);
}
const routeFactory = find(node => ts.isVariableDeclaration(node) && node.name.getText(playSource) === 'nextPuzzleRoute').initializer.arguments[0];
const preloadEffect = find(node => ts.isCallExpression(node) && node.expression.getText(playSource) === 'useEffect' && node.arguments[0]?.getText(playSource).includes('router.prefetch')).arguments[0];
const continueCallback = find(node => ts.isVariableDeclaration(node) && node.name.getText(playSource) === 'handleContinue').initializer.arguments[0];
for (const kind of ['practice', 'boss']) {
  const routes = [];
  let interactions = 0;
  const env = { isCorrect: true, isReplay: false, answered: true, difficulty: 'easy', sessionIndex: 0,
    level: { id: 'one', kind }, lesson: { id: 'lesson' }, puzzles: [{}, {}, {}],
    getNextPracticeLevel: () => ({ id: 'two' }), recordInteraction() { interactions++; }, exitToPath() { routes.push(['path']); },
    navigation: { replace: (name, params) => routes.push(['replace', { pathname: `/${name}`, params }]) },
    router: { prefetch: route => routes.push(['prefetch', route]) } };
  env.nextPuzzleRoute = callback(routeFactory, env)();
  assert.equal(env.nextPuzzleRoute.params.level, kind === 'boss' ? 'one' : 'two');
  assert.equal(env.nextPuzzleRoute.params.phase, kind === 'boss' ? '1' : undefined);
  callback(preloadEffect, env)();
  assert.deepEqual(routes.map(([action]) => action), ['prefetch'], 'Preloading preserves the current puzzle and navigation state');
  const view = harness('components/puzzle/ResultOverlay.tsx');
  const props = { visible: true, correct: true, onContinue: callback(continueCallback, env) };
  let sheet = view.render('ResultOverlay', props);
  nodes(sheet.props.children(600)).find(node => node.type === 'Pressable').props.onPress();
  assert.deepEqual(routes.map(([action]) => action), ['prefetch'], 'Tapping Next closes the sheet before replacing the native screen');
  sheet = view.render('ResultOverlay', props);
  assert.equal(sheet.props.visible, false);
  sheet.props.onDismissComplete();
  assert.deepEqual(routes.map(([action]) => action), ['prefetch', 'replace']);
  assert.equal(routes[0][1].params, routes[1][1].params, 'The transition uses the already prepared destination');
  assert.equal(interactions, 0, 'Continuing does not queue a game-wide rerender before navigation');
  env.isReplay = true;
  env.level = { ...env.level, kind: 'practice' };
  assert.equal(callback(routeFactory, env)(), undefined, 'Replays still return to the lesson');
  env.isCorrect = false;
  assert.equal(callback(routeFactory, env)(), undefined, 'Incorrect answers do not preload a new puzzle');
}
console.log('Production puzzle routes preload beneath the result and replace only after dismissal.');

const layoutSource = ts.createSourceFile('app/_layout.tsx', fs.readFileSync('app/_layout.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const layoutMocks = {};
for (const node of layoutSource.statements) {
  if (!ts.isImportDeclaration(node)) continue;
  const names = node.importClause?.namedBindings;
  layoutMocks[node.moduleSpecifier.text] = names && ts.isNamedImports(names)
    ? Object.fromEntries(names.elements.map(name => [name.name.text, name.name.text])) : {};
}
for (const platform of ['ios', 'android']) {
  for (const colorScheme of ['light', 'dark']) {
    const theme = { colors: { background: platform === 'ios' ? '#fff' : '#000' } };
    const layout = harness('app/_layout.tsx', {
      ...layoutMocks,
      react: { useEffect() {} },
      'react-native': { View: 'View', Platform: { OS: platform }, Dimensions: { get: () => ({ width: 400, height: 900 }) }, useColorScheme: () => colorScheme },
      'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', initialWindowMetrics: null },
      'expo-router': { Stack: Object.assign(() => {}, { Screen: 'Screen' }), ThemeProvider: 'ThemeProvider', DefaultTheme: theme, DarkTheme: theme },
      '@/constants/game': { GameColors: { background: '#FFF5EB' } },
    });
    const tree = nodes(layout.render('default', {}));
    const navigationTheme = tree.find(node => node.type === 'ThemeProvider').props.value;
    const stack = tree.find(node => node.props.screenOptions).props;
    assert.equal(navigationTheme.colors.background, '#FFF5EB', `${platform}/${colorScheme}: native transitions never reveal the default navigation background`);
    assert.equal(stack.screenOptions.contentStyle.backgroundColor, '#FFF5EB', 'New screen surfaces match the puzzle before content paints');
    assert.notEqual(stack.screenOptions.animation, 'none', 'Puzzle navigation retains the native slide animation');
    const playOptions = tree.find(node => node.props.name === 'play').props.options;
    assert.equal(playOptions.animationTypeForReplace, 'push', 'The next puzzle transitions forward');
    assert.ok(playOptions.animationDuration < stack.screenOptions.animationDuration, 'The next puzzle uses the shorter slide duration');
  }
}
console.log('Native transition backgrounds match the puzzle in light and dark mode, with forward replacement animation.');
