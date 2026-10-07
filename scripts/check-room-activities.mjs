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
  if (resolved.endsWith('.json')) { module.exports = JSON.parse(fs.readFileSync(resolved, 'utf8')); return module.exports; }
  const source = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: load, Date: { now: () => now }, setTimeout: setTimeoutMock, clearTimeout: id => timers.delete(id) });
  return module.exports;
}
const { buildRoomActivity, buildRoomReturn, routeToSofa, roomOffsetToPoint, roomActivityStepKey, ROOM_IDLE_DELAY_MS } = load('@/utils/room-activities');
const { getCatWalkMotion, getCatJumpMotion, isCatWalk } = load('@/constants/cat-room-motion');
for (const [x, y, animation, facing] of [[60, 0, 'walk', 1], [-60, 0, 'walk', -1], [0, -60, 'walkAway', 1],
  [0, 60, 'walkToward', 1], [60, -16.8, 'walkAwayDiagonal', 1], [-60, 16.8, 'walkTowardDiagonal', -1]]) {
  const motion = getCatWalkMotion({ x: 0, y: 0 }, { x, y }, 120);
  assert.equal(motion.animation, animation); assert.equal(motion.facing, facing);
  assert.ok(Math.abs(motion.cycles / (motion.durationMs / 1000) - 2.25) < .002, 'Floor travel must match the brisk 2.25-cycle walking cadence');
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
assert.notEqual(larger.steps[1].position.y, sit.steps[1].position.y, "A larger sofa changes its seat location");
assert.equal(buildRoomActivity({ ...furnished, asleep: true }, 0).kind, 'sofaSleep');
const ball = { toyId: 'blueBall', instanceId: 'ball', offset: { x: .3, y: .4 } };
const play = buildRoomActivity({ ...room, toys: [ball] }, 0);
assert.equal(play.kind, 'toyPlay');
assert.equal(play.steps[1].mood, 'playBall');
assert.equal(buildRoomActivity({ ...room, ownedToyIds: ['blueBall'] }, 0), null, 'Balls must be placed');
assert.equal(buildRoomActivity({ ...room, toys: [ball], hungry: true }, 0), null);
assert.equal(buildRoomActivity({ ...room, toys: [ball], asleep: true }, 0), null);
const ownedMouse = { ...room, ownedToyIds: ['mouse'] };
assert.equal(buildRoomActivity(ownedMouse, 0), null, 'A mouse in another room must not appear in this room');
const mouse = { toyId: 'mouse', instanceId: 'mouse', offset: { x: -.4, y: .4 } };
const mouseRoom = { ...ownedMouse, toys: [mouse] };
const placedChase = buildRoomActivity(mouseRoom, 0);
assert.equal(placedChase.targetInstanceId, 'mouse');
assert.equal(JSON.stringify(placedChase.objectStart), JSON.stringify(placedChase.steps.at(-1).objectPosition));
for (const plan of [sit, sleep, flipped, larger, play, placedChase]) {
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
mocks['@/hooks/use-animation-activity'] = { useAnimationActivity: () => visibility };
mocks['react-native-reanimated'] = {
  useSharedValue: initial => slot(() => shared(initial))[1], cancelAnimation() {},
  withDelay: (_, value) => value, withTiming: value => value, withRepeat: value => value, withSequence: (...values) => values.at(-1),
  Easing: { linear: x => x, quad: x => x, inOut: fn => fn, in: fn => fn, out: fn => fn },
};
const { useRoomActivity } = load('@/hooks/use-room-activity');
const petX = shared(0), petY = shared(0);
const arrivals = [], roomArrivals = [];
let meals = 0;
let interaction = 1, enabled = true, roomVisible = true, hookRoom = mouseRoom;
function render() {
  index = 0; effects = [];
  // The VM supplies a dependency-aware hook dispatcher instead of mounting React.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const result = useRoomActivity(hookRoom, enabled, interaction, petX, petY, instanceId => arrivals.push(instanceId), () => meals++, id => roomArrivals.push(id), roomVisible);
  effects.forEach(fn => fn()); return result;
}
assert.equal(render().activity, null);
advance(ROOM_IDLE_DELAY_MS - 1); assert.equal(render().activity, null);
advance(1); assert.equal(render().activity.plan.kind, 'mouseChase');
const firstWalk = render().activity.plan.steps[0];
assert.ok(isCatWalk(firstWalk.animation));
assert.ok(firstWalk.animationFps > 53 && firstWalk.animationFps <= 54, 'Playback cadence must match floor travel');
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
visibility = { active: true, reduceMotion: false }; render();
advance(Math.min(...[...timers.values()].map(timer => timer.at)) - now);
assert.equal(render().activity.plan.kind, 'mouseChase');
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
assert.ok(wake.steps[2].durationMs >= 180);
assert.ok(isCatWalk(wake.steps[2].animation), 'Floor travel after landing must use footsteps');
assert.equal(buildRoomActivity(room, 0, 'sofaSleep'), null, 'Sofa commands require a placed sofa');
assert.equal(buildRoomActivity(room, 0, 'mouseChase'), null, 'Mouse commands require a mouse placed in this room');
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
  assert.equal(render().scale.get(), 1, "The cat keeps its size when sitting and sleeping on furniture");
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

// Reduced motion suppresses ambient movement but retains explicit commands.
enabled = false; render(); advance(0);
visibility = { active: true, reduceMotion: true }; enabled = true; render();
render().startActivity('sofaSleep'); render(); advance(0);
assert.equal(render().activity.plan.kind, 'sofaSleep');
assert.equal(render().activity.plan.steps[0].animation, undefined, 'Static actions must not request a walking clip');
advance(2400); render();
assert.equal(render().activity.plan.steps[render().activity.stepIndex].hold, true, 'Reduced-motion sleep reaches the held pose');
render().returnHome(); render(); advance(2400); render();
assert.equal(render().activity, null);
console.log('Verified deliberate sofa commands and return-home completion under Reduce Motion.');

// Opening another screen must freeze a sofa pose, then visibly return on focus.
for (const kind of ['sofaSit', 'sofaSleep']) {
  enabled = false; render(); advance(0);
  visibility = { active: true, reduceMotion: false }; enabled = true; render();
  render().startActivity(kind); render(); advance(0);
  const plan = render().activity.plan;
  advance(plan.steps.slice(0, kind === 'sofaSleep' ? 3 : 2).reduce((sum, step) => sum + step.durationMs, 0));
  assert.equal(render().scale.get(), 1, "The cat keeps its size when sitting and sleeping on furniture");
  const sofaX = petX.get(), sofaY = petY.get(), sofaScale = render().scale.get();
  interaction++; render(); render();
  visibility = { active: false, reduceMotion: false }; render(); advance(60_000);
  assert.equal(petX.get(), sofaX, 'Covering the room must not teleport the cat horizontally');
  assert.equal(petY.get(), sofaY, 'Covering the room must not teleport the cat to the floor');
  assert.equal(render().scale.get(), sofaScale, 'The seated size stays unchanged while covered');
  assert.equal(render().activity.plan.kind, kind, 'Keep the seated/sleeping pose while covered');
  assert.equal(timers.size, 0, 'Covered room activities do no background work');
  visibility = { active: true, reduceMotion: false }; render(); advance(0);
  const exit = render().activity.plan;
  assert.equal(exit.kind, 'returnHome');
  assert.equal(exit.steps[kind === 'sofaSleep' ? 1 : 0].animation, 'jumpOff');
  if (kind === 'sofaSleep') {
    assert.equal(exit.steps[0].reverse, true, 'Wake up on the sofa before jumping down');
    assert.equal(petY.get(), sofaY);
  }
  advance(exit.steps.reduce((sum, step) => sum + step.durationMs, 0)); render();
  assert.equal(render().activity, null);
  assert.equal(petX.get(), -30); assert.equal(petY.get(), 30);
}
console.log('Verified covered sitting/sleeping cats keep their pose and animate getting down on focus.');

// Each physical doorway travels to its assigned threshold, then fires once.
const door = { decorationId: 'japaneseDoorAni', instanceId: 'bathroom-door', doorDestination: 'bathroom', offset: { x: -.6, y: -.3 }, scale: 1.4 };
const doorRoom = { ...room, decorations: [door] };
assert.equal(buildRoomActivity(doorRoom, 0), null, 'Doors never trigger unsolicited room changes');
assert.equal(buildRoomActivity(doorRoom, 0, 'doorTravel', 'missing'), null);
assert.equal(buildRoomActivity({ ...room, decorations: [{ ...door, doorDestination: undefined }] }, 0, 'doorTravel', door.instanceId), null);
const travel = buildRoomActivity({ ...doorRoom, hungry: true, asleep: true }, 0, 'doorTravel', door.instanceId);
assert.equal(travel.kind, 'doorTravel');
assert.ok(travel.steps[0].durationMs > 0);
assert.ok(Math.abs(travel.steps[0].position.x) <= 100 && Math.abs(travel.steps[0].position.y) <= 100);
for (const reduced of [false, true]) {
  enabled = false; render(); advance(0);
  hookRoom = doorRoom; visibility = { active: true, reduceMotion: reduced }; enabled = true; render();
  const before = arrivals.length;
  interaction++; render().startActivity('doorTravel', door.instanceId); render(); render(); advance(0);
  assert.equal(render().activity.plan.kind, 'doorTravel');
  assert.equal(arrivals.length, before, 'A room changes only after arrival');
  advance(reduced ? 600 : render().activity.plan.steps[0].durationMs); render();
  assert.equal(arrivals.length, before + 1);
  assert.equal(arrivals.at(-1), door.instanceId);
  advance(60_000); render();
  assert.equal(arrivals.length, before + 1, 'An arrival must not fire twice');
}
enabled = false; render(); advance(0); visibility = { active: true, reduceMotion: false }; enabled = true; render();
const beforeCancel = arrivals.length;
render().startActivity('doorTravel', door.instanceId); render(); advance(0);
render().returnHome(); render(); advance(0); advance(60_000); render();
assert.equal(arrivals.length, beforeCancel, 'Interrupting a doorway walk cancels the visit');
const secondBall = { ...ball, instanceId: 'second-ball', offset: { x: -.3, y: .4 } };
assert.equal(buildRoomActivity({ ...room, toys: [ball, secondBall] }, 0, 'toyPlay', secondBall.instanceId).targetInstanceId, secondBall.instanceId);
console.log('Verified placed-object isolation, door thresholds, arrival callbacks, cancellation, Reduce Motion travel, and explicit object selection.');

const secondMouse = { ...mouse, instanceId: 'second-mouse', offset: { x: .4, y: .4 } };
assert.equal(buildRoomActivity({ ...room, toys: [mouse, secondMouse] }, 0, 'mouseChase', secondMouse.instanceId).targetInstanceId, secondMouse.instanceId);
console.log('Verified each placed mouse has its own chase target.');

const foodBowl = { decorationId: 'bowlBlue', instanceId: 'food-bowl', offset: { x: .5, y: .15 } };
const mealRoom = { ...room, decorations: [foodBowl], toys: [], hungry: true };
assert.equal(buildRoomActivity(mealRoom, 0), null, 'Eating requires the player command');
assert.equal(buildRoomActivity(room, 0, 'bowlEat'), null, 'Food requires a placed bowl');
assert.equal(buildRoomActivity(mealRoom, 0, 'bowlEat', 'missing'), null, 'An unknown bowl cannot feed');
const mealPlan = buildRoomActivity(mealRoom, 0, 'bowlEat');
assert.equal(mealPlan.targetInstanceId, foodBowl.instanceId);
assert.equal(mealPlan.steps[1].animation, 'eating');
assert.equal(mealPlan.steps[1].durationMs, 8000, 'The cat stays at the bowl for an eight-second meal');
assert.equal(mealPlan.steps[1].animationFps, 12, 'The rendered cat and crumbs share the longer playback rate');
for (const reduced of [false, true]) {
  enabled = false; render(); advance(0);
  hookRoom = mealRoom; visibility = { active: true, reduceMotion: reduced }; enabled = true; render();
  const before = meals;
  interaction++; render().startActivity('bowlEat'); render(); render(); advance(0);
  assert.equal(meals, before, 'No hunger is awarded before eating');
  const plan = render().activity.plan;
  advance(reduced ? 1800 : plan.steps.reduce((sum, step) => sum + step.durationMs, 0)); render();
  assert.equal(meals, before + 1, 'Completing the meal feeds exactly once');
  assert.equal(render().activity, null);
  advance(60000); render(); assert.equal(meals, before + 1);
}
visibility = { active: true, reduceMotion: false };
enabled = false; render(); advance(0); enabled = true; render();
const mealsBeforeCancel = meals;
render().startActivity('bowlEat'); render(); advance(0);
render().returnHome(); render(); advance(0); advance(60000); render();
assert.equal(meals, mealsBeforeCancel, 'Interrupting the meal cancels its hunger reward');
console.log('Verified deliberate bowl journeys, feeding after completion exactly once, cancellation and Reduce Motion.');

// Use real native navigation when a meal interrupts rest on a different object.
const nativeRoom = load('@/utils/native-room-world');
for (const pose of ['sofaSleep', 'sofaSit']) for (const reduced of [false, true]) {
  enabled = false; render(); advance(0);
  const options = { ...mealRoom, width: 390, height: 420, petSize: 80, sizeScale: 1.15,
    homeOffset: { x: -.3, y: .25 }, decorations: [{ ...sofa, offset: { x: 0, y: -.25 } }, { ...foodBowl, offset: { x: .25, y: .15 } }] };
  hookRoom = { ...options, nativeWorld: nativeRoom.buildNativeRoomWorld(options) };
  visibility = { active: true, reduceMotion: reduced }; enabled = true;
  const home = hookRoom.nativeWorld.home;
  const homePoint = nativeRoom.catScreenPoint(home, hookRoom.nativeWorld);
  petX.set(homePoint.x); petY.set(homePoint.y); render().updateNativeHeight(home); render();
  function finishNativeStep() {
    const state = render().activity, step = state.plan.steps[state.stepIndex];
    assert.equal(step.native.blocked, false, `${pose}/${reduced}/${step.animation}: commands remain reachable`);
    const arrival = step.native.path.at(-1), screen = nativeRoom.catScreenPoint(arrival, hookRoom.nativeWorld);
    // Filament reports the visible arrival before the scheduler advances.
    petX.set(screen.x); petY.set(screen.y); render().updateNativeHeight(arrival);
    advance(reduced ? 600 : step.durationMs);
  }
  render().startActivity(pose); render(); advance(0);
  for (let i = 0; !render().activity.plan.steps[render().activity.stepIndex].hold && i < 6; i++) finishNativeStep();
  const seated = { x: petX.get(), y: petY.get() }, before = meals;
  interaction++; render().startActivity('bowlEat'); render(); render(); advance(0);
  const first = render().activity.plan.steps[0];
  assert.equal(first.targetInstanceId, sofa.instanceId, 'Exit steps keep the sofa while the command targets the bowl');
  if (pose === 'sofaSleep' && !reduced) {
    assert.equal(first.animation, 'curlUp'); assert.equal(first.reverse, true);
    assert.ok(Math.hypot(first.position.x - seated.x, first.position.y - seated.y) < 1e-6, 'Getting up starts at the visible sleeping position');
  }
  const stages = [];
  for (let i = 0; render().activity && i < 10; i++) {
    const state = render().activity, step = state.plan.steps[state.stepIndex];
    assert.equal(state.plan.kind, 'bowlEat', 'The Eat request survives getting up and leaving the sofa');
    assert.equal(state.plan.targetInstanceId, foodBowl.instanceId);
    stages.push(reduced ? step.mood : step.animation); finishNativeStep();
  }
  assert.ok(stages.includes('eating') && (reduced || stages.indexOf('jumpOff') < stages.indexOf('eating')), 'The cat gets down, walks to the bowl, and eats');
  assert.equal(render().activity, null); assert.equal(meals, before + 1, 'Rest-to-Eat completes and feeds exactly once');
}
console.log('Verified native sleeping/seated-to-eating command execution, visible departures and completed meals with and without Reduce Motion.');

// Change target locations while the actual scheduler is executing a command.
const dynamicOptions = { ...mealRoom, width: 390, height: 420, petSize: 80, sizeScale: 1.15,
  homeOffset: { x: -.3, y: .25 }, decorations: [{ ...foodBowl, offset: { x: .25, y: .15 } }] };
function beginDynamicMeal() {
  enabled = false; render(); advance(0);
  hookRoom = { ...dynamicOptions, nativeWorld: nativeRoom.buildNativeRoomWorld(dynamicOptions) };
  visibility = { active: true, reduceMotion: false }; enabled = true;
  const home = hookRoom.nativeWorld.home, screen = nativeRoom.catScreenPoint(home, hookRoom.nativeWorld);
  petX.set(screen.x); petY.set(screen.y); render().updateNativeHeight(home); render();
  render().startActivity('bowlEat', foodBowl.instanceId); render(); advance(0);
}
function reportCat(point) {
  const screen = nativeRoom.catScreenPoint(point, hookRoom.nativeWorld);
  petX.set(screen.x); petY.set(screen.y); render().updateNativeHeight(point);
}
function completeDynamicStep() {
  const state = render().activity, step = state.plan.steps[state.stepIndex];
  reportCat(step.native.path.at(-1)); advance(step.durationMs);
}
beginDynamicMeal();
let firstRoute = render().activity.plan.steps[0].native;
let midpoint = firstRoute.path[0].map((v, i) => (v + firstRoute.path.at(-1)[i]) / 2);
reportCat(midpoint); advance(firstRoute.duration * 500);
hookRoom = { ...hookRoom, decorations: [{ ...foodBowl, offset: { x: -.3, y: .35 } }] };
hookRoom.nativeWorld = nativeRoom.buildNativeRoomWorld(hookRoom);
render();
let rerouted = render().activity;
assert.equal(rerouted.plan.kind, 'bowlEat'); assert.equal(rerouted.stepIndex, 0);
let route = rerouted.plan.steps[0].native;
assert.equal(route.replanned, true);
assert.ok(nativeRoom.pathLength([route.path[0], midpoint]) < 1e-6, 'A moving target replans from the visible cat position');
assert.ok(nativeRoom.pathLength([route.path.at(-1), firstRoute.path.at(-1)]) > .1, 'Eat follows the new bowl location');
assert.equal(rerouted.plan.targetInstanceId, foodBowl.instanceId, 'Moving the bowl preserves its identity');
completeDynamicStep();
const beforeRelocatingFood = meals;
assert.equal(render().activity.plan.steps[render().activity.stepIndex].animation, 'eating');
advance(500);
hookRoom = { ...hookRoom, decorations: [{ ...foodBowl, offset: { x: .35, y: .25 } }] };
hookRoom.nativeWorld = nativeRoom.buildNativeRoomWorld(hookRoom);
const eatingPosition = { x: petX.get(), y: petY.get() }; render(); advance(0);
assert.equal(render().activity.stepIndex, 0, 'Moving the bowl during eating starts a new approach');
assert.equal(render().activity.plan.steps[0].bowlApproach, true);
assert.ok(Math.hypot(petX.get() - eatingPosition.x, petY.get() - eatingPosition.y) < 1e-6, 'Relocating food cannot teleport the cat');
for (let i = 0; render().activity && i < 5; i++) completeDynamicStep();
assert.equal(meals, beforeRelocatingFood + 1, 'Only the meal at the new bowl position feeds');

beginDynamicMeal(); completeDynamicStep();
const activeMeal = render().activity, eating = activeMeal.plan.steps[activeMeal.stepIndex];
advance(1200);
hookRoom = { ...hookRoom, hungry: false }; render();
assert.equal(render().activity.plan.kind, 'bowlEat', 'Stat updates keep the active command');
assert.ok(Math.abs(render().activity.plan.steps[activeMeal.stepIndex].native.elapsed - 1.2) < 1e-6, 'An unrelated update preserves the animation clock');
reportCat(eating.native.path.at(-1)); advance(eating.durationMs - 1200);
assert.equal(render().activity.plan.steps[render().activity.stepIndex].returnHome, true, 'The meal finishes at its original deadline');

beginDynamicMeal();
const beforeRemovingFood = meals;
hookRoom = { ...hookRoom, decorations: [], nativeWorld: nativeRoom.buildNativeRoomWorld({ ...dynamicOptions, decorations: [] }) };
render(); advance(0);
assert.equal(render().activity.plan.kind, 'returnHome', 'A removed target cancels its command');
for (let i = 0; render().activity && i < 5; i++) completeDynamicStep();
assert.equal(meals, beforeRemovingFood, 'A missing bowl cannot award food');

// Physics notifications update navigation without rewriting the saved layout.
beginDynamicMeal();
const originalWorld = hookRoom.nativeWorld, target = originalWorld.objects[0];
const center = target.min.map((v, i) => (v + target.max[i]) / 2), shifted = center.map((v, i) => v + (i === 0 ? .4 : 0));
const originalPlacement = JSON.stringify(originalWorld);
render().updateObjectPosition(foodBowl.instanceId, shifted); render();
assert.equal(render().activity.plan.kind, 'bowlEat');
assert.ok(nativeRoom.pathLength([render().activity.plan.steps[0].native.targetPosition, target.position]) > .3, 'Live target positions reach the planner');
assert.equal(JSON.stringify(originalWorld), originalPlacement, 'Physics tracking never changes saved/rendered placement');
const liveTarget = render().activity.plan.steps[0].native.targetPosition;
hookRoom = { ...hookRoom, nativeWorld: { ...originalWorld, objects: [...originalWorld.objects] } }; render();
assert.equal(render().activity.plan.steps[0].native.targetPosition, liveTarget, 'An unrelated layout refresh cannot forget the live target location');
for (const kind of ['sofaSit', 'sofaSleep', 'toyPlay', 'mouseChase'])
  assert.equal(buildRoomActivity({ ...furnished, toys: [ball, mouse] }, 0, kind, 'removed-object'), null, 'Target lookup cannot silently substitute another object');
console.log('Verified live target lookup, mid-route replanning, moving food, clock continuity, missing-target cancellation and physics-position tracking.');

// Explicit room travel works without placing a door and preserves a resting pose.
enabled = false; render(); advance(0);
visibility = { active: true, reduceMotion: false }; enabled = true; hookRoom = furnished; render();
assert.equal(buildRoomActivity(room, 0, 'roomTravel', 'outside'), null);
render().startActivity('sofaSleep'); render(); advance(0);
let nap = render().activity.plan;
advance(nap.steps.slice(0, 3).reduce((sum, step) => sum + step.durationMs, 0));
assert.equal(render().activity.plan.steps[render().activity.stepIndex].animation, 'curlSleep');
render().startActivity('roomTravel', 'bedroom'); render(); advance(0);
const departure = render().activity.plan;
assert.equal(departure.destination, 'bedroom');
assert.equal(departure.steps[0].animation, 'curlUp');
assert.equal(departure.steps[0].reverse, true, 'Wake up before leaving the sofa');
assert.equal(departure.steps[1].animation, 'jumpOff');
assert.equal(departure.steps.at(-1).leavingRoom, true);
assert.equal(roomArrivals.length, 0);
advance(departure.steps.reduce((sum, step) => sum + step.durationMs, 0) - 1);
assert.equal(roomArrivals.length, 0, 'Saved cat location cannot change mid-journey');
advance(1); render();
assert.deepEqual(roomArrivals, ['bedroom']);
assert.equal(render().activity, null);
advance(60_000); render();
assert.deepEqual(roomArrivals, ['bedroom'], 'A departure completes exactly once');
console.log('Verified door-free room travel, getting up and jumping down before departure, and location updates only after walking finishes.');

// Browsing pauses the retained cat scene rather than resetting its held pose.
enabled = false; render(); advance(0);
hookRoom = { ...furnished, nativeWorld: nativeRoom.buildNativeRoomWorld(furnished) };
reportCat(hookRoom.nativeWorld.home);
enabled = true; render(); render().startActivity('sofaSleep'); render(); advance(0);
for (let i = 0; i < 3; i++) completeDynamicStep();
const napIndex = render().activity.stepIndex;
assert.equal(render().activity.plan.steps[napIndex].animation, 'curlSleep');
const restingPosition = [petX.get(), petY.get()];
roomVisible = false; render(); advance(60_000); render();
assert.deepEqual([petX.get(), petY.get()], restingPosition);
assert.equal(render().activity.stepIndex, napIndex);
assert.equal(timers.size, 0, 'The hidden cat scene runs no activity timers');
roomVisible = true; render();
assert.equal(render().activity.plan.kind, 'sofaSleep', 'Returning to the room preserves the cat’s commanded nap');
assert.equal(render().activity.stepIndex, napIndex);
console.log('Verified room browsing preserves the cat scene, pauses its clock and timers, and resumes the same sofa pose.');

// Reported left-wall bowl: RN timers can run ahead of the visible cat.
for (const reduced of [false, true]) {
  enabled = false; render(); advance(0);
  const arrivalRoom = { ...room, width: 370, height: 465.666687, petSize: 81, sizeScale: 1.1691666667,
    nativeStepCompletion: true, homeOffset: { x: -.2238806, y: .1212716 },
    decorations: [
      { decorationId: 'plantB', instanceId: 'left-plant', offset: { x: -.761836421, y: -.146691585 }, scale: 2.2 },
      { decorationId: 'sofaA', instanceId: 'left-sofa', offset: { x: .2240544744, y: -.2197699658 }, scale: 1.5 },
      { decorationId: 'bowlBlue', instanceId: 'left-bowl', offset: { x: -.8836587705, y: .1640559605 }, scale: 1.4 },
    ], toys: [] };
  hookRoom = { ...arrivalRoom, nativeWorld: nativeRoom.buildNativeRoomWorld(arrivalRoom) };
  visibility = { active: true, reduceMotion: reduced }; enabled = true; reportCat(hookRoom.nativeWorld.home); render();
  const finishRenderedStep = () => {
    const state = render().activity, step = state.plan.steps[state.stepIndex], key = roomActivityStepKey(state);
    assert.equal(step.native.blocked, false);
    assert.equal(step.native.awaitCompletion, true);
    advance(10_000); render();
    assert.equal(render().activity.stepIndex, state.stepIndex, 'Wall-clock time cannot outrun the renderer');
    render().completeNativeStep(key + ':stale', step.native.path.at(-1)); render();
    assert.equal(render().activity.stepIndex, state.stepIndex, 'Delayed completion from another step is ignored');
    render().completeNativeStep(key, step.native.path.at(-1)); render();
  };
  render().startActivity('sofaSit', 'left-sofa'); render(); advance(0);
  finishRenderedStep(); finishRenderedStep();
  assert.equal(render().activity.plan.steps[render().activity.stepIndex].hold, true);
  const before = meals;
  interaction++; render().startActivity('bowlEat', 'left-bowl'); render(); advance(0);
  const animations = [];
  for (let i = 0; render().activity && i < 10; i++) {
    const state = render().activity, step = state.plan.steps[state.stepIndex];
    animations.push(reduced ? step.mood : step.animation);
    assert.equal(meals, before, 'Feeding waits until the complete rendered meal and return');
    if (step.animation === 'eating') {
      const bowl = hookRoom.nativeWorld.objects.find(o => o.instanceId === 'left-bowl');
      const arrived = step.native.path[0];
      assert.ok(Math.abs(nativeRoom.pathLength([arrived, bowl.position]) - nativeRoom.CAT_EATING_REACH * hookRoom.nativeWorld.catScale) < 1e-5,
        'The meal starts at the exact reachable muzzle position, not a stale reported anchor');
    }
    finishRenderedStep();
  }
  assert.ok(animations.includes('eating'));
  assert.equal(meals, before + 1);
}
console.log('Verified seated-to-eating at the reported left-wall bowl, delayed render frames, exact muzzle arrival, stale-event guards and feeding exactly once with Reduce Motion.');

for (const reduced of [false, true]) {
  enabled = false; render(); advance(0);
  visibility = { active: true, reduceMotion: reduced };
  const entryOptions = { ...room, homeRoomId: 'livingRoom', entry: { id: reduced ? 202 : 201, direction: 1 }, nativeStepCompletion: true };
  hookRoom = { ...entryOptions, nativeWorld: nativeRoom.buildNativeRoomWorld(entryOptions) };
  enabled = true; roomVisible = false; render(); advance(1000); render();
  assert.equal(render().activity, null, 'Entry waits for the room slide to finish');
  roomVisible = true; render();
  const entered = render().activity;
  assert.equal(entered.plan.steps[0].enteringRoom, true);
  assert.equal(entered.plan.steps[0].travelDirection, 1);
  assert.equal(entered.plan.steps[0].native.awaitCompletion, true);
  render().completeNativeStep(roomActivityStepKey(entered), entered.plan.steps[0].native.path.at(-1)); render();
  assert.equal(render().activity, null);
  roomVisible = false; render(); roomVisible = true; render();
  assert.equal(render().activity, null, 'Browsing back does not replay the entry');
  hookRoom = { ...hookRoom }; render();
  assert.equal(render().activity, null, 'A layout refresh does not replay the entry');
}
console.log('Verified entry after sliding, exact rendered completion and no repeated entry on browsing, layout refresh or Reduce Motion.');
