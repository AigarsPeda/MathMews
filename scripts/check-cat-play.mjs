/** Exercise the actual Home handlers and display engine without spending saved coins. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd(), cache = new Map();
let states = [], stateIndex = 0, game, display, clockOffset = 0, captureEffects = false, effects = [];
const timers = new Map(); let timerId = 0;
const routes = []; let focusCleanups = [];
class TestDate extends Date { static now() { return Date.now() + clockOffset; } }
const react = {
  useState: initial => {
    const i = stateIndex++;
    if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
    return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }];
  },
  useRef: current => {
    const i = stateIndex++;
    if (!(i in states)) states[i] = { current };
    return states[i];
  }, useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => { if (captureEffects) effects.push(fn); },
};
const mocks = {
  react,
  'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
  'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', Platform: { OS: 'web' }, StyleSheet: { create: s => s } },
  'react-i18next': { useTranslation: () => ({ t: key => key }) },
  'expo-haptics': {}, 'expo-router': {
    useRouter: () => ({ push: route => routes.push(route) }),
    useFocusEffect: fn => { focusCleanups.push(fn()); },
  },
  '@/contexts/GameProvider': { useGame: () => game },
  '@/contexts/LocaleProvider': { useLocale: () => ({ locale: 'en' }) },
  '@/hooks/use-screen-insets': { useScreenInsets: () => ({}) },
  '@/hooks/use-room-transition': { useRoomTransition: (_, visit) => ({ transition: null, visit, ready() {} }) },
  '@/utils/scale': { moderateScale: n => n },
  '@/pet-display/hooks/use-pet-display': { usePetDisplay: () => display },
  '@/pet-display/engine/derive-mood': { usePetBaseMood: () => ({ mood: display.baseMood, onFallAsleepComplete: () => {}, onLieDownComplete: () => {} }) },
  '@/constants/puzzles': { computePetWisdom: () => 0, hasIncompletePuzzles: () => false },
};
for (const [file, name] of [
  ['components/ui/AppIcon', 'AppIcon'], ['components/ui/IconText', 'IconText'],
  ['components/economy/GameHeaderStats', 'GameHeaderStats'], ['components/home/HeaderChip', 'HeaderChip'],
  ['components/pet/PetStage', 'PetStage'],
  ['components/pet/WorldClockControl', 'WorldClockControl'],
]) mocks[`@/${file}`] = { [name]: name };

function load(file) {
  const absolute = path.resolve(root, file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} }; cache.set(absolute, module);
  if (absolute.endsWith('.json')) { module.exports = JSON.parse(fs.readFileSync(absolute, 'utf8')); return module.exports; }
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, Date: TestDate, Math, Map, Set,
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, at: TestDate.now() + ms }); return id; }, clearTimeout: id => timers.delete(id),
    require: id => {
      if (id in mocks) return mocks[id];
      const resolved = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(path.dirname(absolute), id);
      if (/\.(png|webp|mp4)$/.test(resolved)) { assert.ok(fs.existsSync(resolved), resolved); return resolved; }
      assert.ok(id.startsWith('@/') || id.startsWith('.'), `Unexpected dependency ${id}`);
      return load(fs.existsSync(resolved) ? resolved : fs.existsSync(resolved + '.ts') ? resolved + '.ts' : resolved + '.tsx');
    },
  }, { filename: absolute });
  return module.exports;
}
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node?.props ? [node, ...nodes(node.props.children)] : [];
}
const { CAT_PLAY_ACTIVITIES: activities } = load('constants/cat-play.ts');
const Home = load('app/index.tsx').default;
function home({ coins = 100, happiness = 100, asleep = false, busy = false } = {}) {
  states = []; stateIndex = 0;
  focusCleanups = [];
  routes.length = 0;
  const now = Date.now(), commands = [], debits = [];
  game = {
    isReady: true, hasCompletedOnboarding: true,
    pet: { name: 'Test cat', type: 'cat', catSkinId: 'orange', isAsleep: asleep, lastCareAt: now, lastInteractionAt: now,
      stats: { hunger: 100, happiness, cleanliness: 100, level: 1 }, placedToys: [], placedDecorations: [] },
    wallet: { coins }, progress: { puzzlesSolved: {}, puzzleStreak: 0, streak: 0, lives: 5 },
    setPet: update => { game.pet = update(game.pet); },
    setWallet: update => { game.wallet = update(game.wallet); debits.push(game.wallet.coins); },
    recordInteraction: () => {},
  };
  display = { playback: { kind: 'segment', mood: 'idle' }, baseMood: 'idle', isCareBlocked: busy, isCareAnimationPlaying: busy, send: command => commands.push(command) };
  const tree = nodes(Home());
  assert.equal(tree.some(node => node.type === 'ActivitiesMenuButton'), false, 'The footer activity control is removed');
  assert.equal(tree.some(node => node.props.accessibilityLabel === 'home.a11yFeed'), false, 'The footer feed control is removed');
  return { menu: { disabled: busy, onSelect: tree.find(node => node.type === 'PetStage' && node.props.roomVisible).props.onPlay }, commands, debits,
    stage: tree.find(node => node.type === 'PetStage' && node.props.roomVisible).props,
    store: tree.find(node => node.type === 'PetStage' && node.props.roomVisible).props.onOpenStore,
    feed: tree.find(node => node.type === 'PetStage' && node.props.roomVisible).props.onFeed };
}

{
  const test = home(); let returns = 0;
  const report = test.stage.onRoomActivityChange;
  const returnHome = () => returns++;
  report(true, returnHome); test.store();
  assert.equal(returns, 0, 'The shop does not wait for an active cat to walk home');
  assert.deepEqual(routes, ['/store'], 'An active cat does not delay navigation');
  report(true, returnHome); report(false, returnHome);
  assert.equal(routes.length, 1, 'Later activity completion cannot open the shop again');
  const immediate = home(); immediate.store(); assert.deepEqual(routes, ['/store']);
}
console.log('Verified immediate shop navigation while the cat is active and no delayed duplicate navigation.');
for (const activity of activities) {
  for (const happiness of [40, 100]) for (const coins of [0, 100]) {
    const test = home({ happiness, coins });
    assert.equal(test.menu.disabled, false, 'Full happiness must leave Play available');
    test.menu.onSelect(activity);
    assert.equal(game.wallet.coins, coins, 'All play must leave coins unchanged');
    assert.ok(Math.abs(game.pet.stats.happiness - Math.min(100, happiness + activity.happinessBoost)) < .001, "Tiny elapsed care decay preserves the play boost");
    assert.equal(test.commands.at(-1).mood, activity.mood);
    const commandCount = test.commands.length;
    test.menu.onSelect(activity);
    assert.equal(test.commands.length, commandCount, 'Reject duplicate actions before render');
    assert.equal(test.debits.length, 0, 'Playing and duplicate actions must never charge coins');
  }
  {
    const test = home({ busy: true }); test.menu.onSelect(activity);
    assert.equal(test.debits.length, 0, 'Reject overlapping play without changing coins');
    assert.equal(test.commands.length, 0);
  }
  const asleep = home({ asleep: true, coins: 0 }); asleep.menu.onSelect(activity);
  assert.equal(asleep.commands.at(-1).wasAsleep, true, 'Playing must wake a sleeping cat');
  assert.equal(game.wallet.coins, 0, 'Waking to play must also be free');
}

const { usePetDisplayEngine: renderDisplayEngine } = load('pet-display/engine/use-pet-display-engine.ts');
const { getPetMediaRegistry } = load('pet-display/registry/media-registry.ts');
function engine(pet) { stateIndex = 0; effects = []; captureEffects = true; const result = renderDisplayEngine(pet); captureEffects = false; effects.forEach(fn => fn()); return result; }
for (const skin of ['orange', 'grey', 'white']) for (const activity of activities) for (const baseMood of ['idle', 'resting', 'sleeping']) {
  states = []; timers.clear(); display.baseMood = baseMood;
  const pet = { ...game.pet, catSkinId: skin }, registry = getPetMediaRegistry('cat');
  let current = engine(pet);
  current.send({ type: 'beginCareAction' });
  current.send({ type: 'playAction', wasAsleep: baseMood === 'sleeping', mood: activity.mood });
  current = engine(pet);
  if (baseMood !== 'idle') {
    assert.equal(current.playback.scenario.id, baseMood === 'sleeping' ? 'wakeUp' : 'standUp');
    current.send({ type: 'animationComplete', completedMood: baseMood }); current = engine(pet);
  }
  assert.equal(current.isCareAnimationPlaying, true);
  if (activity.id === 'box') assert.deepEqual(Array.from(current.playback.steps, step => step.assetKey), ['box1', 'box2', 'box3']);
  else {
    assert.equal(current.playback.mood, activity.mood);
    assert.equal(current.playback.segment.loop, false);
    assert.equal(registry.mediaKind, "model");
    assert.ok(current.playback.segment.model.duration > 0);
    assert.equal(current.playback.segment.model.rate, 1);
    assert.ok(registry.oneShotStates.includes(activity.mood));
  }
  current.send({ type: 'animationComplete', completedMood: activity.mood }); current = engine(pet);
  assert.equal(current.isCareAnimationPlaying, false, 'Play must release busy state');
  assert.equal(current.isCareBlocked, true, 'Completed play retains the existing cooldown');
  assert.equal(current.playback.kind, 'segment');
  clockOffset = 4_101; for (const [id, timer] of timers) if (timer.at <= TestDate.now()) { timers.delete(id); timer.fn(); } current = engine(pet);
  assert.equal(current.isCareBlocked, false, 'Busy state must clear after the cooldown');
  clockOffset = 0;
}
console.log('Verified free play with zero coins and full happiness, unchanged wallets, capped boosts, duplicate protection, wake/stand/play/recovery and all three coats.');

// Preload every native scene and retain its icon controls while browsing.
home();
const { switchHomeRoom, getCatHomeRoomId, sendCatToRoom } = load('utils/home-rooms.ts');
game.visitHomeRoom = destination => { game.pet = switchHomeRoom(game.pet, destination); };
game.sendCatToRoom = destination => { game.pet = sendCatToRoom(game.pet, destination); };
function renderHome() { stateIndex = 0; return nodes(Home()); }
const visibleStage = tree => tree.find(node => node.type === 'PetStage' && node.props.roomVisible);
let house = renderHome();
assert.equal(house.filter(node => node.type === 'PetStage').length, 4, 'All rooms mount before the first navigation');
assert.deepEqual(house.filter(node => node.type === 'PetStage').map(node => node.props.homeRoomId ?? 'livingRoom'),
  ['bedroom', 'livingRoom', 'kitchen', 'bathroom']);
for (const destination of ['kitchen', 'bathroom', 'kitchen', 'livingRoom', 'bedroom', 'livingRoom']) {
  visibleStage(house).props.onVisitHomeRoom(destination);
  house = renderHome();
  const stages = house.filter(node => node.type === 'PetStage');
  assert.equal(visibleStage(house).props.homeRoomId, destination);
  assert.equal(getCatHomeRoomId(game.pet), 'livingRoom', 'Arrow navigation does not carry the cat');
  assert.equal(new Set(stages.map(node => node.props.homeRoomId)).size, stages.length, 'Each room has only one native scene host');
  assert.equal(stages.length, 4, 'First visits reuse the four preloaded scene hosts');
}
assert.equal(house.filter(node => node.type === 'PetStage').length, 4, 'Returning to a room keeps the other visited scenes mounted');
assert.equal(house.filter(node => node.type === 'HeaderChip').length, 1, 'Room browsing retains the settings control without a separate shop button');
assert.ok(!house.some(node => node.props.accessibilityLabel === 'home.a11yStore'), 'Shopping uses the combined room control');
visibleStage(house).props.onSendCatToRoom('bedroom'); house = renderHome();
assert.equal(visibleStage(house).props.homeRoomId, 'bedroom');
assert.equal(getCatHomeRoomId(game.pet), 'bedroom');
assert.equal(visibleStage(house).props.roomEntry.direction, -1);
visibleStage(house).props.onSendCatToRoom('livingRoom'); house = renderHome();
assert.equal(visibleStage(house).props.roomEntry.direction, 1);
console.log('Verified retained scene hosts, preloading of all four rooms, stable header controls, independent browsing and explicit travel with opposite-side entries.');
