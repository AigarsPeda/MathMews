import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { transformSync } from '@babel/core';
import React, { act } from 'react';
import Reconciler from 'react-reconciler';
import { DefaultEventPriority } from 'react-reconciler/constants.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const hostContext = {};
const renderer = Reconciler({
  isPrimaryRenderer: true, supportsMutation: true,
  getRootHostContext: () => hostContext, getChildHostContext: () => hostContext,
  prepareForCommit: () => null, resetAfterCommit() {}, clearContainer() {},
  getCurrentUpdatePriority: () => DefaultEventPriority, setCurrentUpdatePriority() {},
  resolveUpdatePriority: () => DefaultEventPriority, maySuspendCommit: () => false,
  scheduleTimeout: setTimeout, cancelTimeout: clearTimeout, noTimeout: -1,
  supportsMicrotasks: true, scheduleMicrotask: queueMicrotask,
});

// Run the real screen/header and catalog logic. Native views, navigation, and
// purchases are boundaries; FlatList keeps RN's shallow-prop PureComponent contract.
async function harness(screen = 'store', compiled = false) {
  const cache = new Map(), components = new Map(), props = new Map(), counts = new Map();
  const gameContext = React.createContext(null), clockContext = React.createContext(Date.now());
  const calls = [], timers = new Map();
  let clock = Date.now(), timerId = 0;
  class ClockDate extends Date { static now() { return clock; } }
  let activity = { active: true, reduceMotion: false };
  const activityContext = React.createContext(activity);
  const actions = Object.fromEntries(['setProgress', 'purchaseRoom', 'equipRoom', 'purchaseBed', 'equipBed',
    'removeBedFromRoom', 'purchaseToy', 'placeToyInRoom', 'removeToyFromRoom', 'purchaseDecoration',
    'placeDecorationInRoom', 'removeDecorationFromRoom', 'purchaseSkin', 'equipSkin', 'recordInteraction',
    'requestRoomDecoration', 'buyLife'].map(name => [name, (...args) => {
      calls.push([name, ...args]);
      return name.startsWith('purchase') ? Promise.resolve('unavailable') : false;
    }]));
  const router = { back() {}, replace() {}, dismissTo() {}, push() {}, canGoBack: () => true };
  let translate = (key, values) => values ? `${key}:${JSON.stringify(values)}` : key;
  const translationContext = React.createContext(null);
  const dimensions = { width: 390, height: 844 }, insets = { top: 0, bottom: 0 };
  function view(name) {
    if (!components.has(name)) components.set(name, function Probe(p) {
      props.set(name, p); counts.set(name, (counts.get(name) ?? 0) + 1);
      if (p.testID) { props.set(p.testID, p); counts.set(p.testID, (counts.get(p.testID) ?? 0) + 1); }
      if (p.onLayout) props.set(`${name}:onLayout`, p.onLayout);
      if (name === 'PetStage') props.set(`PetStage:${p.homeRoomId}`, p);
      // Strings need no host renderer; keep component children and fragments.
      const children = React.Children.toArray(p.children).filter(React.isValidElement);
      if (name === 'CoinCounter' && p.homeAccessory) children.push(p.homeAccessory(false));
      return React.createElement(React.Fragment, null, ...children);
    });
    return name === 'NativeRoomScene' ? (components.get('memoNativeScene') ?? (components.set('memoNativeScene', React.memo(components.get(name))), components.get('memoNativeScene'))) : components.get(name);
  }
  class FlatList extends React.PureComponent {
    render() {
      props.set('FlatList', this.props); counts.set('FlatList', (counts.get('FlatList') ?? 0) + 1);
      return this.props.data.slice(0, 2).map((item, index) => this.props.renderItem({ item, index }));
    }
  }
  const petDisplay = { playback: { mood: 'idle' }, baseMood: 'idle', send() {}, isCareBlocked: false, isCareAnimationPlaying: false };
  const roomTransition = { transition: null, progress: {}, visit() {}, ready() {} };
  const roomEditor = {}, iap = {}, speech = { speechMessage: null, showSpeech() {} };
  const shared = value => ({ value, get() { return this.value; }, set(next) { this.value = next; } });
  function useWorkletValue(read) {
    const latest = React.useRef(read);
    React.useLayoutEffect(() => { latest.current = read; }, [read]);
    return React.useMemo(() => ({ read: () => latest.current(), get: () => latest.current() }), []);
  }
  const stageCamera = { x: shared(0), y: shared(0), scale: shared(1), zoom: 1, gesture: {} };
  const stageActivity = { activity: null, scale: shared(1), facing: shared(1), objectX: shared(0), objectY: shared(0),
    clearBlockedActivity() {}, startActivity() {}, returnHome() {}, stopActivity() {} };
  const mocks = {
    '@/lib/graphics-mode': { useGraphicsMode: () => '3d' },
    '@/hooks/use-room-camera': { useRoomCamera: () => stageCamera },
    '@/hooks/use-room-activity': { useRoomActivity: options => {
      props.set('activityOptions', options); counts.set('stageRenders', (counts.get('stageRenders') ?? 0) + 1);
      return stageActivity;
    } },
    'react-native-worklets-core': { useSharedValue: value => React.useState(() => shared(value))[0] },
    'react-native-reanimated': { __esModule: true, default: { View: view('AnimatedView') }, useReducedMotion: () => false,
      useSharedValue: value => React.useState(() => shared(value))[0],
      useAnimatedStyle: useWorkletValue,
      useDerivedValue: useWorkletValue },
    'react-native-gesture-handler': { GestureDetector: view('GestureDetector') },
    '@/contexts/IAPProvider': { useIAP: () => iap },
    '@/contexts/LocaleProvider': { useLocale: () => ({ locale: 'en' }) },
    '@/hooks/use-animation-activity': { useAnimationActivity: () => React.useContext(activityContext) },
    '@/hooks/use-screen-insets': { useScreenInsets: () => ({ paddingTop: 0, paddingRight: 0 }) },
    '@/hooks/use-cat-bedtime': { useCatBedtime() {} },
    '@/hooks/use-room-editor': { useRoomEditor: () => roomEditor },
    '@/hooks/use-room-transition': { useRoomTransition: () => roomTransition },
    '@/hooks/use-pet-speech': { usePetSpeech: () => speech },
    '@/pet-display/hooks/use-pet-display': { usePetDisplay: () => petDisplay },
    '@/utils/native-scene-cache': { shouldMountNativeRoom: () => true },
    react: React, 'react/jsx-runtime': await import('react/jsx-runtime'),
    'react/compiler-runtime': await import('react/compiler-runtime'),
    'react-native': { View: view('View'), Image: view('Image'), Pressable: view('Pressable'), Text: view('Text'), ScrollView: view('ScrollView'),
      ActivityIndicator: view('ActivityIndicator'), FlatList, Platform: { OS: 'web' },
      StyleSheet: { create: x => x }, useWindowDimensions: () => dimensions,
      Dimensions: { get: () => dimensions }, PixelRatio: { roundToNearestPixel: x => x } },
    'react-native-safe-area-context': { SafeAreaView: view('SafeAreaView'), useSafeAreaInsets: () => insets },
    'expo-router': { useRouter: () => router, Redirect: view('Redirect'), useFocusEffect: fn => React.useEffect(fn, [fn]) },
    'expo-haptics': { ImpactFeedbackStyle: { Light: 'light' } },
    'react-i18next': { useTranslation: () => ({ t: React.useContext(translationContext) }) },
    '@/contexts/GameProvider': { useGame: () => { counts.set('gameReads', (counts.get('gameReads') ?? 0) + 1); return React.useContext(gameContext); }, useGameActions: () => actions },
    '@/hooks/use-world-clock-now': { useWorldClockNow: () => React.useContext(clockContext) },
    '@/services/store-catalog': { refreshStoreCatalog: async () => {} },
    '@/utils/decoration-timing': { startDecorationTiming() {}, markDecorationTiming() {} },
    '@/lib/app-diagnostics': { reportAppError() {} },
    '@react-native-async-storage/async-storage': {},
  };
  if (screen === 'mood' || screen === 'home' || screen === 'stage' || screen === 'home-stage') delete mocks['@/hooks/use-world-clock-now'];
  if (screen === 'home') delete mocks['@/hooks/use-cat-bedtime'];
  function load(id, base = process.cwd()) {
    if (id in mocks) return mocks[id];
    if ((id.startsWith('@/components/') || id.startsWith('@/pet-display/components/')) && !id.endsWith('/GameHeaderStats') && !id.endsWith('/HomePuzzleHint') && !id.endsWith('/HomeRoomStage') && !((screen === 'stage' || screen === 'home-stage') && id.endsWith('/PetStage'))) {
      const name = id.split('/').at(-1);
      return new Proxy({ [name]: view(name) }, { get: (target, key) => key === 'ROOM_NAVIGATION_HEIGHT' ? 52 : target[key] ?? view(key) });
    }
    let file = id.startsWith('@/') ? path.resolve(id.slice(2)) : path.resolve(base, id);
    if (/\.(png|webp|mp4|glb)$/.test(file)) return file;
    if (!fs.existsSync(file)) file = ['.ts', '.tsx', '.json'].map(ext => file + ext).find(fs.existsSync);
    assert.ok(file, `Resolve ${id}`);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    if (file.endsWith('.json')) { module.exports = JSON.parse(fs.readFileSync(file, 'utf8')); return module.exports; }
    let source = fs.readFileSync(file, 'utf8');
    if (compiled && (file.endsWith('.tsx') || file.endsWith('/use-pet-base-mood.ts') || file.endsWith('/use-world-period.ts'))) {
      source = transformSync(source, { filename: file, configFile: false, babelrc: false,
        parserOpts: { plugins: ['typescript', 'jsx'] }, plugins: [['babel-plugin-react-compiler', { target: '19' }]],
      }).code;
    }
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText, { module, exports: module.exports, require: child => load(child, path.dirname(file)),
      Date: ClockDate, Math, Map, Set, Promise, console, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, requestIdleCallback: () => 1, cancelIdleCallback() {}, __DEV__: false, process: { env: {} },
      setInterval: fn => { const id = ++timerId; timers.set(id, fn); return id; }, clearInterval: id => timers.delete(id),
      setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
    });
    if (file.endsWith('/constants/puzzles.ts')) {
      const compute = module.exports.computePetWisdom;
      module.exports.computePetWisdom = (...args) => {
        counts.set('wisdom', (counts.get('wisdom') ?? 0) + 1);
        return compute(...args);
      };
    }
    return module.exports;
  }
  const save = load('@/utils/game-storage').createDefaultGameSave();
  let game = { ...save, ...actions, isReady: true, hasCompletedOnboarding: true, pendingPurchaseCount: 0, wallet: { coins: 100 } };
  let stageProps = { roomVisible: true, catHomeRoomId: 'livingRoom', roomToolbar: { decorating: false, onDecoratingChange() {} } };
  const playback = { kind: 'segment', mood: 'idle' };
  function StageProbe() {
    return React.createElement(load('@/components/pet/PetStage').PetStage, {
      name: game.pet.name, petType: 'cat', compact: true, stats: game.pet.stats, wisdom: 0,
      worldClock: game.worldClock, playback, ...stageProps,
    });
  }
  function MoodProbe() { props.set('mood', load('@/pet-display/hooks/use-pet-base-mood').usePetBaseMood(game.pet, game.worldClock)); counts.set('mood', (counts.get('mood') ?? 0) + 1); return null; }
  const Screen = screen === 'stage' ? StageProbe : screen === 'mood' ? MoodProbe : screen === 'store' ? load('@/app/store').default : screen === 'home' || screen === 'home-stage' ? load('@/app/index').default : load('@/components/economy/GameHeaderStats').GameHeaderStats;
  const errors = [], onError = error => errors.push(error);
  const root = renderer.createContainer({}, 1, null, false, null, '', onError, onError, onError, null);
  async function update(fn) { await act(async () => { await fn(); }); if (errors.length) throw errors[0]; }
  const render = () => update(() => renderer.updateContainer(
    React.createElement(activityContext.Provider, { value: activity },
    React.createElement(translationContext.Provider, { value: translate },
      React.createElement(gameContext.Provider, { value: game },
        React.createElement(clockContext.Provider, { value: clock },
          React.createElement(Screen, screen !== 'home-header' ? {} : {
            layout: 'home', coins: game.wallet.coins, streak: game.progress.streak,
            lives: game.progress.lives, completedPuzzleIds: game.progress.completedPuzzleIds,
          }))))), root, null, null));
  await render();
  return { props: name => props.get(name), count: name => counts.get(name) ?? 0, calls, load, update,
    get now() { return clock; },
    get timerCount() { return timers.size; },
    async setStage(next) { stageProps = { ...stageProps, ...next }; await render(); },
    async setActive(active) { activity = { ...activity, active }; await render(); },
    async advance(ms) { clock += ms; await update(() => { for (const callback of [...timers.values()]) callback(); }); },
    get game() { return game; }, async setGame(next) { game = { ...game, ...next }; await render(); },
    async setLanguage() { translate = (key, values) => `translated:${key}:${JSON.stringify(values)}`; await render(); },
    async tick() { clock += 1000; await render(); },
    async close() { await update(() => renderer.updateContainer(null, root, null, null)); },
  };
}

