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
  fallingAsleep: "sleepy",
  sleeping: "sleep",
  correct: "excited",
  coinCatch: "waiting",
  playBox: "box2",
};

const MOOD_OPTIONS: Partial<
  Record<
    PetAnimationState,
    { loop?: boolean; fps?: number; reverse?: boolean }
  >
> = {
  idle: { loop: true, fps: 6 },
  excited: { loop: false, fps: 10 },
  dancing: { loop: false, fps: 10 },
  eating: { loop: false, fps: 8 },
  sad: { loop: true, fps: 5 },
  angry: { loop: true, fps: 8 },
  fallingAsleep: { loop: false, fps: 5 },
  sleeping: { loop: true, fps: 4 },
  correct: { loop: false, fps: 10 },
  coinCatch: { loop: false, fps: 6 },
  playBox: { loop: false, fps: 8 },
};

function createCatSpriteScenarios(
  skinId: CatSkinId,
): Record<BuiltInPetScenarioId, PetMediaScenario> {
  return {
    fallAsleep: {
      id: "fallAsleep",
      label: "Getting sleepy…",
      steps: [
        spriteSegment(skinId, "sleepy", { loop: false, fps: 5 }),
        spriteSegment(skinId, "sleep", { loop: true, fps: 4 }),
      ],
    },
    wakeUp: {
      id: "wakeUp",
      label: "Waking up…",
      steps: [
        spriteSegment(skinId, "sleepy", { loop: false, fps: 5, reverse: true }),
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
    fps: 8,
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
