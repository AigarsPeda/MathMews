/** Spawn, edited layouts and the real actor must agree on free floor space. */
import assert from 'node:assert/strict';
import { openSkin, resetCatActor, render, drawCat, actorState, load, idle, walking } from './check-cat-turning.mjs';

const w = load('@/utils/native-room-world');
const { catWalkTiming } = load('@/utils/native-cat-locomotion');
const floor = [0, w.FLOOR_Y, 0];
const base = { width: 390, height: 520, petSize: 80, sizeScale: 1.15, decorations: [], toys: [] };
for (const decorationId of ['bowlTan', 'bowlBlue', 'bowlPurple', 'bowlPink']) {
  const layout = { ...base, decorations: [{ decorationId, instanceId: 'bowl', offset: { x: .25, y: .15 } }] };
  const world = w.buildNativeRoomWorld(layout), bowl = world.objects[0];
  const inside = [bowl.position[0], w.FLOOR_Y, bowl.position[2]];
  const spawn = w.buildNativeRoomWorld({ ...layout, livePositions: { cat: w.catScreenPoint(inside, world) } });
  assert.ok(!w.isFree(inside, world), 'A bowl is an obstacle even when it is low');
  assert.ok(w.isFree(spawn.home, spawn), 'A saved position inside a bowl is repaired on load');
  const start = [inside[0] - 1, w.FLOOR_Y, inside[2]], end = [inside[0] + 1, w.FLOOR_Y, inside[2]];
  const path = w.findRoomPath(start, end, world);
  assert.ok(path.length > 2, 'Ordinary walks detour around the bowl');
  for (let i = 1; i < path.length; i++) for (let t = 0; t <= 1; t += .01)
    assert.ok(w.isFree(path[i - 1].map((v, k) => v + (path[i][k] - v) * t), world));
  assert.ok(w.findFoodBowlApproach(spawn.home, bowl, spawn), 'The repaired cat can still eat');
}

const empty = w.buildNativeRoomWorld(base);
const doorWorld = { ...empty, objects: [{ instanceId: 'open-door', modelId: 'test-door', solid: false,
  interactionBoxes: [{ min: [-.3, 0, -.3], max: [.3, 1, .3] }] }] };
assert.ok(w.isFree(w.nearestFree(floor, doorWorld), doorWorld), 'Spawn repair respects an open door on a non-solid object');

const obstacle = { instanceId: 'obstacle', modelId: 'test-obstacle', solid: true,
  min: [-.25, 0, -.25], max: [.25, 1, .25] };
const blocked = { ...empty, objects: [obstacle] };
blocked.home = w.nearestFree(floor, blocked);
for (const reduceMotion of [false, true]) for (const fps of [30, 60, 120]) {
  openSkin('grey'); resetCatActor();
  render({ active: true, playback: idle, world: blocked, initialPosition: floor, reduceMotion });
  drawCat(1 / fps);
  assert.ok(w.isFree(actorState().position, blocked), 'A room entry cannot override the safe spawn with a blocked initial position');

  for (const held of [false, true]) {
    resetCatActor();
    const travel = held ? { path: [floor], duration: 2, distance: 0, jump: false } : undefined;
    const props = { active: true, playback: idle, world: { ...empty, home: floor }, travel, reduceMotion };
    render(props); drawCat(1 / fps);
    render({ ...props, world: { ...blocked, home: floor } });
    for (let i = 0; i < fps; i++) {
      drawCat(1 / fps);
      assert.ok(w.isFree(actorState().position, blocked), 'A floor rest recovers when a furnishing is moved onto the cat');
    }
  }

  resetCatActor();
  const before = { ...empty, home: floor };
  render({ active: true, playback: idle, world: before, reduceMotion }); drawCat(1 / fps);
  // A furnishing is moved onto the cat after mounting. Keep the old home to
  // exercise recovery independently of the actor's home-change behavior.
  const changed = { ...blocked, home: floor }, end = [1.5, w.FLOOR_Y, 1.5];
  // Publish the old route as well: recovery must not rely on the scheduler
  // having already replaced a route planned before the furnishing moved.
  const path = [floor, end];
  const travel = { path, ...catWalkTiming(path, changed.catScale), distance: w.pathLength(path), jump: false };
  render({ active: true, playback: walking, world: changed, travel, activityKey: 'escape', reduceMotion });
  for (let i = 0; i < (travel.duration + 2) * fps; i++) {
    drawCat(1 / fps);
    assert.ok(w.isFree(actorState().position, changed), 'The actor must retain the repaired route start instead of rebasing into furniture');
  }
  assert.ok(w.hasNativeArrived(actorState().position, end), 'The recovered cat completes its walk');

  resetCatActor();
  const narrow = [.6, w.FLOOR_Y, 0], navigation = { radius: .55 * blocked.catScale };
  assert.ok(w.isFree(narrow, { ...blocked, ...navigation }) && !w.isFree(narrow, blocked));
  const props = { active: true, playback: idle, world: blocked, reduceMotion,
    travel: { path: [narrow], duration: 2, distance: 0, jump: false, navigation } };
  render(props); drawCat(1 / fps);
  render({ ...props, activityKey: 'narrow-aisle' }); drawCat(1 / fps);
  assert.ok(w.hasNativeArrived(actorState().position, narrow), 'Recovery honors the validated footprint used for narrow kitchen approaches');
}
console.log('Verified bowl avoidance and feeding, saved spawns, open doors and actor collision recovery at 30/60/120 FPS with Reduce Motion.');