for (const compiled of [false, true]) {
const mode = compiled ? 'with React Compiler' : 'without React Compiler';

test(`Home care updates preserve room adapters and scene callbacks (${mode})`, async () => {
  const h = await harness('home', compiled);
  try {
    const before = h.props('PetStage:kitchen');
    await h.setGame({ pet: { ...h.game.pet, stats: { ...h.game.pet.stats, hunger: 64, happiness: 70 } } });
    const after = h.props('PetStage:kitchen');
    for (const key of ['onCommitRoomEdit', 'onRoomActivityCompleted', 'onRoomPetOffsetChange', 'onRoomBedOffsetChange',
      'onPlacedToyOffsetChange', 'onPlacedDecorationOffsetChange', 'onAimPlacedSpotlight']) {
      assert.equal(after[key], before[key], key);
    }
    assert.equal(after.stats.hunger, 64, 'The stat panel still receives current values');
  } finally { await h.close(); }
});

test(`Home care updates do not invalidate native scenes (${mode})`, async () => {
  const h = await harness('home-stage', compiled);
  try {
    const before = h.count('NativeRoomScene');
    await h.setGame({ pet: { ...h.game.pet, stats: { ...h.game.pet.stats, hunger: 64, happiness: 70 } } });
    assert.equal(h.count('NativeRoomScene'), before);
    assert.equal(h.props('PetStatsPanel').stats.hunger, 64);
  } finally { await h.close(); }
});

test(`room furniture stays cached for ordinary stat decay but feeding and commands stay current (${mode})`, async () => {
  const h = await harness('stage', compiled);
  try {
    const requests = [];
    await h.setStage({ placedDecorations: [{ decorationId: 'bowlBlue', instanceId: 'bowl', offset: { x: 0, y: 0 } },
      { decorationId: 'lampFloorArc', instanceId: 'lamp', offset: { x: -.3, y: 0 } }],
      onTogglePlacedDecorationPower() {}, onFeed() {}, onRequestRoomCommand: (...args) => requests.push(['first', ...args]) });
    await h.update(() => h.props('AnimatedView:onLayout')({ nativeEvent: { layout: { width: 390, height: 420 } } }));
    await h.setGame({ pet: { ...h.game.pet, stats: { ...h.game.pet.stats, hunger: 70 } } });
    const count = h.count('room-object:bowl'), catCount = h.count('room-cat'), lampCount = h.count('RoomActionMenu');
    const menu = h.props('room-object:bowl').menuActions;
    assert.ok(menu.length);
    await h.setGame({ pet: { ...h.game.pet, stats: { ...h.game.pet.stats, hunger: 65, happiness: 60 } } });
    assert.equal(h.count('room-object:bowl'), count, 'Stat decay must not rebuild furniture and its gesture/menu tree');
    assert.equal(h.count('room-cat'), catCount, 'The native cat hit target stays cached');
    assert.equal(h.count('RoomActionMenu'), lampCount, 'Lamp switch menus stay cached');
    assert.equal(h.props('PetStatsPanel').stats.hunger, 65);
    await h.setGame({ pet: { ...h.game.pet, stats: { ...h.game.pet.stats, hunger: 100 } } });
    const feed = () => h.props('room-object:bowl').menuActions.find(item => item.label === 'home.catCommands.bowlEat');
    assert.equal(feed().disabled, true);
    await h.setGame({ pet: { ...h.game.pet, stats: { ...h.game.pet.stats, hunger: 70 } } });
    assert.equal(feed().disabled, false);
    await h.setStage({ onRequestRoomCommand: (...args) => requests.push(['latest', ...args]) });
    await h.update(() => feed().onPress());
    assert.deepEqual(requests.at(-1).slice(0, 4), ['latest', 'livingRoom', 'bowlEat', 'bowl']);
    await h.setStage({ placedDecorations: [{ decorationId: 'bowlBlue', instanceId: 'bowl', offset: { x: .2, y: 0 } }] });
    assert.ok(h.count('room-object:bowl') > count, 'Furniture edits still invalidate cached items');
  } finally { await h.close(); }
});

test(`room edit adapters use the current version and replacement callbacks (${mode})`, async () => {
  const h = await harness('home', compiled);
  try {
    const commits = [];
    await h.setGame({ commitRoomEdit: (...args) => { commits.push(['first', ...args]); return true; } });
    const before = h.props('PetStage:kitchen').onCommitRoomEdit;
    const room = { bedId: undefined, placedToys: [], placedDecorations: [{ decorationId: 'bowlBlue', instanceId: 'new-bowl', offset: { x: 0, y: 0 } }] };
    await h.setGame({ pet: { ...h.game.pet, homeRooms: { ...h.game.pet.homeRooms, kitchen: room } },
      commitRoomEdit: (...args) => { commits.push(['latest', ...args]); return false; } });
    const after = h.props('PetStage:kitchen').onCommitRoomEdit;
    assert.notEqual(before, after);
    assert.equal(after([], ['new-bowl']), false);
    assert.equal(commits.at(-1)[0], 'latest');
    assert.equal(commits.at(-1)[1], 'kitchen');
    assert.equal(commits.at(-1)[4], h.load('@/utils/room-edit').roomFurnitureVersion(room));
  } finally { await h.close(); }
});

test(`sleep completion stays stable across stat updates and checks the latest pet (${mode})`, async () => {
  const h = await harness('mood', compiled);
  try {
    await h.setGame({ pet: { ...h.game.pet, type: 'dog', lastInteractionAt: h.now, stats: { ...h.game.pet.stats, hunger: 80 } } });
    await h.advance(31 * 60000);
    const complete = h.props('mood').onFallAsleepComplete;
    await h.setGame({ pet: { ...h.game.pet, stats: { ...h.game.pet.stats, hunger: 5 } } });
    assert.equal(h.props('mood').onFallAsleepComplete, complete);
    await h.update(complete);
    assert.notEqual(h.props('mood').mood, 'sleeping', 'An old completion cannot sleep a now-hungry pet');
  } finally { await h.close(); }
});

test(`room stages skip unchanged clock ticks and deliver period transitions (${mode})`, async () => {
  const h = await harness('stage', compiled);
  try {
    await h.setGame({ worldClock: { worldMs: 12 * 3600000, realMs: h.now, speed: 60 } });
    const count = h.count('stageRenders');
    for (let tick = 0; tick < 5; tick++) await h.advance(5000);
    assert.equal(h.count('stageRenders'), count, 'Same-period polls must not rebuild stage menus or scene props');
    assert.equal(h.props('activityOptions').period, 'day');
    for (const [hour, before, after] of [[6, 'night', 'morning'], [10, 'morning', 'day'], [18, 'day', 'evening'], [21, 'evening', 'night']]) {
      await h.setGame({ worldClock: { worldMs: hour * 3600000 - 60000, realMs: h.now, speed: 60 } });
      assert.equal(h.props('activityOptions').period, before);
      await h.advance(5000);
      assert.equal(h.props('activityOptions').period, after, 'The existing activity scheduler receives each boundary');
    }
  } finally { await h.close(); }
});

test(`room period pauses when inactive and refreshes on visibility, editing and clock changes (${mode})`, async () => {
  const h = await harness('stage', compiled);
  const atNight = () => ({ worldMs: 21 * 3600000 - 60000, realMs: h.now, speed: 60 });
  try {
    await h.setGame({ worldClock: atNight() });
    await h.setActive(false);
    assert.equal(h.timerCount, 0);
    const hidden = h.count('stageRenders');
    await h.advance(5000);
    assert.equal(h.count('stageRenders'), hidden);
    await h.setActive(true);
    assert.equal(h.props('activityOptions').period, 'night', 'Focus catches up without waiting for a poll');
    await h.setGame({ worldClock: atNight() });
    await h.setStage({ roomVisible: false, catHomeRoomId: 'kitchen' });
    assert.equal(h.timerCount, 0, 'An empty hidden room has no period timer');
    await h.advance(5000);
    await h.setStage({ catHomeRoomId: 'livingRoom' });
    assert.equal(h.props('activityOptions').period, 'night', 'The cat room still advances while browsing elsewhere');
    assert.equal(h.timerCount, 1);
    await h.setGame({ worldClock: atNight() });
    await h.setStage({ roomToolbar: { decorating: true } });
    assert.equal(h.timerCount, 0);
    await h.advance(5000);
    await h.setStage({ roomToolbar: { decorating: false } });
    assert.equal(h.props('activityOptions').period, 'night');
    await h.setGame({ worldClock: { worldMs: 12 * 3600000, realMs: h.now, speed: 300 } });
    assert.equal(h.props('activityOptions').period, 'day', 'Presets and speed changes refresh immediately');
    await h.setGame({ worldClock: undefined });
    assert.equal(h.props('activityOptions').period, undefined);
    assert.equal(h.timerCount, 0);
  } finally { await h.close(); }
});

test(`Store preview, feedback, pet stats, and life updates do not rerender product rows (${mode})`, async () => {
  const h = await harness('store', compiled);
  try {
    const before = h.count('DecorationStoreCard'), lists = h.count('FlatList');
    await h.update(() => h.props('DecorationStoreCard').onPreview());
    assert.ok(h.props('StorePreviewSheet').item);
    await h.update(() => h.props('StorePreviewSheet').onClose());
    await h.update(() => h.props('DecorationStoreCard').onBuy());
    assert.ok(h.props('NotificationBanner'));
    await h.setGame({ pet: { ...h.game.pet, stats: { ...h.game.pet.stats, hunger: 50 } } });
    await h.setGame({ progress: { ...h.game.progress, lives: { ...h.game.progress.lives, current: 1 } } });
    assert.equal(h.count('DecorationStoreCard') - before, 0, 'No product inputs changed');
    assert.equal(h.count('FlatList') - lists, 0);
  } finally { await h.close(); }
});

test(`Store refreshes affordability, ownership, placements, catalog prices, and translated callbacks (${mode})`, async () => {
  const h = await harness('store', compiled);
  try {
    const id = h.props('DecorationStoreCard').decorationId;
    await h.setGame({ wallet: { coins: 0 } });
    assert.equal(h.props('DecorationStoreCard').canAfford, false);
    await h.setGame({ progress: { ...h.game.progress, decorationsUnlocked: [id], decorationQuantities: { [id]: 2 } } });
    assert.equal(h.props('DecorationStoreCard').isOwned, true);
    await h.setGame({ pet: { ...h.game.pet, placedDecorations: [{ decorationId: id, instanceId: 'test', offset: { x: 0, y: 0 } }] } });
    assert.equal(h.props('DecorationStoreCard').placedCount, 1);
    const catalog = h.load('@/utils/store-catalog');
    await h.update(() => catalog.acceptStoreCatalog({ server_time: new Date().toISOString(), items: [{
      kind: 'decoration', item_id: id, base_price: 3, sale_price: null, sale_starts_at: null, sale_ends_at: null, sale_label: null,
    }] }));
    await h.update(() => h.props('DecorationStoreCard').onBuy());
    assert.deepEqual(h.calls.findLast(call => call[0] === 'purchaseDecoration'), ['purchaseDecoration', id, 3]);
    await h.setLanguage();
    await h.update(() => h.props('DecorationStoreCard').onPreview());
    assert.ok(h.props('StorePreviewSheet').item.name.startsWith('translated:'));
  } finally { await h.close(); }
});

test(`Home header ignores unrelated pet updates while wallet, achievements, lives, and local sheets stay live (${mode})`, async () => {
  const h = await harness('home-header', compiled);
  try {
    const count = h.count('CoinCounter'), achievements = h.count('Pressable'), gameReads = h.count('gameReads');
    await h.setGame({ pet: { ...h.game.pet, name: 'Changed pet' } });
    assert.equal(h.count('CoinCounter'), count);
    assert.equal(h.count('gameReads'), gameReads, 'No whole-game subscription in the Home header');
    assert.equal(h.count('Pressable'), achievements, 'Achievements must not subscribe to the entire save');
    await h.setGame({ wallet: { coins: 23 } });
    assert.equal(h.props('CoinCounter').coins, 23);
    await h.setGame({ progress: { ...h.game.progress, completedPuzzleIds: h.load('@/utils/boss-achievements').getBossAchievements()[0].level.puzzleIds } });
    assert.ok(h.count('Pressable') > achievements);
    await h.setGame({ progress: { ...h.game.progress, lives: { current: 1, nextRegenAt: Date.now() + 60000 } } });
    assert.equal(h.props('BuyLifeSheet').lives.current, 1);
    const livesLabel = h.props('Pressable').accessibilityLabel;
    await h.tick();
    assert.notEqual(h.props('Pressable').accessibilityLabel, livesLabel, 'Memoization must not suppress the life countdown');
    await h.update(() => h.props('CoinCounter').onPress());
    assert.equal(h.props('CoinPackSheet').visible, true);
    await h.update(() => h.props('CoinPackSheet').onClose());
    assert.equal(h.props('CoinPackSheet').visible, false);
  } finally { await h.close(); }
});

test(`Home computes wisdom once across its preloaded rooms and reuses it for pet changes (${mode})`, async () => {
  const h = await harness('home', compiled);
  try {
    assert.equal(h.count('PetStage'), 4, 'Keep all existing preloaded rooms');
    assert.equal(h.count('wisdom'), 1);
    const wisdom = h.props('PetStage').wisdom;
    await h.setGame({ pet: { ...h.game.pet, name: 'New pet name' } });
    assert.equal(h.count('wisdom'), 1, 'Pet updates do not change puzzle completion');
    assert.equal(h.props('PetStage').wisdom, wisdom);
    await h.setGame({ progress: { ...h.game.progress,
      completedPuzzleIds: h.load('@/constants/puzzles').getPuzzlesByDifficulty('en', 'easy').slice(0, 60).map(puzzle => puzzle.id),
    } });
    assert.equal(h.count('wisdom'), 2);
    assert.ok(h.props('PetStage').wisdom > wisdom);
  } finally { await h.close(); }
});

test(`Home bedtime clock ticks do not rerender the rooms (${mode})`, async () => {
  const h = await harness('home', compiled);
  try {
    const count = h.count('PetStage');
    for (let tick = 0; tick < 5; tick++) await h.advance(5000);
    assert.equal(h.count('PetStage'), count);
  } finally { await h.close(); }
});

test(`covered Home defers game updates and receives the latest state on return (${mode})`, async () => {
  const h = await harness('home', compiled);
  try {
    await h.setActive(false);
    const renders = h.count('PetStage');
    const pet = { ...h.game.pet, name: 'Updated while shopping', stats: { ...h.game.pet.stats, happiness: 80 } };
    await h.setGame({ pet, wallet: { coins: 45 }, decorationEntry: { roomId: 'kitchen', id: 1 } });
    await h.setGame({ progress: { ...h.game.progress, streak: 7 } });
    assert.equal(h.count('PetStage'), renders, 'Covered game updates must not rebuild the room tree');
    await h.setActive(true);
    assert.equal(h.props('PetStage').name, pet.name);
    assert.equal(h.props('CoinCounter').coins, 45);
    assert.equal(h.props('CoinCounter').streak, 7);
    assert.equal(h.props('PetStage:kitchen').decorationEntry.id, 1, 'Store decoration handoff reaches the existing room');
    await h.setActive(false);
    await h.setGame({ isReady: false });
    assert.ok(h.props('ActivityIndicator'), 'Account/loading transitions still clear the previous room');
  } finally { await h.close(); }
});

test(`catalog updates refresh the Home saving hint without rendering rooms (${mode})`, async () => {
  const h = await harness('home', compiled);
  try {
    await h.setGame({ progress: { ...h.game.progress, storeGoal: { kind: 'room', id: 'room16' } }, wallet: { coins: 10 } });
    const count = h.count('PetStage');
    await h.update(() => h.load('@/utils/store-catalog').acceptStoreCatalog({ server_time: new Date(h.now).toISOString(), items: [{
      kind: 'room', item_id: 'room16', base_price: 30, sale_price: null, sale_starts_at: null, sale_ends_at: null, sale_label: null,
    }] }, h.now));
    assert.equal(h.count('PetStage'), count);
    assert.match(h.props('IconText').children, /remaining\":20/);
  } finally { await h.close(); }
});

test(`mood clock skips unchanged ticks, pauses when covered, and catches up on focus (${mode})`, async () => {
  const h = await harness('mood', compiled);
  try {
    await h.setGame({ pet: { ...h.game.pet, type: 'cat', isAsleep: false, lastInteractionAt: h.now,
      stats: { ...h.game.pet.stats, hunger: 80, happiness: 80 } },
      worldClock: { ...h.game.worldClock, realMs: h.now, worldMs: 12 * 3600000, speed: 1 } });
    const count = h.count('mood');
    for (let i = 0; i < 5; i++) await h.advance(5000);
    assert.equal(h.props('mood').mood, 'idle');
    assert.equal(h.count('mood'), count);
    await h.setGame({ worldClock: { ...h.game.worldClock, realMs: h.now, worldMs: (21 * 3600 - 30) * 1000, speed: 1 } });
    await h.setActive(false);
    const hidden = h.count('mood');
    await h.advance(120000);
    assert.equal(h.count('mood'), hidden);
    // No props changed while covered; focus must observe the night boundary.
    await h.setActive(true);
    assert.equal(h.props('mood').mood, 'lyingDown');
    await h.update(() => h.props('mood').onLieDownComplete());
    assert.equal(h.props('mood').mood, 'fallingAsleep');
    await h.update(() => h.props('mood').onFallAsleepComplete());
    assert.equal(h.props('mood').mood, 'sleeping');
    await h.setGame({ worldClock: { ...h.game.worldClock, realMs: h.now, worldMs: 9 * 3600000, speed: 1 } });
    assert.equal(h.props('mood').mood, 'idle', 'Dawn still wakes the cat');
  } finally { await h.close(); }
});

test(`dog mood still enters sleep and resets after interaction (${mode})`, async () => {
  const h = await harness('mood', compiled);
  try {
    await h.setGame({ pet: { ...h.game.pet, type: 'dog', isAsleep: false, lastInteractionAt: h.now,
      stats: { ...h.game.pet.stats, hunger: 80, happiness: 80 } }, worldClock: undefined });
    await h.advance(30 * 60000);
    assert.equal(h.props('mood').mood, 'fallingAsleep');
    const oldCompletion = h.props('mood').onFallAsleepComplete;
    await h.update(oldCompletion);
    assert.equal(h.props('mood').mood, 'sleeping');
    await h.setGame({ pet: { ...h.game.pet, lastInteractionAt: h.now } });
    assert.equal(h.props('mood').mood, 'idle');
    await h.update(oldCompletion);
    assert.equal(h.props('mood').mood, 'idle', 'An old animation cannot complete the new interaction');
  } finally { await h.close(); }
});

}
