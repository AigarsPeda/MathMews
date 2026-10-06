import { ONE_SHOT_ANIMATIONS } from "@/constants/game";
import type { CatRoomAnimation } from "@/constants/cat-room-motion";
import type { BoxPlayAnimationId } from "@/constants/cat-box-play";
import { CAT_ANIMATION_CLIPS, type CatAnimationId } from "@/constants/cat-animation-clips";
import type { PetAnimationState } from "@/types/game";
import type { PetMediaRegistry, PetMediaScenario, PetMediaSegment, BuiltInPetScenarioId, } from "@/pet-display/types";
function modelSegment(animationId: CatAnimationId, options: {
  loop?: boolean;
  fps?: number;
  reverse?: boolean;
} = {}): PetMediaSegment {
  const [frameCount, fps] = CAT_ANIMATION_CLIPS[animationId];
  return {
    assetKey: animationId,
    loop: options.loop ?? true,
    reverse: options.reverse ?? false,
    model: { duration: frameCount / fps, rate: (options.fps ?? fps) / fps },
  };
}
const MOOD_ANIMATIONS: Record<PetAnimationState, CatAnimationId> = {
  idle: "idle",
  excited: "excited",
  dancing: "dance",
  eating: "eating",
  angry: "surprised",
  sad: "sad",
  fallingAsleep: "restSleep",
  sleeping: "sleep",
  correct: "correct",
  incorrect: "incorrect",
  resting: "layDown",
  lyingDown: "lieDown",
  coinCatch: "waiting",
  playBox: "box2",
  playBall: "ballToss",
  playYarn: "yarnRoll",
  playFeather: "featherChase",
};
const MOOD_OPTIONS: Partial<Record<PetAnimationState, {
  loop?: boolean;
  fps?: number;
  reverse?: boolean;
}>> = {
  idle: { loop: true },
  resting: { loop: true },
  lyingDown: { loop: false },
  incorrect: { loop: false },
  excited: { loop: false },
  dancing: { loop: false },
  eating: { loop: false },
  sad: { loop: true },
  angry: { loop: true },
  fallingAsleep: { loop: false },
  sleeping: { loop: true },
  correct: { loop: false },
  coinCatch: { loop: false },
  playBox: { loop: false },
  playBall: { loop: false },
  playYarn: { loop: false },
  playFeather: { loop: false },
};
function createCatScenarios(): Record<BuiltInPetScenarioId, PetMediaScenario> {
  return {
    fallAsleep: {
      id: "fallAsleep",
      label: "Getting sleepy…",
      steps: [
        modelSegment("sleepy", { loop: false }),
        modelSegment("sleep", { loop: true }),
      ],
    },
    standUp: {
      id: "standUp", label: "Stretching…",
      steps: [modelSegment("lieDown", { loop: false, reverse: true, fps: 72 })],
    },
    wakeUp: {
      id: "wakeUp",
      label: "Waking up…",
      steps: [
        modelSegment("sleepy", { loop: false, reverse: true, fps: 72 }),
      ],
    },
  };
}
export function createRoomActivitySegment(animationId: CatRoomAnimation, reverse = false, fps?: number): PetMediaSegment {
  return modelSegment(animationId, {
    loop: animationId !== "curlUp" && animationId !== "jumpOn" && animationId !== "jumpOff" && animationId !== "eating", reverse, fps,
  });
}
export function createBoxPlaySegment(animationId: BoxPlayAnimationId): PetMediaSegment {
  return modelSegment(animationId, {
    loop: false,
  });
}
export function createBoxPlayScenario(sequence: readonly BoxPlayAnimationId[]): PetMediaScenario {
  return {
    id: "playBox",
    label: "Box time!",
    steps: sequence.map((animationId) => createBoxPlaySegment(animationId)),
  };
}
const scenarios = createCatScenarios();
export const catModelRegistry: PetMediaRegistry = {
  petType: "cat",
  mediaKind: "model",
  oneShotStates: ONE_SHOT_ANIMATIONS,
  pickExcitedMood: () => "excited",
  getSegment: mood => modelSegment(MOOD_ANIMATIONS[mood], MOOD_OPTIONS[mood]),
  getScenario: id => scenarios[id],
};
