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
  let clock = Date.now(), timerId = 0, frameId = 0;
  const frames = new Map();
  class ClockDate extends Date { static now() { return clock; } }
  let activity = { active: true, reduceMotion: false };
  const activityContext = React.createContext(activity);
  const actions = Object.fromEntries(['setProgress', 'purchaseRoom', 'equipRoom', 'purchaseBed', 'equipBed',
    'removeBedFromRoom', 'purchaseToy', 'placeToyInRoom', 'removeToyFromRoom', 'purchaseDecoration',
    'placeDecorationInRoom', 'removeDecorationFromRoom', 'purchaseSkin', 'equipSkin', 'recordInteraction',
    'requestRoomDecoration', 'setPet', 'buyLife'].map(name => [name, (...args) => {
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
      if (name === 'Group') {
        const first = React.Children.toArray(p.children)[0];
        props.set(`Group:${first?.props?.strokeWidth ?? 'fill'}`, p);
      }
      if (p.onLayout) props.set(`${name}:onLayout`, p.onLayout);
      if (name === 'RoomActionMenu' && p.size) counts.set('furnitureMenus', (counts.get('furnitureMenus') ?? 0) + 1);
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
  const searchParams = {};
  const stageCamera = { x: shared(0), y: shared(0), scale: shared(1), zoom: 1, gesture: {} };
  let stageActivity = { activity: null, scale: shared(1), facing: shared(1), objectX: shared(0), objectY: shared(0),
    clearBlockedActivity() {}, startActivity() {}, returnHome() {}, stopActivity() {} };
  const mocks = {
    '@shopify/react-native-skia': { Canvas: view('Canvas'), Path: view('Path'), Group: view('Group'), DashPathEffect: view('DashPathEffect'),
      Skia: { Path: { Make() { const points = []; return { points, moveTo(x, y) { points.push([x, y]); }, lineTo(x, y) { points.push([x, y]); }, close() {} }; } } } },
    '@/lib/graphics-mode': { useGraphicsMode: () => '3d' },
    '@/hooks/use-room-camera': { useRoomCamera: () => stageCamera },
    '@/hooks/use-room-activity': { useRoomActivity: options => {
      props.set('activityOptions', options); counts.set('stageRenders', (counts.get('stageRenders') ?? 0) + 1);
      const room = `stageRenders:${options.homeRoomId}`; counts.set(room, (counts.get(room) ?? 0) + 1);
      return stageActivity;
    } },
    'react-native-filament': { useBoxShape: (...size) => React.useMemo(() => size, size),
      useRigidBody: body => {
        counts.set('rigidBody', (counts.get('rigidBody') ?? 0) + 1); props.set(`body:${body.id}`, body);
        React.useEffect(() => { calls.push(['addBody', body.id, body.world]);
          return () => { calls.push(['removeBody', body.id, body.world]); };
        }, [body.id, body.world, body.shape, ...body.origin]);
      } },
    'react-native-worklets-core': { useSharedValue: value => React.useState(() => shared(value))[0] },
    'react-native-reanimated': { __esModule: true, default: { View: view('AnimatedView'), Text: view('AnimatedText') }, useReducedMotion: () => false,
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
      StyleSheet: { create: x => x }, PanResponder: { create: handlers => ({ panHandlers: handlers }) }, useWindowDimensions: () => dimensions,
      Dimensions: { get: () => dimensions }, PixelRatio: { roundToNearestPixel: x => x } },
    'react-native-safe-area-context': { SafeAreaView: view('SafeAreaView'), useSafeAreaInsets: () => insets },
    'expo-router': { useRouter: () => router, useLocalSearchParams: () => searchParams, Redirect: view('Redirect'), useFocusEffect: fn => { const { active } = React.useContext(activityContext); React.useEffect(() => active ? fn() : undefined, [active, fn]); } },
    'expo-haptics': { ImpactFeedbackStyle: { Light: 'light' } },
    'react-i18next': { useTranslation: () => ({ t: React.useContext(translationContext) }) },
    '@/contexts/GameProvider': { useGame: () => { counts.set('gameReads', (counts.get('gameReads') ?? 0) + 1); return React.useContext(gameContext); }, useGameActions: () => actions },
    '@/hooks/use-world-clock-now': { useWorldClockNow: () => React.useContext(clockContext) },
    '@/services/store-catalog': { refreshStoreCatalog: async () => {} },
    '@/utils/decoration-timing': { startDecorationTiming() {}, markDecorationTiming() {} },
    '@/lib/app-diagnostics': { reportAppError() {} },
    '@react-native-async-storage/async-storage': {},
  };
  const drawFrames = new Map();
  if (screen === 'contact-shadows' || screen === 'lamp-light') {
    const matrix = (pose = {}) => ({ pose,
      scaling: scale => matrix({ ...pose, scale }), rotate: heading => matrix({ ...pose, heading }),
      translate: position => matrix({ ...pose, position }) });
    const entity = {}, asset = { getRenderableEntities: () => [entity] };
    const nativeContext = {
      transformManager: { createIdentityMatrix: () => matrix(), setTransform: (_entity, value) => calls.push(['shadowPose', value.pose]) },
      renderableManager: { setCastShadow() {}, setReceiveShadow() {} },
      scene: { addEntities: () => calls.push(['addShadow']), removeEntities: () => calls.push(['removeShadow']) },
      lightManager: { shadowMapsSupported: true, setPosition: (_light, position) => calls.push(['lightPosition', position]), setDirection() {} },
    };
    Object.assign(mocks['react-native-filament'], {
      useFilamentContext: () => nativeContext,
      useModel: () => { counts.set('modelHooks', (counts.get('modelHooks') ?? 0) + 1); return { state: 'loaded', asset, rootEntity: entity }; },
      useLightEntity: (_manager, config) => {
        counts.set('lightHooks', (counts.get('lightHooks') ?? 0) + 1);
        return React.useMemo(() => ({ config }), [config.intensity, config.castShadows]);
      },
      useEntityInScene() {},
      useWorkletEffect: fn => React.useEffect(fn, []),
      RenderCallbackContext: { useRenderCallback: (fn, deps) => {
        const key = React.useRef({});
        React.useEffect(() => { drawFrames.set(key.current, fn); return () => drawFrames.delete(key.current); }, deps);
      } },
    });
  }
  if (screen === 'native-scene') {
    mocks['react-native'].StyleSheet.flatten = value => value;
    const matrix = () => { const value = { scaling: () => value, rotate: () => value, translate: () => value }; return value; };
    const nativeContext = { camera: {}, view: {}, engine: {}, workletContext: {},
      choreographer: { start() {}, stop() {} }, transformManager: { createIdentityMatrix: matrix }, renderableManager: {} };
    const world = {};
    Object.assign(mocks['react-native-filament'], {
      FilamentScene: view('FilamentScene'), FilamentView: view('FilamentView'), DefaultLight: view('DefaultLight'),
      useFilamentContext: () => nativeContext, useSyncSharedValue: value => value,
      useWorld: () => world, useStaticPlaneShape() {}, useSphereShape() {}, useAnimator() {}, useWorkletEffect() {},
      useModel: source => { counts.set(`model:${source}`, (counts.get(`model:${source}`) ?? 0) + 1); return { state: 'loading' }; },
      RenderCallbackContext: { useRenderCallback() {} },
    });
    mocks['react-native-worklets-core'].Worklets = { createRunOnJS: fn => fn };
    mocks['@/contexts/StartupVisualContext'] = { useStartupVisualReady() {} };
    mocks['./NativeCatActor'] = { useCatModel: () => ({ state: 'loading' }), NativeCatActor: view('NativeCatActor') };
    mocks['./use-model-shadows'] = { useModelShadows() {} };
    for (const name of ['NativeFoodSpill', 'NativeAirflow', 'NativeFireplace', 'NativeLampLight', 'NativeSpotlightHead',
      'NativeLampGlow', 'NativeContactShadows', 'NativeCurtain', 'NativeItemInteraction', 'NativeFridge',
      'NativeLightning', 'NativeWorldLighting', 'NativeWindowPane', 'NativeWindowWeather']) mocks[`./${name}`] = { [name]: view(name) };
  }
  if (screen === 'clock-hook' || screen === 'mood' || screen === 'home' || screen === 'stage' || screen === 'home-stage') delete mocks['@/hooks/use-world-clock-now'];
  if (screen === 'home') delete mocks['@/hooks/use-cat-bedtime'];
  if (screen === 'room-editor') delete mocks['@/hooks/use-room-editor'];
  function load(id, base = process.cwd()) {
    if (id in mocks) return mocks[id];
    if ((id.startsWith('@/components/') || id.startsWith('@/pet-display/components/')) && !id.endsWith('/GameHeaderStats') && !id.endsWith('/HomePuzzleHint') && !id.endsWith('/HomeRoomStage') && !(screen === 'native-scene' && id.endsWith('/NativeRoomScene')) && !(['contact-shadows', 'lamp-light'].includes(screen) && /\/Native(ContactShadows|LampLight)$/.test(id)) && !(screen === 'colliders' && id.endsWith('/NativeRoomColliders')) && !(screen === 'drag-target' && id.endsWith('/DraggableRoomPet')) && !(screen === 'overlay' && id.endsWith('/RoomPlacementOverlay')) && !((screen === 'stage' || screen === 'home-stage') && id.endsWith('/PetStage'))) {
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
    if (compiled && (file.endsWith('.tsx') || file.endsWith('/use-pet-base-mood.ts') || file.endsWith('/use-world-period.ts') || file.endsWith('/use-world-clock-now.ts') || file.endsWith('/use-room-editor.ts'))) {
      source = transformSync(source, { filename: file, configFile: false, babelrc: false,
        parserOpts: { plugins: ['typescript', 'jsx'] }, plugins: [['babel-plugin-react-compiler', { target: '19' }]],
      }).code;
    }
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText, { module, exports: module.exports, require: child => load(child, path.dirname(file)),
      Date: ClockDate, Math, Map, Set, Promise, console, requestAnimationFrame: fn => { const id = ++frameId; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id), requestIdleCallback: () => 1, cancelIdleCallback() {}, __DEV__: false, process: { env: {} },
      setInterval: fn => { const id = ++timerId; timers.set(id, fn); return id; }, clearInterval: id => timers.delete(id),
      setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
    });
    if (file.endsWith('/utils/learning-recommendations.ts')) {
      const recommend = module.exports.getLearningRecommendation;
      module.exports.getLearningRecommendation = (...args) => { counts.set('recommendation', (counts.get('recommendation') ?? 0) + 1); return recommend(...args); };
    }
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
  if (screen === 'overlay') {
    const world = load('@/utils/native-room-world').buildNativeRoomWorld({ width: 390, height: 420, petSize: 100, sizeScale: 1,
      decorations: [{ decorationId: 'bowlBlue', instanceId: 'bowl', offset: { x: 0, y: 0 } }], toys: [] });
    stageProps = { world, feedback: { candidate: world.objects[0], blockers: [], boundaries: [] } };
  }
  function OverlayProbe() { return React.createElement(load('@/components/pet/RoomPlacementOverlay').RoomPlacementOverlay, stageProps); }
  const playback = { kind: 'segment', mood: 'idle' };
  function StageProbe() {
    return React.createElement(load('@/components/pet/PetStage').PetStage, {
      name: game.pet.name, petType: 'cat', compact: true, stats: game.pet.stats, wisdom: 0,
      worldClock: game.worldClock, playback, ...stageProps,
    });
  }
  function MoodProbe() { props.set('mood', load('@/pet-display/hooks/use-pet-base-mood').usePetBaseMood(game.pet, game.worldClock)); counts.set('mood', (counts.get('mood') ?? 0) + 1); return null; }
  function DragTargetProbe() { return React.createElement(load('@/components/pet/DraggableRoomPet').DraggableRoomPet,
    { testID: 'target', petSize: 60, accessibilityLabel: 'Bed', ...stageProps }); }
  function RoomEditorProbe() { props.set('editor', load('@/hooks/use-room-editor').useRoomEditor(game.pet, actions.setPet, game.progress)); return null; }
  const colliderWorld = {}, emptyObjects = [];
  function ColliderProbe() { return React.createElement(load('@/components/pet/native/NativeRoomColliders').NativeRoomColliders,
    { world: stageProps.world ?? colliderWorld, objects: stageProps.objects ?? emptyObjects }); }
  function HomeAdapterProbe() { return React.createElement(load('@/components/home/HomeRoomStage').HomeRoomStage,
    { savedRoom: game.pet, homeRoomId: 'livingRoom', commitRoomEdit: actions.setPet, completeRoomActivity: actions.recordInteraction, ...stageProps }); }
  const emptyNativeWorld = { objects: [] };
  function NativeEffectsProbe() {
    return screen === 'contact-shadows'
      ? React.createElement(load('@/components/pet/native/NativeContactShadows').NativeContactShadows, { world: emptyNativeWorld, active: true, ...stageProps })
      : stageProps.object ? React.createElement(load('@/components/pet/native/NativeLampLight').NativeLampLight, { active: true, ...stageProps }) : null;
  }
  const nativeProbeWorld = screen === 'native-scene' ? load('@/utils/native-room-world').buildNativeRoomWorld({
    width: 390, height: 420, petSize: 100, sizeScale: 1, toys: [], decorations: [] }) : undefined;
  function NativeSceneProbe() { return React.createElement(load('@/components/pet/native/NativeRoomScene').NativeRoomSurface,
    { world: nativeProbeWorld, catPresent: false, ...stageProps }); }
  function ClockHookProbe() {
    counts.set('clockRenders', (counts.get('clockRenders') ?? 0) + 1);
    const value = screen === 'period-hook' ? load('@/hooks/use-world-period').useWorldPeriod(game.worldClock, stageProps.enabled)
      : load('@/hooks/use-world-clock-now').useWorldClockNow(stageProps.intervalMs ?? 5000, stageProps.enabled);
    props.set('clockReading', value); return null;
  }
  const Screen = screen === 'period-hook' || screen === 'clock-hook' ? ClockHookProbe : screen === 'native-scene' ? NativeSceneProbe : ['contact-shadows', 'lamp-light'].includes(screen) ? NativeEffectsProbe : screen === 'colliders' ? ColliderProbe : screen === 'puzzles' ? load('@/app/puzzles').default : screen === 'home-adapter' ? HomeAdapterProbe : screen === 'drag-target' ? DragTargetProbe : screen === 'room-editor' ? RoomEditorProbe : screen === 'overlay' ? OverlayProbe : screen === 'stage' ? StageProbe : screen === 'mood' ? MoodProbe : screen === 'store' ? load('@/app/store').default : screen === 'home' || screen === 'home-stage' ? load('@/app/index').default : load('@/components/economy/GameHeaderStats').GameHeaderStats;
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
  return { drawFrames, props: name => props.get(name), count: name => counts.get(name) ?? 0, calls, load, update,
    get now() { return clock; },
    get timerCount() { return timers.size; },
    get frameCount() { return frames.size; },
    async flushFrames() { await update(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); }); },
    async setRoomActivity(next) { stageActivity = { ...stageActivity, ...next }; await render(); },
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

test(`Undo availability only rerenders the room being decorated (${mode})`, async () => {
  const h = await harness('home-adapter', compiled);
  try {
    const controls = { undo() {}, saveLayout() {}, restoreLayout() {}, canUndo: false, canRestore: false };
    await h.setStage({ roomEditor: controls });
    const count = h.count('PetStage');
    await h.setStage({ roomEditor: { ...controls, canUndo: true } });
    assert.equal(h.count('PetStage'), count, 'Other rooms do not rerender for Undo history');
    await h.setStage({ roomToolbar: { decorating: true, onDecoratingChange() {} } });
    assert.ok(h.count('PetStage') > count);
    assert.equal(h.props('PetStage').roomEditor.canUndo, true);
    await h.setStage({ roomEditor: controls });
    assert.equal(h.props('PetStage').roomEditor.canUndo, false);
  } finally { await h.close(); }
});

test(`room navigation adapters keep current callbacks without rebuilding unchanged stages (${mode})`, async () => {
  const h = await harness('home-adapter', compiled);
  try {
    const events = [];
    const handlers = label => ({
      onVisitHomeRoom: (...args) => events.push([label, 'visit', ...args]),
      onSendCatToRoom: (...args) => events.push([label, 'cat', ...args]),
      onBedRemove: () => events.push([label, 'remove']),
    });
    await h.setStage({ ...handlers('old'), storedItems: [] });
    const before = h.props('PetStage'), count = h.count('PetStage');
    const storage = [{ target: { kind: 'bed', id: 'brown' }, count: 1 }];
    await h.setStage({ ...handlers('latest'), storedItems: storage });
    assert.equal(h.count('PetStage'), count, 'Navigation closures and hidden storage must not invalidate the stage');
    const motion = { speed: .4, phase: .2, gait: 'walk', tailYaw: [0], tailPitch: [0] };
    before.onVisitHomeRoom('kitchen', true);
    before.onSendCatToRoom('bedroom', 'night', motion);
    before.onBedRemove();
    assert.deepEqual(events, [['latest', 'visit', 'kitchen', true], ['latest', 'cat', 'bedroom', 'night', motion], ['latest', 'remove']]);

    const sceneSlide = { progress: {}, direction: 1, outgoing: true }, roomEntry = { id: 2, direction: -1 };
    const ready = () => events.push(['ready']);
    await h.setStage({ roomVisible: false, sceneSlide, roomEntry, onSceneReady: ready });
    assert.ok(h.count('PetStage') > count, 'Visibility and readiness changes still reach the stage');
    assert.equal(h.props('PetStage').roomVisible, false);
    assert.equal(h.props('PetStage').sceneSlide, sceneSlide);
    assert.equal(h.props('PetStage').roomEntry, roomEntry);
    assert.equal(h.props('PetStage').onSceneReady, ready);

    await h.setStage({ onVisitHomeRoom: undefined, onSendCatToRoom: undefined, onBedRemove: undefined });
    for (const key of ['onVisitHomeRoom', 'onSendCatToRoom', 'onBedRemove']) assert.equal(h.props('PetStage')[key], undefined);
    const length = events.length;
    before.onVisitHomeRoom('bathroom'); before.onSendCatToRoom('bathroom'); before.onBedRemove();
    assert.equal(events.length, length, 'Previously retained handlers cannot invoke removed callbacks');

    await h.setStage({ roomToolbar: { decorating: true, onDecoratingChange() {} } });
    assert.equal(h.props('PetStage').storedItems, storage, 'Entering decoration mode receives current inventory');
    const updated = [...storage, { target: { kind: 'toy', id: 'orangeBall' }, count: 1 }];
    await h.setStage({ storedItems: updated });
    assert.equal(h.props('PetStage').storedItems, updated, 'Inventory changes remain live while decorating');
    await h.setStage({ roomToolbar: undefined });
    assert.equal(h.props('PetStage').storedItems, updated, 'Stages with local decoration controls retain inventory');
  } finally { await h.close(); }
});

test(`furniture menus retain their actions across visibility changes but call current activity guards (${mode})`, async () => {
  const h = await harness('stage', compiled);
  try {
    const events = [];
    await h.setRoomActivity({ startActivity: (...args) => events.push(['old-start', ...args]), returnHome: () => events.push(['old-return']) });
    await h.setStage({ onFeed() {}, onTogglePlacedDecorationOpen() {}, onRoomInteraction: () => 123,
      placedDecorations: [{ decorationId: 'bowlBlue', instanceId: 'bowl', offset: { x: 0, y: 0 } },
        { decorationId: 'japaneseCloset', instanceId: 'closet', offset: { x: -.5, y: 0 }, opened: true }] });
    await h.update(() => h.props('AnimatedView:onLayout')({ nativeEvent: { layout: { width: 390, height: 420 } } }));
    const menu = h.props('room-object:bowl').menuActions;
    await h.setRoomActivity({ startActivity: (...args) => events.push(['latest-start', ...args]), returnHome: () => events.push(['latest-return']) });
    await h.setStage({ roomVisible: false });
    assert.equal(h.props('room-object:bowl').menuActions, menu, 'Visibility-dependent handlers must not rebuild furniture actions');
    await h.update(() => menu.find(item => item.label === 'home.catCommands.bowlEat').onPress());
    assert.deepEqual(events.at(-1), ['latest-start', 'bowlEat', 'bowl', 123]);

    await h.setRoomActivity({ activity: { plan: { kind: 'cupboardHide', targetInstanceId: 'closet', steps: [{ mood: 'idle' }] }, stepIndex: 0 } });
    await h.setStage({ roomVisible: true });
    const closet = h.props('room-object:closet').menuActions;
    await h.setRoomActivity({ returnHome: () => events.push(['current-return']) });
    await h.setStage({ roomVisible: false });
    assert.equal(h.props('room-object:closet').menuActions, closet);
    await h.update(() => closet.find(item => item.label.startsWith('home.closeItem')).onPress());
    assert.deepEqual(events.at(-1), ['current-return'], 'Closing occupied furniture still uses the latest safe-exit handler');
    await h.setStage({ roomActivityBlocked: true });
    assert.equal(h.props('room-object:bowl').menuActions, undefined, 'Blocked interaction state must still update the menus');
  } finally { await h.close(); }
});

test(`browsing rooms and returning after a save leaves hidden stages and furniture menus cached (${mode})`, async () => {
  const h = await harness('home-stage', compiled);
  try {
    const { switchHomeRoom } = h.load('@/utils/home-rooms');
    const { syncPetLayerOrder } = h.load('@/utils/room-layer-order');
    await h.setGame({ pet: syncPetLayerOrder({ ...h.game.pet, homeRoomId: 'livingRoom', roomId: 'room1', catHomeRoomId: 'bedroom',
      placedDecorations: [{ decorationId: 'lampFloorArc', instanceId: 'living-lamp', offset: { x: -.3, y: 0 } }],
      homeRooms: { ...h.game.pet.homeRooms, kitchen: syncPetLayerOrder({ ...h.load('@/utils/room-layout').captureRoomLayout({}), roomId: 'room1',
        placedDecorations: [{ decorationId: 'bowlBlue', instanceId: 'kitchen-bowl', offset: { x: 0, y: 0 } }] }) } }) });
    for (const destination of ['kitchen', 'bathroom', 'kitchen', 'livingRoom']) {
      const source = h.game.pet.homeRoomId ?? 'livingRoom';
      const hidden = ['bedroom', 'livingRoom', 'kitchen', 'bathroom'].filter(id => id !== source && id !== destination);
      const counts = hidden.map(id => h.count(`stageRenders:${id}`));
      const menus = h.count('furnitureMenus'), lamp = h.count('room-object:living-lamp'), bowl = h.count('room-object:kitchen-bowl');
      await h.setGame({ pet: switchHomeRoom(h.game.pet, destination) });
      assert.deepEqual(hidden.map(id => h.count(`stageRenders:${id}`)), counts, 'Unaffected hidden rooms must skip navigation updates');
      assert.equal(h.count('furnitureMenus'), menus, `Browsing ${source} to ${destination} must not rebuild furniture menus`);
      assert.equal(h.count('room-object:living-lamp'), lamp);
      assert.equal(h.count('room-object:kitchen-bowl'), bowl);
      assert.equal(h.game.pet.catHomeRoomId, 'bedroom');
    }
    const saved = { ...h.game.pet.placedDecorations[0], offset: { x: -.2, y: .1 } };
    const hidden = ['bedroom', 'kitchen', 'bathroom'].map(id => h.count(`stageRenders:${id}`));
    await h.setGame({ pet: { ...h.game.pet, placedDecorations: [saved] } });
    assert.deepEqual(['bedroom', 'kitchen', 'bathroom'].map(id => h.count(`stageRenders:${id}`)), hidden, 'Saving one room must not update the others');
    const menus = h.count('furnitureMenus');
    for (const destination of ['kitchen', 'bathroom', 'kitchen', 'livingRoom']) {
      await h.setGame({ pet: switchHomeRoom(h.game.pet, destination) });
    }
    assert.equal(h.count('furnitureMenus'), menus, 'Navigation after saving must retain furniture menus');
    assert.equal(h.game.pet.placedDecorations[0], saved, 'Navigation retains the saved furniture');
  } finally { await h.close(); }
});

test(`unchanged drag targets retain their views but use the latest drop handlers (${mode})`, async () => {
  const h = await harness('drag-target', compiled);
  try {
    const events = [];
    const handlers = label => ({ onPetTap: () => events.push([label, 'tap']),
      onDragStart: () => events.push([label, 'start']),
      onDragPositionChange: point => { events.push([label, 'move']); return point; },
      onDragEnd: point => { events.push([label, 'end']); return point; },
      onOffsetChange: point => events.push([label, 'save', point]) });
    await h.setStage({ ...handlers('old'), externalPosition: { x: 10, y: 20 }, initialOffset: { x: .1, y: .2 } });
    await h.update(() => h.props('AnimatedView:onLayout')({ nativeEvent: { layout: { width: 390, height: 420 } } }));
    const count = h.count('target');
    await h.setStage({ ...handlers('latest'), externalPosition: { x: 10, y: 20 }, initialOffset: { x: .1, y: .2 } });
    assert.equal(h.count('target'), count, 'Equivalent placement and fresh callbacks must not rebuild animated hit targets');
    await h.update(() => h.props('target').onAccessibilityTap());
    await h.update(() => {
      const target = h.props('target');
      target.onPanResponderGrant();
      target.onPanResponderMove({}, { dx: 20, dy: 10 });
      target.onPanResponderRelease();
    });
    assert.deepEqual(events.map(event => event.slice(0, 2)), ['tap', 'start', 'move', 'end', 'save'].map(event => ['latest', event]));
    const movedCount = h.count('target');
    await h.setStage({ externalPosition: { x: 30, y: 25 }, selected: true });
    assert.ok(h.count('target') > movedCount, 'Moved targets and selection must still update');
    assert.equal(h.props('target').accessibilityState.selected, true);
    await h.setStage({ onPetTap: undefined, onDragEnd: undefined, onOffsetChange: undefined, allowDrag: false });
    const length = events.length;
    await h.update(() => h.props('target').onAccessibilityTap());
    assert.equal(events.length, length, 'Removed handlers cannot remain callable');
  } finally { await h.close(); }
});

test(`Undo controls stay stable across saves and restore the latest layout (${mode})`, async () => {
  const h = await harness('room-editor', compiled);
  try {
    const initial = h.game.pet;
    const move = async x => h.setGame({ pet: { ...h.game.pet, roomBedOffset: { x, y: .3 } } });
    await move(.1);
    const first = h.props('editor');
    assert.equal(first.canUndo, true);
    await move(.2);
    assert.equal(h.props('editor'), first, 'Another history entry does not change the toolbar');
    await h.update(first.undo);
    await h.setGame({ pet: h.calls.at(-1)[1](h.game.pet) });
    assert.equal(h.game.pet.roomBedOffset.x, .1);
    assert.equal(h.props('editor').canUndo, true);
    await h.update(first.undo);
    await h.setGame({ pet: h.calls.at(-1)[1](h.game.pet) });
    assert.equal(h.game.pet.roomBedOffset, initial.roomBedOffset);
    assert.equal(h.props('editor').canUndo, false);
    await move(.4);
    await h.setGame({ progress: { ...h.game.progress, toyQuantities: { ...h.game.progress.toyQuantities } } });
    assert.equal(h.props('editor').canUndo, false, 'Ownership reconciliation invalidates old layouts');
    const calls = h.calls.length;
    await h.update(first.undo);
    assert.equal(h.calls.length, calls, 'A previously captured Undo cannot restore revoked inventory');
    await move(.5);
    await h.setGame({ pet: { ...h.game.pet, homeRoomId: 'kitchen' } });
    assert.equal(h.props('editor').canUndo, false, 'Room changes clear history');
  } finally { await h.close(); }
});

test(`saving a bed preserves other rooms' furniture callbacks and native scenes (${mode})`, async () => {
  const h = await harness('home', compiled);
  try {
    await h.setGame({ pet: h.load('@/utils/room-edit').applyRoomObjectEdits(h.game.pet, []) });
    const before = h.props('PetStage:kitchen');
    await h.setGame({ pet: h.load('@/utils/room-edit').applyRoomObjectEdits(h.game.pet,
      [{ instanceId: 'bed', offset: { x: .2, y: .3 } }]) });
    const after = h.props('PetStage:kitchen');
    for (const key of ['placedToys', 'placedDecorations', 'roomToolbar', 'onCommitRoomEdit', 'onPlacedToyRemove', 'onPlacedDecorationRemove']) {
      assert.equal(after[key], before[key], key);
    }
    assert.equal(h.game.pet.roomBedOffset.x, .2);
    const removed = [];
    await h.setGame({ pet: { ...h.game.pet, placedDecorations: [{ decorationId: 'bowlBlue', instanceId: 'new-bowl', offset: { x: .1, y: .2 } }] },
      removeDecorationFromRoom: (...args) => { removed.push(args); return false; } });
    const current = h.props('PetStage:kitchen');
    assert.equal(current.onPlacedDecorationRemove, before.onPlacedDecorationRemove, 'Stationary room menus keep their callbacks after a decoration edit');
    await h.update(() => before.onPlacedDecorationRemove('new-bowl'));
    assert.deepEqual(removed, [['bowlBlue', 'new-bowl']], 'The retained menu callback resolves the latest item and action');
  } finally { await h.close(); }
});

test(`placement outlines reuse geometry during translation and refresh for changed shape (${mode})`, async () => {
  const h = await harness('overlay', compiled);
  try {
    const group = () => h.props('Group:fill');
    const shape = () => React.Children.toArray(group().children)[0].props.path;
    const initial = shape(), parts = React.Children.toArray(h.props('Group:1.2').children)[0].props.path;
    const world = h.load('@/utils/native-room-world');
    const layout = world.buildNativeRoomWorld({ width: 390, height: 420, petSize: 100, sizeScale: 1,
      decorations: [{ decorationId: 'bowlBlue', instanceId: 'bowl', offset: { x: 0, y: 0 } }], toys: [] });
    const original = layout.objects[0];
    let candidate;
    for (const position of [[.2, .3, -.4], [-.5, 1.2, .7]]) {
      candidate = h.load('@/utils/room-support').transformRoomObject(original, position, original.heading, original.scale);
      await h.setStage({ feedback: { candidate, blockers: [], boundaries: [], access: 'clear' } });
      assert.equal(shape(), initial, 'Translation must reuse the footprint path');
      assert.equal(React.Children.toArray(h.props('Group:1.2').children)[0].props.path, parts, 'Translation must reuse structural paths');
      const expected = h.load('@/utils/room-item-placement').roomItemFootprint(candidate).map(point => world.projectWorld(point, 390));
      for (let i = 0; i < expected.length; i++) {
        assert.ok(Math.abs(initial.points[i][0] + group().transform.get()[0].translateX - expected[i].x - 195) < 1e-8);
        assert.ok(Math.abs(initial.points[i][1] + group().transform.get()[1].translateY - expected[i].y - 210) < 1e-8);
      }
      const expectedParts = h.load('@/utils/room-item-placement').roomItemPlacementOutline(candidate);
      const point = world.projectWorld(expectedParts[0][0], 390), transform = h.props('Group:1.2').transform.get();
      assert.ok(Math.abs(parts.points[0][0] + transform[0].translateX - point.x - 195) < 1e-8);
      assert.ok(Math.abs(parts.points[0][1] + transform[1].translateY - point.y - 210) < 1e-8);
    }
    for (const change of [{ heading: 1 }, { scale: original.scale * 1.2 }, { modelId: 'lampFloorArc' }]) {
      const before = shape();
      candidate = { ...candidate, ...change };
      await h.setStage({ feedback: { candidate, blockers: [], boundaries: ['frontEdge'] } });
      assert.notEqual(shape(), before, 'Rotation, scale and model changes rebuild the outline');
    }
  } finally { await h.close(); }
});

test(`native drag motion updates independently of React diagnostics (${mode})`, async () => {
  const h = await harness('stage', compiled);
  try {
    const commits = [];
    await h.setStage({ roomToolbar: { decorating: true, onDecoratingChange() {} },
      onCommitRoomEdit: (...args) => { commits.push(args); return true; },
      placedDecorations: [{ decorationId: 'bowlBlue', instanceId: 'bowl', offset: { x: 0, y: 0 } }] });
    await h.update(() => h.props('AnimatedView:onLayout')({ nativeEvent: { layout: { width: 390, height: 420 } } }));
    const editor = () => h.props('NativeRoomEditor');
    await h.update(() => editor().select('bowl'));
    assert.equal(h.props('RoomPlacementOverlay').visible, false, 'Selection prepares outline geometry before the first drag');
    const start = editor().anchor('bowl');
    let motion = { session: 1, sequence: 0, x: 0, y: 0, active: true, moved: false, at: 1, measure: false };
    editor().motion.set(motion);
    await h.update(() => editor().prepare('bowl', start, motion));
    const move = async x => {
      motion = { ...motion, x, y: 1000, moved: true, sequence: motion.sequence + 1 };
      editor().motion.set(motion);
      await h.update(() => editor().move('bowl', { x: start.x + x, y: start.y + 1000 }, motion));
    };
    await move(1000);
    const renders = h.count('stageRenders'), menus = h.count('RoomItemMoveControls');
    const scene = h.props('NativeRoomScene'), first = scene.dragBase.get().object.position;
    for (let i = 1; i <= 12; i++) await move(1000 + i * 2);
    assert.equal(h.count('stageRenders'), renders, 'Unchanged diagnostics must not rerender PetStage');
    assert.equal(h.count('RoomItemMoveControls'), menus, 'Position-only samples must not rebuild controls');
    assert.notDeepEqual(scene.dragBase.get().object.position, first, 'The native preview base still advances');
    const target = h.props('room-object:bowl').animatedPosition;
    const before = target.x.get();
    editor().motion.set({ ...motion, x: motion.x + 20, sequence: motion.sequence + 1 });
    assert.equal(target.x.get(), before + 20, 'UI position follows input without invoking any JS feedback callback');
    assert.equal(commits.length, 0);
    await h.update(() => editor().commit('bowl', { x: 1500, y: 1400 }));
    assert.equal(commits.length, 0, 'Release still rejects the exact out-of-bounds drop');
    assert.equal(scene.dragBase.get(), undefined, 'Release relinquishes native preview ownership');
    assert.ok(scene.editingObject.value, 'Rejected final pose is kept for the placement controls');
    await h.update(() => editor().discard('bowl'));
    assert.equal(scene.editingObject.value, undefined);
  } finally { await h.close(); }
});

test(`bed drag through fireplace collisions keeps the pointer anchor (${mode})`, async () => {
  const h = await harness('stage', compiled);
  try {
    const commits = [];
    await h.setStage({ catPresent: false, bedId: 'green', roomBedOffset: { x: .3, y: .3 },
      roomToolbar: { decorating: true, onDecoratingChange() {} },
      onCommitRoomEdit: (...args) => { commits.push(args); return true; },
      placedDecorations: [{ decorationId: 'livingFireplaceCream', instanceId: 'fireplace', offset: { x: -.3, y: -.2 } }] });
    await h.update(() => h.props('AnimatedView:onLayout')({ nativeEvent: { layout: { width: 390, height: 420 } } }));
    const editor = () => h.props('NativeRoomEditor');
    await h.update(() => editor().select('bed'));
    const scene = h.props('NativeRoomScene'), world = scene.world;
    const bed = world.objects.find(x => x.instanceId === 'bed'), fireplace = world.objects.find(x => x.instanceId === 'fireplace');
    const { transformRoomObject } = h.load('@/utils/room-support');
    const { roomItemAnchor } = h.load('@/utils/room-item-placement');
    const target = roomItemAnchor(transformRoomObject(bed, [fireplace.position[0], bed.position[1], fireplace.position[2]]), world.width);
    const start = editor().anchor('bed');
    let motion = { session: 12, sequence: 0, x: 0, y: 0, active: true, moved: false, at: 1, measure: false };
    editor().motion.set(motion); await h.update(() => editor().prepare('bed', start, motion));
    for (let i = 12; i >= 0; i--) {
      const point = { x: target.x + i * 3, y: target.y };
      motion = { ...motion, sequence: motion.sequence + 1, moved: true, x: point.x - start.x, y: point.y - start.y };
      editor().motion.set(motion); await h.update(() => editor().move('bed', point, motion));
      const object = scene.dragBase.get().object, anchor = roomItemAnchor(object, world.width);
      assert.ok(Math.hypot(anchor.x - point.x, anchor.y - point.y) < 1e-7, 'Collision feedback must not pull the bed away from the finger');
      assert.equal(object.supportId, undefined);
    }
    assert.ok(h.props('RoomPlacementOverlay').feedback.blockers.some(hit => hit.instanceId === 'fireplace'));
    await h.update(() => editor().commit('bed', target, motion));
    assert.equal(commits.length, 0, 'The fireplace collision remains invalid on release');
    const final = roomItemAnchor(scene.editingObject.value, world.width);
    assert.ok(Math.hypot(final.x - target.x, final.y - target.y) < 1e-7);
    await h.update(() => editor().discard('bed'));
  } finally { await h.close(); }
});

test(`surface drag keeps its grab anchor and validates the held board on release (${mode})`, async () => {
  const h = await harness('stage', compiled);
  try {
    const commits = [];
    await h.setStage({ catPresent: false, roomToolbar: { decorating: true, onDecoratingChange() {} },
      onCommitRoomEdit: (...args) => { commits.push(args); return true; },
      placedDecorations: [
        { decorationId: 'kitchenModernIslandNavy', instanceId: 'table', offset: { x: 0, y: 0 } },
        { decorationId: 'lampTableMushroom', instanceId: 'lamp', offset: { x: .4, y: .4 }, scale: .6 },
      ] });
    await h.update(() => h.props('AnimatedView:onLayout')({ nativeEvent: { layout: { width: 390, height: 420 } } }));
    const editor = () => h.props('NativeRoomEditor');
    await h.update(() => editor().select('lamp'));
    const { NATIVE_MODEL_CATALOG } = h.load('@/utils/native-room-world');
    const { transformRoomObject } = h.load('@/utils/room-support');
    const { roomItemAnchor } = h.load('@/utils/room-item-placement');
    const scene = h.props('NativeRoomScene'), world = scene.world;
    const lamp = world.objects.find(x => x.instanceId === 'lamp'), table = world.objects.find(x => x.instanceId === 'table');
    const meta = NATIVE_MODEL_CATALOG[lamp.modelId], top = NATIVE_MODEL_CATALOG[table.modelId].supportSurfaces[0];
    const resting = transformRoomObject(lamp, [table.position[0], table.position[1] + top.max[1] * table.scale + .002 - meta.min[1] * lamp.scale, table.position[2]]);
    const point = object => roomItemAnchor(object, world.width), center = point(resting), start = editor().anchor('lamp');
    let motion = { session: 9, sequence: 0, x: 0, y: 0, active: true, moved: false, at: 1, measure: false };
    editor().motion.set(motion);
    await h.update(() => editor().prepare('lamp', start, motion));
    const move = async target => {
      motion = { ...motion, sequence: motion.sequence + 1, moved: true, x: target.x - start.x, y: target.y - start.y };
      editor().motion.set(motion);
      await h.update(() => editor().move('lamp', target, motion));
      const base = scene.dragBase.get(), actual = point(base.object);
      assert.ok(Math.hypot(actual.x - target.x, actual.y - target.y) < 1e-7, 'Feedback cannot move the grabbed point');
      assert.equal(base.object.supportId, 'table');
    };
    await move(center);
    const renders = h.count('stageRenders');
    for (let i = 1; i <= 12; i++) await move({ x: center.x + i * .1, y: center.y });
    assert.equal(h.count('stageRenders'), renders, 'Motion on the same surface does not publish position-only React feedback');
    const edgeX = table.position[0] + top.max[0] * table.scale - Math.max(...meta.baseHull.map(([x]) => x * lamp.scale));
    const overhang = point(transformRoomObject(resting, [edgeX + .02, resting.position[1], resting.position[2]]));
    await move(overhang);
    assert.equal(h.props('RoomPlacementOverlay').feedback.unsupportedSurfaceId, 'table');
    await h.update(() => editor().commit('lamp', overhang, motion));
    assert.equal(commits.length, 0, 'The retention margin never makes an unsupported drop legal');
    assert.equal(scene.editingObject.value.supportId, 'table');
    const final = point(scene.editingObject.value);
    assert.ok(Math.hypot(final.x - overhang.x, final.y - overhang.y) < 1e-7, 'Release retains the displayed preview');
    assert.equal(scene.dragBase.get(), undefined);
    await h.update(() => editor().discard('lamp'));
    assert.equal(scene.editingObject.value, undefined);
  } finally { await h.close(); }
});

test(`decoration dragging reuses stationary targets and keeps preview validation current (${mode})`, async () => {
  const h = await harness('stage', compiled);
  try {
    const commits = [];
    await h.setStage({ roomToolbar: { decorating: true, onDecoratingChange() {} }, bedId: 'bed1',
      onCommitRoomEdit: (...args) => { commits.push(args); return false; },
      placedDecorations: [{ decorationId: 'bowlBlue', instanceId: 'bowl', offset: { x: .4, y: .3 } },
        { decorationId: 'lampFloorArc', instanceId: 'lamp', offset: { x: -.4, y: -.3 } }] });
    await h.update(() => h.props('AnimatedView:onLayout')({ nativeEvent: { layout: { width: 390, height: 420 } } }));
    const editor = () => h.props('NativeRoomEditor');
    await h.update(() => editor().select('bowl'));
    const start = editor().anchor('bowl');
    assert.ok(start);
    const stationary = h.count('room-object:lamp'), scenes = h.count('NativeRoomScene');
    await h.update(() => editor().move('bowl', { x: start.x + 2, y: start.y + 2 }));
    const before = h.props('room-object:bowl').externalPosition;
    for (let i = 1; i <= 12; i++) {
      await h.update(() => editor().move('bowl', { x: start.x + i * 2, y: start.y + i }));
    }
    assert.equal(h.count('room-object:lamp'), stationary, 'Dragging one object must not rerender the other furniture targets');
    assert.equal(h.count('NativeRoomScene'), scenes, 'Drag preview must not rebuild the native scene');
    assert.notDeepEqual(h.props('room-object:bowl').externalPosition, before, 'The selected target follows the live anchor');
    assert.equal(commits.length, 0, 'Preview frames must not save layouts');
    await h.update(() => editor().commit('bowl', { x: 10000, y: 10000 }));
    assert.equal(commits.length, 0, 'An invalid drop must not commit');
    assert.equal(h.props('RoomItemMoveControls').placementAllowed, false);
    await h.update(() => editor().discard('bowl'));
    assert.equal(h.props('NativeRoomScene').editingObject.value, undefined);
    assert.deepEqual(h.props('room-object:bowl').externalPosition, start, 'Cancellation restores the saved anchor');
    assert.equal(h.count('room-object:lamp'), stationary, 'Drag start, rejection and cancellation also keep stationary targets cached');
    await h.update(() => editor().select('lamp'));
    assert.equal(h.props('room-object:lamp').selected, true);
    assert.equal(h.props('room-object:bowl').selected, false);
  } finally { await h.close(); }
});

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

test(`room pauses skip unchanged furniture model hooks while geometry changes remain live (${mode})`, async () => {
  const h = await harness('native-scene', compiled);
  try {
    const w = h.load('@/utils/native-room-world'), sources = h.load('@/constants/native-model-sources').NATIVE_MODEL_SOURCES;
    const world = w.buildNativeRoomWorld({ width: 390, height: 420, petSize: 100, sizeScale: 1,
      decorations: [{ decorationId: 'sofaA', instanceId: 'sofa', offset: { x: 0, y: 0 } }], toys: [] });
    await h.setStage({ world });
    const key = `model:${sources.sofaA}`, before = h.count(key);
    assert.ok(before > 0);
    await h.setStage({ paused: true });
    await h.setStage({ paused: false });
    await h.setStage({ editing: true });
    await h.setStage({ editing: false });
    assert.equal(h.count(key), before, 'Room visibility and editing only change the shared motion flag');
    await h.setStage({ world: { ...world, objects: [{ ...world.objects[0], heading: .5 }] } });
    assert.equal(h.count(key), before + 1, 'A saved furniture rotation refreshes its native model hooks');
  } finally { await h.close(); }
});

test(`native scene callbacks keep identity and enforce current save guards (${mode})`, async () => {
  const h = await harness('stage', compiled);
  try {
    const saves = [], ready = [];
    await h.setStage({ onSceneReady: room => ready.push(room), onPlacedToyOffsetChange: (...args) => saves.push(args),
      placedToys: [{ toyId: 'orangeBall', instanceId: 'ball', offset: { x: .5, y: .4 } }] });
    await h.update(() => h.props('AnimatedView:onLayout')({ nativeEvent: { layout: { width: 390, height: 420 } } }));
    const position = h.props('NativeRoomScene').onObjectPosition, painted = h.props('NativeRoomScene').onSceneReady;
    await h.setStage({ roomVisible: false });
    assert.equal(h.props('NativeRoomScene').onObjectPosition, position);
    assert.equal(h.props('NativeRoomScene').onSceneReady, painted);
    await h.update(() => position('ball', { x: 40, y: 50 }, [1, .1, 1], true));
    assert.equal(saves.length, 0, 'A callback queued before hiding must not save hidden-room physics');
    await h.setStage({ roomVisible: true, roomToolbar: { decorating: true, onDecoratingChange() {} } });
    await h.update(() => position('ball', { x: 40, y: 50 }, [1, .1, 1], true));
    assert.equal(saves.length, 0, 'Decoration must suppress delayed physics saves');
    await h.setStage({ roomToolbar: { decorating: false, onDecoratingChange() {} } });
    await h.update(() => { position('ball', { x: 40, y: 50 }, [1, .1, 1], true); painted(); });
    assert.equal(saves.length, 1, 'The same callback resumes saving when the room is visible');
    assert.equal(ready.length, 1, 'The retained callback still reports scene readiness');
  } finally { await h.close(); }
});

test(`shadow models stay mounted across visibility changes and resume live previews (${mode})`, async () => {
  const h = await harness('contact-shadows', compiled);
  try {
    const world = h.load('@/utils/native-room-world').buildNativeRoomWorld({ width: 390, height: 420, petSize: 100, sizeScale: 1,
      decorations: [{ decorationId: 'sofaA', instanceId: 'sofa', offset: { x: 0, y: 0 } }], toys: [] });
    const editingObject = { value: undefined };
    await h.setStage({ world, editingObject });
    const modelHooks = h.count('modelHooks'), frame = [...h.drawFrames.values()][0];
    frame(); const writes = h.calls.filter(c => c[0] === 'shadowPose').length;
    await h.setStage({ active: false });
    assert.equal(h.count('modelHooks'), modelHooks);
    assert.equal([...h.drawFrames.values()][0], frame);
    editingObject.value = { ...world.objects[0], position: [1, .1, 1] }; frame();
    assert.equal(h.calls.filter(c => c[0] === 'shadowPose').length, writes);
    await h.setStage({ active: true }); frame();
    assert.equal(h.count('modelHooks'), modelHooks);
    assert.equal(h.calls.filter(c => c[0] === 'shadowPose').length, writes + 1, 'Resume applies the latest preview without a model render');
    assert.equal(h.calls.filter(c => c[0] === 'removeShadow').length, 0);
    const moved = { ...world.objects[0], heading: .7 };
    await h.setStage({ world: { ...world, objects: [moved] } });
    assert.ok(h.count('modelHooks') > modelHooks, 'Saved geometry changes still reach the shadow');
    editingObject.value = undefined; [...h.drawFrames.values()][0]();
    assert.equal(h.calls.filter(c => c[0] === 'shadowPose').at(-1)[1].heading, .7);
    await h.setStage({ world: { ...world, objects: [] } });
    assert.equal(h.calls.filter(c => c[0] === 'removeShadow').length, 1, 'Removing furniture detaches its shadow');
  } finally { await h.close(); }
});

test(`lamp lights retain native hooks and callbacks across navigation (${mode})`, async () => {
  const h = await harness('lamp-light', compiled);
  try {
    for (const decorationId of ['lampFloorArc', 'bathroomLightStrip']) {
      const world = h.load('@/utils/native-room-world').buildNativeRoomWorld({ width: 390, height: 420, petSize: 100, sizeScale: 1,
        decorations: [{ decorationId, instanceId: 'lamp', offset: { x: 0, y: 0 }, poweredOn: true }], toys: [] });
      const object = world.objects[0], editingObject = { value: undefined };
      await h.setStage({ object, editingObject, active: true });
      const hooks = h.count('lightHooks'), frames = [...h.drawFrames.values()];
      frames.forEach(fn => fn()); const writes = h.calls.filter(c => c[0] === 'lightPosition').length;
      await h.setStage({ active: false });
      assert.equal(h.count('lightHooks'), hooks, 'Including segmented bathroom lights');
      assert.deepEqual([...h.drawFrames.values()], frames);
      editingObject.value = { ...object, position: object.position.map((v, i) => v + (i === 0 ? .1 : 0)) };
      frames.forEach(fn => fn()); assert.equal(h.calls.filter(c => c[0] === 'lightPosition').length, writes);
      await h.setStage({ active: true }); frames.forEach(fn => fn());
      assert.equal(h.count('lightHooks'), hooks);
      assert.equal(h.calls.filter(c => c[0] === 'lightPosition').length, writes + frames.length);
      await h.setStage({ object: { ...object, poweredOn: false } });
      assert.equal(h.drawFrames.size, 0, 'Power-off still removes every light callback');
    }
  } finally { await h.close(); }
});

test(`native position reports preserve furniture menus and duplicate reports preserve targets (${mode})`, async () => {
  const h = await harness('stage', compiled);
  try {
    const positions = [], saved = [];
    await h.setRoomActivity({ updateObjectPosition: (...args) => positions.push(args) });
    await h.setStage({ onFeed() {}, onTogglePlacedDecorationPower() {},
      onPlacedToyOffsetChange: (...args) => saved.push(args),
      placedToys: [{ toyId: 'orangeBall', instanceId: 'ball', offset: { x: .5, y: .4 } }],
      placedDecorations: [{ decorationId: 'bowlBlue', instanceId: 'bowl', offset: { x: 0, y: 0 } },
        { decorationId: 'lampFloorArc', instanceId: 'lamp', offset: { x: -.3, y: 0 } }] });
    await h.update(() => h.props('AnimatedView:onLayout')({ nativeEvent: { layout: { width: 390, height: 420 } } }));
    const ballMenu = h.props('room-object:ball').menuActions, bowlMenu = h.props('room-object:bowl').menuActions;
    const update = h.props('NativeRoomScene').onObjectPosition;
    const point = { x: 40, y: 50 }, center = [1, .1, 1];
    await h.update(() => update('ball', point, center));
    assert.equal(h.props('room-object:ball').externalPosition, point, 'Physics still updates the moved target');
    assert.equal(h.props('room-object:ball').menuActions, ballMenu);
    assert.equal(h.props('room-object:bowl').menuActions, bowlMenu, 'Physics reports must not rebuild unrelated menus');
    const targetCount = h.count('room-object:ball');
    for (let i = 0; i < 3; i++) await h.update(() => update('ball', { ...point }, center));
    assert.equal(h.count('room-object:ball'), targetCount, 'Duplicate coordinates do not update hit targets');
    await h.update(() => update('ball', { ...point }, center, true));
    assert.equal(positions.length, 5, 'Duplicate screen points still update physical navigation positions');
    assert.equal(saved.length, 1, 'A settled report still saves the toy even if its screen point is unchanged');
    await h.setGame({ pet: { ...h.game.pet, stats: { ...h.game.pet.stats, hunger: 100 } } });
    assert.notEqual(h.props('room-object:bowl').menuActions, bowlMenu, 'Availability changes still refresh menus');
    assert.equal(h.props('room-object:bowl').menuActions.find(action => action.label === 'home.catCommands.bowlEat').disabled, true);
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

test(`period activation reads current time without replaying room renders (${mode})`, async () => {
  const h = await harness('period-hook', compiled);
  try {
    await h.setGame({ worldClock: { worldMs: 21 * 3600000 - 60000, realMs: h.now, speed: 60 } });
    assert.equal(h.props('clockReading'), 'evening');
    let count = h.count('clockRenders');
    await h.setStage({ enabled: false });
    assert.equal(h.count('clockRenders'), count + 1, 'Hiding the room should not replay its render');
    assert.equal(h.timerCount, 0);
    await h.advance(5000);
    count = h.count('clockRenders');
    await h.setStage({ enabled: true });
    assert.equal(h.count('clockRenders'), count + 1);
    assert.equal(h.props('clockReading'), 'night', 'First resumed render already sees the boundary');
    count = h.count('clockRenders');
    await h.flushFrames(); await h.advance(5000);
    assert.equal(h.count('clockRenders'), count, 'Same-period activation and polls do no extra work');
    await h.setActive(false); await h.advance(12 * 60000); await h.setActive(true);
    assert.equal(h.props('clockReading'), 'morning', 'Repeated activation must not reuse an earlier night sample');
    count = h.count('clockRenders');
    await h.setGame({ worldClock: { worldMs: 12 * 3600000, realMs: h.now, speed: 300 } });
    assert.equal(h.count('clockRenders'), count + 1);
    assert.equal(h.props('clockReading'), 'day');
    await h.setGame({ worldClock: undefined });
    assert.equal(h.props('clockReading'), undefined); assert.equal(h.timerCount, 0);
  } finally { await h.close(); }
});

test(`lighting clock caches render snapshots and refreshes on activation (${mode})`, async () => {
  const h = await harness('clock-hook', compiled);
  try {
    assert.equal(h.props('clockReading'), h.now);
    assert.equal(h.frameCount, 0, 'Clock sampling does not schedule animation-frame work');
    const initial = h.props('clockReading');
    await h.tick();
    assert.equal(h.props('clockReading'), initial, 'Unrelated renders read the cached snapshot without sampling time');
    await h.advance(5000); assert.equal(h.props('clockReading'), h.now);
    for (let i = 0; i < 3; i++) {
      let count = h.count('clockRenders');
      await h.setStage({ enabled: false });
      assert.equal(h.count('clockRenders'), count + 1);
      assert.equal(h.timerCount, 0);
      const paused = h.props('clockReading');
      await h.advance(15000); assert.equal(h.props('clockReading'), paused);
      count = h.count('clockRenders');
      await h.setStage({ enabled: true });
      assert.equal(h.count('clockRenders'), count + 2, 'Activation commits then catches up once through the subscription');
      assert.equal(h.props('clockReading'), h.now, 'Every activation catches up without waiting for a timer');
      assert.equal(h.frameCount, 0); await h.flushFrames();
      assert.equal(h.count('clockRenders'), count + 2);
      count = h.count('clockRenders');
      await h.advance(0);
      assert.equal(h.count('clockRenders'), count, 'An unchanged timestamp does not rerender subscribers');
    }
    await h.setActive(false); await h.advance(20000); await h.setActive(true);
    assert.equal(h.props('clockReading'), h.now);
    await h.setStage({ intervalMs: 1000 }); assert.equal(h.timerCount, 1);
    await h.advance(1000); assert.equal(h.props('clockReading'), h.now);
  } finally { await h.close(); }
  assert.equal(h.timerCount, 0, 'Unmount cleans up the remaining poll');
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

test(`hidden Store skips room changes and catches up on focus without hiding account resets (${mode})`, async () => {
  const h = await harness('store', compiled);
  try {
    await h.setActive(false);
    const rows = h.count('DecorationStoreCard'), lists = h.count('FlatList');
    const { switchHomeRoom } = h.load('@/utils/home-rooms');
    for (const room of ['kitchen', 'bathroom', 'bedroom', 'livingRoom']) {
      await h.setGame({ pet: switchHomeRoom(h.game.pet, room) });
    }
    await h.setGame({ wallet: { coins: 0 }, pet: { ...h.game.pet, homeRoomId: 'kitchen' } });
    assert.equal(h.count('DecorationStoreCard'), rows, 'Hidden Store rows must skip navigation and wallet updates');
    assert.equal(h.count('FlatList'), lists);
    await h.setActive(true);
    assert.equal(h.props('StoreTabBar').active, 'kitchen', 'Reopening Store selects the latest room');
    assert.equal(h.props('DecorationStoreCard').canAfford, false, 'Latest wallet is visible immediately');
    await h.setGame({ wallet: { coins: 100000 } });
    assert.equal(h.props('DecorationStoreCard').canAfford, true, 'Visible Store remains live');
    await h.setActive(false);
    await h.setGame({ isReady: false });
    assert.ok(h.count('ActivityIndicator') > 0);
    await h.setGame({ isReady: true, hasCompletedOnboarding: false });
    assert.equal(h.props('Redirect').href, '/onboarding/name-pet');
  } finally { await h.close(); }
});

test(`Puzzles skips furniture navigation updates but refreshes learning progress and readiness (${mode})`, async () => {
  const h = await harness('puzzles', compiled);
  try {
    const before = h.count('recommendation'), picker = h.count('DifficultyPicker');
    assert.ok(before > 0);
    const { switchHomeRoom } = h.load('@/utils/home-rooms');
    for (const room of ['kitchen', 'bathroom', 'livingRoom']) await h.setGame({ pet: switchHomeRoom(h.game.pet, room) });
    await h.setGame({ pet: { ...h.game.pet, roomBedOffset: { x: .2, y: .1 } } });
    assert.equal(h.count('recommendation'), before, 'Room updates must not recompute the learning path');
    assert.equal(h.count('DifficultyPicker'), picker);
    await h.setGame({ progress: { ...h.game.progress, completedPuzzleIds: [...h.game.progress.completedPuzzleIds, 'new-result'] } });
    assert.ok(h.count('recommendation') > before, 'New progress still refreshes recommendations');
    await h.setGame({ isReady: false });
    assert.ok(h.count('ActivityIndicator') > 0);
    await h.setGame({ isReady: true, hasCompletedOnboarding: false });
    assert.equal(h.props('Redirect').href, '/onboarding/name-pet');
  } finally { await h.close(); }
});

test(`static room colliders survive navigation and refresh geometry, removals and physics worlds (${mode})`, async () => {
  const h = await harness('colliders', compiled);
  try {
    const object = { instanceId: 'furniture', collisionBoxes: [{ min: [0, 0, 0], max: [2, 4, 6] }] };
    await h.setStage({ objects: [object] });
    const before = h.count('rigidBody'), changes = h.calls.length;
    for (const roomVisible of [false, true, false, true]) await h.setStage({ roomVisible });
    assert.equal(h.count('rigidBody'), before, 'Unchanged collision geometry must skip room visibility renders');
    assert.equal(h.calls.length, changes, 'Browsing must not detach collision bodies');
    const body = h.props('body:furniture:part:0');
    assert.deepEqual(Array.from(body.shape), [1, 2, 3]);
    assert.deepEqual(Array.from(body.origin), [1, 2, 3]);
    assert.equal(body.mass, 0); assert.equal(body.friction, .7);
    assert.deepEqual(Array.from(h.props('body:wall-x-1').origin), [-2.45, 1.5, 0]);
    const next = { ...object, collisionBoxes: [{ min: [2, 0, 0], max: [6, 2, 4] }] };
    await h.setStage({ objects: [next] });
    assert.deepEqual(Array.from(h.props('body:furniture:part:0').shape), [2, 1, 2]);
    assert.deepEqual(Array.from(h.props('body:furniture:part:0').origin), [4, 1, 2]);
    const world = {};
    await h.setStage({ world });
    assert.equal(h.props('body:furniture:part:0').world, world);
    const removed = h.calls.length;
    await h.setStage({ objects: [] });
    assert.deepEqual(h.calls.slice(removed), [['removeBody', 'furniture:part:0', world]], 'Removing furniture removes its collision body');
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
