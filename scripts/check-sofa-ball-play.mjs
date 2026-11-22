// Drive the shipped cat rig at the perch and heading chosen for a placed ball.
import assert from 'node:assert/strict';
import { openSkin, resetCatActor, render, drawCat, load } from './check-cat-turning.mjs';

const worldApi = load('@/utils/native-room-world');
const { buildRoomActivity } = load('@/utils/room-activities');
const { hangingToyContact } = load('@/utils/native-hanging-toy');
const { pawContactImpulse } = load('@/utils/native-paw-contact');
const { sofaBallPosition, SOFA_BALL_ROLL_SECONDS } = load('@/utils/sofa-ball-roll');
const { getDecorationDefaultPlacementScale } = load('@/constants/decoration-variants');
const { getToyPlacementScale } = load('@/constants/cat-toys');

openSkin('orange');
for (const [model, ballId, angle, fps] of [
  ['sofaA', 'orangeBall', 0, 60], ['sofaB', 'pinkBall', 25, 30], ['sofaCornerSage', 'blueBall', -25, 120],
]) {
  const ball = { instanceId: 'ball', toyId: ballId, scale: getToyPlacementScale(ballId), offset: { x: .3, y: .3 } };
  const options = {
    width: 390, height: 420, petSize: 48, sizeScale: 1.15, homeOffset: { x: 0, y: .12 },
    decorations: [{ instanceId: 'seat', decorationId: model, offset: { x: 0, y: 0 },
      scale: getDecorationDefaultPlacementScale(model), rotationDegrees: angle }],
    toys: [ball], ownedToyIds: [], hungry: false, asleep: false,
  };
  const [owner, original] = worldApi.buildNativeRoomWorld(options).objects;
  const top = worldApi.NATIVE_MODEL_CATALOG[owner.modelId].supportSurfaces[0];
  const bottom = worldApi.NATIVE_MODEL_CATALOG[original.modelId].min[1] * original.scale;
  ball.support = { parentId: 'seat', heading: 0, position: [
    (top.min[0] + top.max[0]) / 2, top.max[1] + (.002 - bottom) / owner.scale, (top.min[2] + top.max[2]) / 2,
  ] };
  let world = worldApi.buildNativeRoomWorld(options);
  const plan = buildRoomActivity({ ...options, nativeWorld: world }, 0, 'toyPlay', 'ball');
  assert.ok(plan, model);
  let start = world.home;
  const radius = (world.objects[1].max[1] - world.objects[1].min[1]) / 2;
  let landed, strikeTime, clock = 0;
  for (const step of plan.steps) {
    const from = worldApi.catScreenPoint(start, world);
    const { native } = worldApi.prepareNativeStep(plan, step, from, world, start[1]);
    assert.equal(native.blocked, false, model + ' ' + step.animation);
    const began = clock;
    clock += native.duration;
    start = native.path.at(-1);
    if (step.chaseReleasedBall) {
      assert.ok(landed);
      assert.ok(began < strikeTime + SOFA_BALL_ROLL_SECONDS, 'The cat starts chasing while the ball is rolling');
      assert.ok(Math.hypot(start[0] - landed[0], start[2] - landed[2]) < 1.3 * world.catScale + radius);
    }
    const roll = step.sofaBallRoll;
    if (!roll) continue;
    const paws = { value: [] }, toy = { value: { instanceId: 'ball', position: roll.start, radius } };
    resetCatActor();
    render({ active: true, world, travel: native, initialPosition: start, floorToy: toy, pawPositions: paws,
      playback: { kind: 'segment', segment: { assetKey: 'batToy', loop: true } } });
    let previous, hit = false;
    for (let frame = 0; frame < fps * native.duration; frame++) {
      drawCat(1 / fps);
      const index = hangingToyContact(roll.start, paws.value, radius + .075 * world.catScale, previous);
      if (index >= 0 && pawContactImpulse(roll.start, paws.value[index], previous?.paws[index], 1 / fps, radius)) {
        strikeTime ??= began + frame / fps;
        hit = true;
      }
      previous = { ball: roll.start, paws: paws.value.map(point => [...point]) };
    }
    assert.ok(hit, model + ' forepaw contacts the elevated ball');
    assert.deepEqual(Array.from(sofaBallPosition(roll, 0)), Array.from(roll.start));
    assert.ok(Math.hypot(...sofaBallPosition(roll, 1).map((v, i) => v - roll.end[i])) < 1e-6);
    ball.offset = worldApi.nativeObjectPlacementOffset(world, world.objects[1], roll.end);
    delete ball.support;
    world = worldApi.buildNativeRoomWorld(options);
    landed = roll.end;
    assert.ok(world.objects[1].movable);
  }
  assert.ok(landed, 'The floor chase uses the same swatted ball');
}
console.log('Verified sofa approaches, elevated paw contact, dismounts and chases to the saved floor ball at 30/60/120 FPS.');
