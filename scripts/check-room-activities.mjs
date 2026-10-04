/** Exercise the room planner and idle scheduler without native rendering. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const root = process.cwd();
const cache = new Map();
const mocks = {};
let now = 0, timerId = 0;
const timers = new Map();
const setTimeoutMock = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, at: now + delay }); return id; };
function advance(ms) {
  const until = now + ms;
  for (;;) {
    const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
    if (!next || next[1].at > until) break;
    now = next[1].at; timers.delete(next[0]); next[1].fn();
  }
  now = until;
}
function load(id) {
  if (id in mocks) return mocks[id];
  const file = id.startsWith('@/') ? path.join(root, id.slice(2)) : id;
  if (/\.(png|webp|mp4)$/.test(file)) return 1;
  const resolved = fs.existsSync(file) ? file : ['.ts', '.tsx', '.json'].map(ext => file + ext).find(fs.existsSync);
  assert.ok(resolved, id);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} }; cache.set(resolved, module);
  const source = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: load, setTimeout: setTimeoutMock, clearTimeout: id => timers.delete(id) });
  return module.exports;
}
const { buildRoomActivity, buildRoomReturn, routeToSofa, roomOffsetToPoint, ROOM_IDLE_DELAY_MS } = load('@/utils/room-activities');
const { getCatWalkMotion, getCatJumpMotion, isCatWalk } = load('@/constants/cat-room-motion');
for (const [x, y, animation, facing] of [[60, 0, 'walk', 1], [-60, 0, 'walk', -1], [0, -60, 'walkAway', 1],
  [0, 60, 'walkToward', 1], [60, -16.8, 'walkAwayDiagonal', 1], [-60, 16.8, 'walkTowardDiagonal', -1]]) {
  const motion = getCatWalkMotion({ x: 0, y: 0 }, { x, y }, 120);
  assert.equal(motion.animation, animation); assert.equal(motion.facing, facing);
  assert.ok(Math.abs(motion.cycles / (motion.durationMs / 1000) - 1.5) < .001, 'Floor travel must match the 1.5-cycle walking cadence');
  const largerMotion = getCatWalkMotion({ x: 0, y: 0 }, { x, y }, 240);
  assert.ok(largerMotion.durationMs < motion.durationMs, 'A larger cat covers more floor with each stride');
}
const room = { width: 320, height: 320, petSize: 120, sizeScale: 1,
  homeOffset: { x: -.3, y: .3 }, decorations: [], toys: [], ownedToyIds: [], hungry: false, asleep: false };
assert.equal(buildRoomActivity(room, 0), null);
assert.equal(buildRoomActivity({ ...room, width: 0 }, 0), null);
const sofa = { decorationId: 'sofaA', instanceId: 'sofa', offset: { x: .4, y: -.2 } };
const furnished = { ...room, decorations: [sofa] };
const serialized = JSON.stringify(furnished);
const sit = buildRoomActivity(furnished, 0);
const sleep = buildRoomActivity(furnished, 1);
assert.equal(sit.kind, 'sofaSit');
assert.equal(sleep.kind, 'sofaSleep');
assert.ok(sleep.steps.some(step => step.mood === 'sleeping'));
assert.equal(sit.targetInstanceId, 'sofa');
assert.equal(JSON.stringify(sit.steps.at(-1).position), JSON.stringify(roomOffsetToPoint(room.homeOffset, 320, 320, 120)));
const flipped = buildRoomActivity({ ...furnished, decorations: [{ ...sofa, wallFlipped: true }] }, 0);
assert.ok(flipped.steps[1].position.x > sit.steps[1].position.x, 'Mirrored sofas must use the opposite seat');
const rotated = buildRoomActivity({ ...furnished, decorations: [{ ...sofa, rotationIndex: 1 }] }, 0);
assert.equal(rotated.steps[1].position.x, flipped.steps[1].position.x);
const larger = buildRoomActivity({ ...furnished, decorations: [{ ...sofa, scale: 2 }] }, 0);
assert.ok(larger.steps[1].scale > sit.steps[1].scale);
assert.equal(buildRoomActivity({ ...furnished, asleep: true }, 0).kind, 'sofaSleep');
const ball = { toyId: 'blueBall', instanceId: 'ball', offset: { x: .3, y: .4 } };
const play = buildRoomActivity({ ...room, toys: [ball] }, 0);
assert.equal(play.kind, 'toyPlay');
assert.equal(play.steps[1].mood, 'playBall');
assert.equal(buildRoomActivity({ ...room, ownedToyIds: ['blueBall'] }, 0), null, 'Balls must be placed');
assert.equal(buildRoomActivity({ ...room, toys: [ball], hungry: true }, 0), null);
assert.equal(buildRoomActivity({ ...room, toys: [ball], asleep: true }, 0), null);
const ownedMouse = { ...room, ownedToyIds: ['mouse'] };
const chase = buildRoomActivity(ownedMouse, 0);
assert.equal(chase.kind, 'mouseChase');
assert.equal(chase.targetInstanceId, undefined, 'Owned mice can appear temporarily');
const mouse = { toyId: 'mouse', instanceId: 'mouse', offset: { x: -.4, y: .4 } };
const placedChase = buildRoomActivity({ ...ownedMouse, toys: [mouse] }, 0);
assert.equal(placedChase.targetInstanceId, 'mouse');
assert.equal(JSON.stringify(placedChase.objectStart), JSON.stringify(placedChase.steps.at(-1).objectPosition));
for (const plan of [sit, sleep, flipped, larger, play, chase, placedChase]) {
  for (const step of plan.steps) {
    assert.ok(Math.abs(step.position.x) <= 100 && Math.abs(step.position.y) <= 100, 'Cat stays inside room bounds');
    assert.ok(step.durationMs > 0);
  }
}
assert.equal(JSON.stringify(furnished), serialized, 'Ambient plans must not mutate saved placements');

// React hooks with dependency-aware effects and fake time.
const slots = []; let index = 0, effects = [], visibility = { active: true, reduceMotion: false };
const shared = initial => { let value = initial; return { get: () => value, set: next => { value = next; } }; };
const slot = initial => { const i = index++; if (!(i in slots)) slots[i] = initial(); return [i, slots[i]]; };
mocks.react = {
  useCallback: fn => fn,
  useRef: initial => slot(() => ({ current: initial }))[1],
  useState: initial => { const [i, value] = slot(() => initial); return [value, next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
  useEffect: (fn, deps) => {
    const [i, old] = slot(() => null);
    if (!old || deps.some((dep, i) => dep !== old.deps[i])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
  },
};
mocks['@/pet-display/media/sprite/use-sprite-clock'] = { useSpriteActivity: () => visibility };
mocks['react-native-reanimated'] = {
  useSharedValue: initial => slot(() => shared(initial))[1], cancelAnimation() {},
  withDelay: (_, value) => value, withTiming: value => value, withRepeat: value => value, withSequence: (...values) => values.at(-1),
  Easing: { linear: x => x, quad: x => x, inOut: fn => fn, in: fn => fn, out: fn => fn },
};
const { useRoomActivity } = load('@/hooks/use-room-activity');
const petX = shared(0), petY = shared(0);
let interaction = 1, enabled = true, hookRoom = ownedMouse;
function render() {
  index = 0; effects = [];
  const result = useRoomActivity(hookRoom, enabled, interaction, petX, petY);
  effects.forEach(fn => fn()); return result;
}
assert.equal(render().activity, null);
advance(ROOM_IDLE_DELAY_MS - 1); assert.equal(render().activity, null);
advance(1); assert.equal(render().activity.plan.kind, 'mouseChase');
const firstWalk = render().activity.plan.steps[0];
assert.ok(isCatWalk(firstWalk.animation));
assert.ok(firstWalk.animationFps > 35 && firstWalk.animationFps <= 36, 'Playback cadence must match floor travel');
advance(firstWalk.durationMs); assert.equal(render().activity.stepIndex, 1);
const beforeReturn = petX.get();
interaction++; render(); render();
assert.equal(render().activity.plan.kind, 'mouseChase', 'Interruption must keep the current pose until the return starts');
assert.equal(petX.get(), beforeReturn, 'Touching must not snap position back to the saved spot');
advance(0);
const returning = render().activity;
assert.equal(returning.plan.kind, 'returnHome');
assert.ok(isCatWalk(returning.plan.steps[0].animation));
advance(returning.plan.steps[0].durationMs);
assert.equal(render().activity, null);
assert.equal(petX.get(), -30); assert.equal(petY.get(), 30);
assert.equal(timers.size, 1, 'Return completion must schedule the next idle choice');
enabled = false; render(); advance(60_000); assert.equal(render().activity, null, 'Care and decorating block ambient motion');
assert.equal(timers.size, 0);
enabled = true; visibility = { active: false, reduceMotion: false }; render(); advance(60_000); assert.equal(render().activity, null);
visibility = { active: true, reduceMotion: true }; render(); advance(60_000); assert.equal(render().activity, null);
visibility = { active: true, reduceMotion: false }; render(); advance(ROOM_IDLE_DELAY_MS); assert.equal(render().activity.plan.kind, 'mouseChase');
const total = render().activity.plan.steps.reduce((sum, step) => sum + step.durationMs, 0);
advance(total); assert.equal(render().activity, null, 'Completed activity returns to the saved placement');
assert.equal(petX.get(), -30); assert.equal(petY.get(), 30);
console.log('Verified sofas, mirrored/scaled seating, toy eligibility, mouse chases, idle timing, interruption, care/edit blocking, background pause, Reduce Motion, and saved placement preservation.');

const sofaCommand = buildRoomActivity(furnished, 0, 'sofaSleep');
assert.equal(sofaCommand.kind, 'sofaSleep');
assert.equal(sofaCommand.steps[0].animation, 'walk');
assert.equal(sofaCommand.steps[2].animation, 'curlUp');
assert.equal(sofaCommand.steps[3].animation, 'curlSleep');
assert.equal(sofaCommand.steps[3].hold, true, 'Commanded rest lasts until interaction');
const wake = buildRoomReturn(furnished, sofaCommand, 3, sofaCommand.steps[3].position);
assert.equal(wake.steps[0].animation, 'curlUp');
assert.equal(wake.steps[0].reverse, true);
assert.equal(wake.steps[1].position, sofaCommand.sofaApproach);
assert.equal(wake.steps[1].animation, 'jumpOff');
assert.ok(!wake.steps[1].reverse, 'Jumping down has its own takeoff and landing, rather than reversed jump-up frames');
assert.equal(wake.steps[2].animation, 'walk');
assert.ok(wake.steps[2].durationMs >= 800);
assert.ok(isCatWalk(wake.steps[2].animation), 'Floor travel after landing must use footsteps');
assert.equal(buildRoomActivity(room, 0, 'sofaSleep'), null, 'Sofa commands require a placed sofa');
assert.equal(buildRoomActivity(room, 0, 'mouseChase'), null, 'Mouse commands require ownership or a placed mouse');
const yarn = { decorationId: 'yarnRed', instanceId: 'yarn', offset: { x: .2, y: .5 } };
const yarnPlay = buildRoomActivity({ ...room, decorations: [yarn] }, 0, 'toyPlay');
assert.equal(yarnPlay.objectKind, 'decoration');
assert.equal(yarnPlay.targetInstanceId, 'yarn');
assert.equal(yarnPlay.steps[1].mood, 'playYarn');
assert.equal(yarnPlay.steps[1].animation, 'batToy', 'Placed props must use a cat clip without a second embedded toy');
assert.ok(yarnPlay.steps[1].objectPosition.x !== yarnPlay.objectStart.x);
assert.ok(play.steps[1].objectRotation !== 0, 'A struck ball must roll');
assert.equal(play.steps.at(-1).objectPosition, play.objectStart, 'Play preserves the placed object location');
console.log('Verified walking returns, getting up before jumping down, held sofa commands, object reactions, yarn eligibility, and no embedded duplicate props.');

hookRoom = furnished; render();
render().startActivity('sofaSleep'); render(); advance(0);
assert.equal(render().activity.plan.kind, 'sofaSleep', 'Commands start without waiting for idle time');
const commanded = render().activity.plan;
advance(commanded.steps.slice(0, 3).reduce((sum, step) => sum + step.durationMs, 0));
assert.equal(render().activity.plan.steps[render().activity.stepIndex].animation, 'curlSleep');
advance(60_000);
assert.equal(render().activity.plan.kind, 'sofaSleep', 'A commanded nap stays on the sofa');
const seatX = petX.get(), seatY = petY.get();
render().returnHome(); render();
assert.equal(petX.get(), seatX); assert.equal(petY.get(), seatY);
advance(0);
const commandedReturn = render().activity.plan;
assert.equal(commandedReturn.kind, 'returnHome');
assert.equal(commandedReturn.steps[0].reverse, true);
assert.equal(petX.get(), seatX, 'Getting up must finish at the sofa before travel starts');
assert.equal(petY.get(), seatY);
advance(commandedReturn.steps.reduce((sum, step) => sum + step.durationMs, 0));
assert.equal(render().activity, null);
assert.equal(petX.get(), -30); assert.equal(petY.get(), 30);
render().startActivity('sofaSit'); render(); advance(0);
assert.equal(render().activity.plan.kind, 'sofaSit', 'Commands remain reusable after coming home');
console.log('Verified immediate commands, persistent commanded naps, staged return from a nap, and repeated commands.');

const sitting = render().activity.plan;
advance(sitting.steps[0].durationMs + sitting.steps[1].durationMs);
const seatedPosition = { x: petX.get(), y: petY.get() };
assert.equal(render().activity.plan.steps[render().activity.stepIndex].hold, true);
render().startActivity('sofaSleep'); render(); advance(0);
const inPlaceSleep = render().activity.plan;
assert.equal(inPlaceSleep.steps[0].animation, 'curlUp', 'A seated cat lies down immediately');
assert.equal(JSON.stringify(inPlaceSleep.steps[0].position), JSON.stringify(seatedPosition));
assert.equal(petX.get(), seatedPosition.x); assert.equal(petY.get(), seatedPosition.y);
advance(inPlaceSleep.steps[0].durationMs);
assert.equal(render().activity.plan.steps[render().activity.stepIndex].animation, 'curlSleep');
render().startActivity('sofaSleep'); render(); advance(0);
assert.equal(render().activity.plan.steps[0].animation, 'curlSleep', 'Repeating sleep keeps the cat asleep on the sofa');
assert.equal(render().activity.plan.steps[0].hold, true);
render().startActivity('sofaSit'); render(); advance(0);
assert.equal(render().activity.plan.steps[0].reverse, true, 'Sitting up from sleep happens on the sofa');
assert.equal(petX.get(), seatedPosition.x); assert.equal(petY.get(), seatedPosition.y);
advance(1000);
assert.equal(render().activity.plan.steps[render().activity.stepIndex].hold, true);

const secondSofa = { ...sofa, instanceId: 'second-sofa', offset: { x: -.4, y: -.2 } };
const twoSofas = { ...furnished, decorations: [sofa, secondSofa] };
assert.equal(buildRoomActivity(twoSofas, 1, 'sofaSleep', 'sofa').targetInstanceId, 'sofa', 'Sleep uses the sofa the cat already occupies');
const floorPosition = { x: 80, y: 70 };
const directSofa = routeToSofa(furnished, sofaCommand, floorPosition, { plan: placedChase, stepIndex: 1 });
assert.equal(directSofa.steps[0].position, sofaCommand.sofaApproach, 'A floor activity goes directly to the sofa approach');
assert.equal(directSofa.steps[0].durationMs, getCatWalkMotion(floorPosition, sofaCommand.sofaApproach, room.petSize).durationMs);
assert.equal(directSofa.steps[0].animation, 'walk');
const halfwayUp = { x: seatedPosition.x, y: (seatedPosition.y + sofaCommand.sofaApproach.y) / 2 };
const jumpingSleep = routeToSofa(furnished, sofaCommand, halfwayUp, { plan: sitting, stepIndex: 1 });
assert.equal(jumpingSleep.steps[0].position, sofaCommand.steps[1].position, 'A command during jumping continues toward the seat');
assert.equal(jumpingSleep.steps[1].animation, 'curlUp');
const otherSofaSleep = buildRoomActivity(twoSofas, 0, 'sofaSleep', 'second-sofa');
const changingSofas = routeToSofa(twoSofas, otherSofaSleep, seatedPosition, { plan: inPlaceSleep, stepIndex: 1 });
assert.equal(changingSofas.steps[0].reverse, true);
assert.equal(JSON.stringify(changingSofas.steps[1].position), JSON.stringify(sofaCommand.sofaApproach));
assert.equal(changingSofas.steps[2].position, otherSofaSleep.sofaApproach, 'Changing sofas walks between them without visiting home');
console.log('Verified direct sofa walks, sitting-to-sleep in place, repeated sleep, sitting up, interrupted jumping, and commands with multiple sofas.');

assert.ok(play.steps[1].objectDelayMs > 0 && play.steps[1].objectMoveMs > 0, 'The ball rolls after paw contact over a visible duration');
assert.equal(play.steps[1].position, play.steps[0].position, 'Batting happens while the cat is grounded at the toy');
assert.equal(play.steps[2].animation, 'walk', 'The cat walks after the rolling ball');
assert.equal(yarnPlay.steps[2].animation, 'walk', 'The cat walks after the rolling yarn');

// Flight must clear both endpoints, with planted anticipation and landing time.
for (const [from, to] of [[60, -20], [-20, 60]]) {
  const jump = getCatJumpMotion(from, to, 120);
  assert.ok(jump.apexY < Math.min(from, to) - 10);
  assert.equal(jump.prepareMs, 180);
  assert.equal(jump.riseMs + jump.fallMs, jump.flightMs);
  assert.equal(900 - jump.prepareMs - jump.flightMs, 270);
}
assert.equal(sit.steps[1].animation, 'jumpOn');
assert.equal(sit.steps.at(-2).animation, 'jumpOff');

// Commands and room touches during flight finish landing before changing plans.
render().returnHome(); render(); advance(0);
advance(render().activity.plan.steps.reduce((sum, step) => sum + step.durationMs, 0)); render();
render().startActivity('sofaSit'); render(); advance(0);
advance(render().activity.plan.steps[0].durationMs);
assert.equal(render().activity.plan.steps[render().activity.stepIndex].animation, 'jumpOn');
advance(300);
render().startActivity('sofaSleep'); render(); advance(0);
assert.equal(render().activity.plan.steps[render().activity.stepIndex].animation, 'jumpOn', 'A sleep command must not restart the jump midair');
advance(600); render(); advance(0);
assert.equal(render().activity.plan.steps[0].animation, 'curlUp', 'After landing, sleep starts in place');
advance(1000); render();
render().returnHome(); render(); advance(0); advance(1000); render();
assert.equal(render().activity.plan.steps[render().activity.stepIndex].animation, 'jumpOff');
advance(300); interaction++; render(); render(); advance(0);
assert.equal(render().activity.plan.steps[render().activity.stepIndex].animation, 'jumpOff', 'A room touch must not restart a jump down');
advance(600); render(); advance(0);
assert.ok(isCatWalk(render().activity.plan.steps[0].animation), 'A touch during jump-down continues with walking after landing');
console.log('Verified sofa jump arcs, distinct jump-down poses, planted anticipation and recovery, and queued commands/touches during flight.');

// Touching during ascent to sleep must land sitting, without a false wake-up.
enabled = false; render(); advance(0); enabled = true; render();
render().startActivity('sofaSleep'); render(); advance(0);
advance(render().activity.plan.steps[0].durationMs); render();
render().returnHome(); render(); advance(900); render(); advance(0);
assert.equal(render().activity.plan.steps[0].animation, 'jumpOff', 'Touch during ascent must land seated, without reversing a curl that never happened');
console.log('Verified touching during ascent does not invent a sleeping pose.');

// A real menu tap records the interaction and requests an action in one event.
// Flush both renders before timers, as React does for an effect state update.
for (const kind of ['sofaSit', 'sofaSleep']) {
  enabled = false; render(); advance(0); enabled = true; render();
  const menuActivity = render();
  interaction++;
  menuActivity.startActivity(kind);
  render(); render(); advance(0);
  assert.equal(render().activity?.plan.kind, kind, 'Recording a menu tap must not replace the selected action with returnHome');
  const plan = render().activity.plan;
  advance(plan.steps.slice(0, kind === 'sofaSleep' ? 3 : 2).reduce((sum, step) => sum + step.durationMs, 0));
  assert.equal(render().activity.plan.steps[render().activity.stepIndex].hold, true);
}
console.log('Verified real menu taps start sit/sleep and reach their held sofa poses.');

// The interaction update must also preserve a command queued in mid-jump.
enabled = false; render(); advance(0); enabled = true; render();
render().startActivity('sofaSleep'); render(); advance(0);
advance(render().activity.plan.steps[0].durationMs);
const midJumpMenu = render();
interaction++;
midJumpMenu.startActivity('sofaSit');
render(); render(); advance(900); render(); advance(0);
assert.equal(render().activity.plan.kind, 'sofaSit');
assert.equal(render().activity.plan.steps[0].hold, true, 'A menu tap during ascent must sit after landing instead of jumping home');
console.log('Verified interaction recording preserves commands queued during jumps.');
