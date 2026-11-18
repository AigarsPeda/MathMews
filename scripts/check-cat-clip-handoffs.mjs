/** Sample the same render callback and GLB transforms used by the room and puzzle portrait. */
import assert from 'node:assert/strict';
import { actorState, deferCatNotifications, drawCat, enableActorCrossfade, flushCatNotifications, load, openSkin, point, render, resetCatActor } from './check-cat-turning.mjs';

const { createBoxPlayScenario, createPuzzleReactionSegment } = load('@/pet-display/registry/cat-model-registry');
const joints = ['head', 'ear.R', 'tailTip', 'L.front.paw', 'R.front.paw', 'R.rear.paw'];
const pose = () => joints.map(point);
const jump = (a, b) => Math.max(...a.map((p, i) => Math.hypot(...p.map((v, k) => v - b[i][k]))));
enableActorCrossfade();
for (const coat of ['orange', 'grey', 'white']) {
  openSkin(coat);
  for (const fps of [30, 60, 120]) {
    resetCatActor();
    let revision = 0;
    const play = (assetKey, options) => render({ active: true, activityKey: String(++revision), playback: {
      kind: 'segment', segment: { assetKey, loop: false, ...options },
    } });
    const advance = seconds => {
      for (let i = 0; i < Math.round(seconds * fps); i++) drawCat(1 / fps);
    };
    const handoff = (name, options) => {
      const before = pose();
      play(name, options);
      drawCat(0);
      const displacement = jump(before, pose());
      assert.ok(displacement < .003, `${coat}/${fps}/${name} jumps ${displacement} at handoff`);
    };
    play('wash'); advance(1.15);
    handoff('wash'); // Replay while the paw is still against the cheek.
    advance(.05);
    handoff('sleep'); // Replace an unfinished fade, then interrupt that fade too.
    advance(1 / fps);
    handoff('puzzleHighPawBrief', createPuzzleReactionSegment('puzzleHighPaw', true));
    advance(.8);
    assert.ok(actorState().complete, 'The brief reaction still completes on time');
    handoff('idle', { loop: true });
    advance(.3);
    assert.equal(actorState().blend, 1);
    play('sleepy'); advance(1.7);
    const settlingTime = actorState().clipTime;
    handoff('sleepy', { reverse: true });
    assert.ok(Math.abs(actorState().clipTime - settlingTime) < .001, 'An interrupted settle wakes from its visible pose');
    advance(.3);
    assert.ok(Math.abs(actorState().clipTime - (settlingTime - .3)) < .001, 'The wake clock runs backwards');

    resetCatActor();
    const box = createBoxPlayScenario(['box1', 'box2', 'box3']);
    render({ active: true, playback: { kind: 'scenario', steps: box.steps } });
    drawCat(0);
    let crossed = 0;
    for (let i = 0; i < fps * 7.5; i++) {
      const before = pose(), index = actorState().index;
      drawCat(1 / fps);
      if (actorState().index !== index) {
        assert.ok(jump(before, pose()) < .04, 'Entry, peek and exit meet at the same crouched pose');
        crossed++;
      }
    }
    assert.equal(crossed, 2);
    handoff('ballToss');
    advance(2);
    handoff('wash');

    // A turn into the first step places feet with IK. Keep the outgoing head,
    // tail and raised grooming paw when starting that turn.
    resetCatActor();
    const world = { width: 390, height: 420, catScale: .4, radius: .16, home: [0, .068, 0], objects: [] };
    render({ active: true, world, playback: { kind: 'segment', segment: { assetKey: 'wash', loop: false } } });
    advance(1.15);
    const washed = pose();
    render({ active: true, world, playback: { kind: 'segment', segment: { assetKey: 'walk', loop: true } },
      travel: { path: [world.home, [0, .068, 1.5]], duration: 2, distance: 1.5, gait: 'walk', jump: false } });
    drawCat(0);
    assert.ok(jump(washed, pose()) < .003, 'Standing up to walk retains the rendered care pose');
    let last = pose();
    for (let i = 0; i < fps / 2; i++) {
      drawCat(1 / fps);
      const next = pose();
      const speed = jump(last, next) * fps / world.catScale;
      assert.ok(speed < 12, `${coat}/${fps} first-step frame ${i} moves at ${speed} model units/s`);
      last = next;
    }
    advance(2.5);
    assert.ok(Math.abs(actorState().position[2] - 1.5) < .001, 'The interrupted cat reaches its destination');
  }
}
// The JS callback queue may deliver a finished reaction after the next tap.
resetCatActor();
let completions = 0, steps = 0;
const reaction = { kind: 'segment', segment: createPuzzleReactionSegment('puzzleHighPaw', true) };
const feedback = { active: true, playback: reaction, onAnimationComplete: () => completions++, onStepComplete: () => steps++ };
render({ ...feedback, activityKey: 'first' }); drawCat(0);
deferCatNotifications();
for (let i = 0; i < 46; i++) drawCat(1 / 60);
render({ ...feedback, activityKey: 'replay' }); drawCat(0);
flushCatNotifications();
assert.equal(completions + steps, 0, 'An old completion cannot cut the replay short');
for (let i = 0; i < 46; i++) drawCat(1 / 60);
assert.equal(completions, 1);
assert.equal(steps, 1);
console.log('Verified interrupted, replayed and reversed care and puzzle clips on all coats at 30/60/120 FPS.');
