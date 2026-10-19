/** Check outcome selection and play the exported Blender actions on the native actor. */
import assert from 'node:assert/strict';
import { load, openSkin, resetCatActor, render, drawCat, actorBones, sampleCatClip } from './check-cat-turning.mjs';

const { getPuzzleCompanionMessage } = load('@/utils/puzzle-companion');
const { createPuzzleReactionSegment } = load('@/pet-display/registry/cat-model-registry');
const { PUZZLE_SUCCESS_REACTIONS: success, PUZZLE_RETRY_REACTIONS: retry } = load('@/constants/puzzle-cat-reactions');
const clips = load('@/constants/cat-animation-clips').CAT_ANIMATION_CLIPS;
const context = { correct: true, kind: 'practice', finalStage: false, practiceFinished: false,
  replay: false, retries: 0, completedCount: 1, puzzleId: 'fractions-1' };
const reaction = changes => getPuzzleCompanionMessage({ ...context, ...changes }).reaction;
assert.equal(reaction({ retries: 1 }), 'puzzleHighPaw', 'Persistence wording gets the offered high paw');
assert.equal(reaction({ kind: 'boss', finalStage: true }), 'puzzleHighPaw');
assert.equal(reaction({ completedCount: 5 }), 'puzzleBounce');
assert.equal(reaction({}), reaction({}), 'Rendering again does not reroll the reaction');
assert.equal(new Set([0, 1, 2].map(retries => reaction({ correct: false, retries }))).size, 3, 'Mistakes cycle through all three gentle performances');
const chosen = new Set();
for (let i = 0; i < 50; i++) {
  const result = reaction({ puzzleId: `puzzle-${i}`, completedCount: i + 1 });
  assert.ok(success.includes(result));
  chosen.add(result);
  assert.ok(retry.includes(reaction({ puzzleId: `puzzle-${i}`, correct: false })));
}
assert.equal(chosen.size, 3, 'Routine successes use the whole celebration set');

const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const paws = ['L.front.paw', 'R.front.paw', 'L.rear.paw', 'R.rear.paw'];
const coats = process.argv.includes('--preview') ? ['orange'] : ['orange', 'grey', 'white'];
for (const coat of coats) {
  openSkin(coat);
  const signatures = [];
  for (const name of [...success, ...retry]) {
    const segment = createPuzzleReactionSegment(name);
    assert.equal(segment.loop, false);
    assert.equal(segment.model.duration, clips[name][0] / clips[name][1]);
    const start = sampleCatClip(name, 0), end = sampleCatClip(name, segment.model.duration);
    for (const bone of ['head', 'ear.L', 'ear.R', 'tailTip', ...paws]) {
      assert.ok(distance(start[bone], end[bone]) < .0001, `${coat}/${name}/${bone}: settles back to its starting pose`);
    }
    const middle = sampleCatClip(name, segment.model.duration * .35);
    signatures.push(['head', 'ear.L', 'ear.R', 'tailTip', ...paws].flatMap(bone => middle[bone]));
    if (retry.includes(name)) {
      assert.ok(Math.hypot(...middle['mouth.frown'].slice(0, 3)) > .4, 'Mistakes show concern, with a lighter expression while thinking');
      assert.ok(Math.hypot(...end['mouth.frown'].slice(0, 3)) < .001, 'Sadness resolves before returning to idle');
    }
    if (name === 'puzzleHighPaw') {
      assert.ok(middle['R.front.paw'][13] - start['R.front.paw'][13] > .5, 'The offered paw rises toward the player');
      assert.ok(distance(middle['R.front.paw'].slice(0,12),start['R.front.paw'].slice(0,12)) > .5, 'The greeting articulates the wrist');
      for (const paw of paws.filter(paw => paw !== 'R.front.paw')) {
        assert.ok(distance(start[paw].slice(12, 15), middle[paw].slice(12, 15)) < .005, 'The other three paws support the high paw');
      }
    }
    if (success.includes(name)) {
      const greeting = sampleCatClip(name, segment.model.duration*.30);
      assert.ok(Math.hypot(...greeting['eye.L'].slice(4,7)) > .4, 'The cat makes eye contact before its smiling blink');
    }
    if (name === 'puzzleBounce') {
      const gather = sampleCatClip(name,segment.model.duration*.17);
      assert.ok(gather.chest[13] < start.chest[13]-.06, 'The cat gathers weight before springing');
      for (const paw of paws) assert.ok(distance(start[paw].slice(12,15),gather[paw].slice(12,15)) < .005,'Anticipation keeps the four support paws planted');
    }
    if (name === 'puzzleThink') {
      const study = sampleCatClip(name,segment.model.duration*.43);
      assert.ok(distance(study['brow.L'].slice(12,15),study['brow.R'].slice(12,15)) > .04,'The questioning expression raises one eyebrow independently');
    }
    for (const fps of [30, 60, 120]) {
      resetCatActor();
      let completed = 0;
      const props = { active: true, playback: { kind: 'segment', segment, mood: retry.includes(name) ? 'incorrect' : 'correct' },
        onAnimationComplete: () => completed++ };
      render(props);
      for (let frame = 0; frame < Math.ceil((segment.model.duration + .25) * fps); frame++) drawCat(1 / fps);
      assert.equal(completed, 1, `${coat}/${name}/${fps}: completes exactly once`);
      assert.ok(Object.values(actorBones()).flat().every(Number.isFinite));
      resetCatActor();
      render({ ...props, reduceMotion: true });
      drawCat(.01);
      const still = actorBones();
      for (let frame = 0; frame < fps; frame++) drawCat(1 / fps);
      for (const bone of ['head', 'ear.L', 'tailTip', ...paws]) {
        assert.ok(distance(still[bone], actorBones()[bone]) < .00001, 'Reduce Motion holds the authored pose still');
      }
    }
  }
  for (let a = 0; a < signatures.length; a++) for (let b = a + 1; b < signatures.length; b++) {
    assert.ok(distance(signatures[a], signatures[b]) > .1, 'Every performance has a distinct pose');
  }
}
console.log(`Verified six distinct Blender reactions on ${coats.join('/')} at 30/60/120 FPS, outcome selection, supported high paw, sad-to-neutral recovery, completion and Reduce Motion.`);
