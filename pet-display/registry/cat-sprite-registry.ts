import { ONE_SHOT_ANIMATIONS } from "@/constants/game";
import type { BoxPlayAnimationId } from "@/constants/cat-box-play";
import { DEFAULT_CAT_SKIN_ID, resolveCatSkinId, type CatSkinId } from "@/constants/cat-skins";
import {
  getCatSpriteAnimations,
  type CatSpriteAnimationId,
} from "@/pet-display/registry/cat-sprite-atlas";
import type { PetAnimationState } from "@/types/game";
import type {
  PetMediaRegistry,
  PetMediaScenario,
  PetMediaSegment,
  BuiltInPetScenarioId,
  SpriteSheetConfig,
} from "@/pet-display/types";

function spriteSegment(
  skinId: CatSkinId,
  animationId: CatSpriteAnimationId,
  options: { loop?: boolean; fps?: number; reverse?: boolean } = {},
): PetMediaSegment {
  const animations = getCatSpriteAnimations(skinId);
  const base = animations[animationId];
  const sprite: SpriteSheetConfig = {
    ...base,
    fps: options.fps ?? base.fps,
    reverse: options.reverse ?? base.reverse,
  };

  return {
    assetKey: animationId,
    loop: options.loop ?? true,
    sprite,
  };
}

const MOOD_ANIMATIONS: Record<PetAnimationState, CatSpriteAnimationId> = {
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
};

const MOOD_OPTIONS: Partial<
  Record<
    PetAnimationState,
    { loop?: boolean; fps?: number; reverse?: boolean }
  >
> = {
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
};

function createCatSpriteScenarios(
  skinId: CatSkinId,
): Record<BuiltInPetScenarioId, PetMediaScenario> {
  return {
    fallAsleep: {
      id: "fallAsleep",
      label: "Getting sleepy…",
      steps: [
        spriteSegment(skinId, "sleepy", { loop: false }),
        spriteSegment(skinId, "sleep", { loop: true }),
      ],
    },
    standUp: {
      id: "standUp", label: "Stretching…",
      steps: [spriteSegment(skinId, "lieDown", { loop: false, reverse: true })],
    },
    wakeUp: {
      id: "wakeUp",
      label: "Waking up…",
      steps: [
        spriteSegment(skinId, "sleepy", { loop: false, reverse: true }),
      ],
    },
  };
}

export function createBoxPlaySegment(
  skinId: CatSkinId | string | undefined,
  animationId: BoxPlayAnimationId,
): PetMediaSegment {
  return spriteSegment(resolveCatSkinId(skinId), animationId, {
    loop: false,
  });
}

export function createBoxPlayScenario(
  skinId: CatSkinId | string | undefined,
  sequence: readonly BoxPlayAnimationId[],
): PetMediaScenario {
  return {
    id: "playBox",
    label: "Box time!",
    steps: sequence.map((animationId) =>
      createBoxPlaySegment(skinId, animationId),
    ),
  };
}

export function createCatSpriteRegistry(
  skinId: CatSkinId | string | undefined,
): PetMediaRegistry {
  const resolvedSkinId = resolveCatSkinId(skinId);
  const scenarios = createCatSpriteScenarios(resolvedSkinId);

  return {
    petType: "cat",
    mediaKind: "sprite",
    oneShotStates: ONE_SHOT_ANIMATIONS,
    pickExcitedMood: () => "excited",
    getSegment: (mood) => {
      const animationId = MOOD_ANIMATIONS[mood];
      const options = MOOD_OPTIONS[mood] ?? {};
      return spriteSegment(resolvedSkinId, animationId, options);
    },
    getScenario: (id) => scenarios[id],
  };
}

export const catSpriteRegistry = createCatSpriteRegistry(DEFAULT_CAT_SKIN_ID);
