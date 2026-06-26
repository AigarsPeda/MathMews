import { MOOD_ANIMATION, ONE_SHOT_ANIMATIONS } from "@/constants/game";
import type { PetAnimationState, PetType } from "@/types/game";
import type {
  PetMediaRegistry,
  PetMediaScenario,
  PetMediaSegment,
  PetScenarioId,
} from "@/pet-display/types";

/** Video asset keys for the dog — swap or extend per species in new registry files. */
export const DOG_VIDEO_ASSET_KEYS = [
  "idle",
  "happy_bounce",
  "victory_spin",
  "eating",
  "sad",
  "sad2",
  "sleeping",
  "correct",
  "catches_a_coin",
] as const;

export type DogVideoAssetKey = (typeof DOG_VIDEO_ASSET_KEYS)[number];

export const DOG_VIDEO_SOURCES: Record<
  DogVideoAssetKey,
  number
> = {
  idle: require("@/assets/video/idle.mp4"),
  happy_bounce: require("@/assets/video/happy_bounce.mp4"),
  victory_spin: require("@/assets/video/victory_spin.mp4"),
  eating: require("@/assets/video/eating.mp4"),
  sad: require("@/assets/video/sad.mp4"),
  sad2: require("@/assets/video/sad2.mp4"),
  sleeping: require("@/assets/video/sleeping.mp4"),
  correct: require("@/assets/video/correct.mp4"),
  catches_a_coin: require("@/assets/video/catches_a_coin.mp4"),
};

export const DOG_MOOD_VIDEO_ASSET_KEYS = DOG_VIDEO_ASSET_KEYS.filter(
  (key) => key !== "correct" && key !== "catches_a_coin",
) as DogVideoAssetKey[];

const MOOD_ASSET_KEYS: Record<PetAnimationState, DogVideoAssetKey> = {
  idle: "idle",
  excited: "happy_bounce",
  dancing: "victory_spin",
  eating: "eating",
  angry: "sad2",
  sad: "sad",
  fallingAsleep: "sleeping",
  sleeping: "sleeping",
  correct: "correct",
  coinCatch: "catches_a_coin",
};

const REACTION_CONFIG: Record<
  "correct" | "coinCatch",
  { assetKey: DogVideoAssetKey; startMs: number }
> = {
  correct: { assetKey: "correct", startMs: 5000 },
  coinCatch: { assetKey: "catches_a_coin", startMs: 5000 },
};

function segmentFromMood(mood: PetAnimationState): PetMediaSegment {
  if (mood === "correct" || mood === "coinCatch") {
    const reaction = REACTION_CONFIG[mood];
    return {
      assetKey: reaction.assetKey,
      loop: false,
      startMs: reaction.startMs,
    };
  }

  const anim = MOOD_ANIMATION[mood];
  return {
    assetKey: MOOD_ASSET_KEYS[mood],
    loop: anim.loop,
    startMs: anim.startMs,
    endMs: anim.endMs,
  };
}

const DOG_SCENARIOS: Record<PetScenarioId, PetMediaScenario> = {
  fallAsleep: {
    id: "fallAsleep",
    label: "Getting sleepy…",
    steps: [
      {
        assetKey: "sleeping",
        loop: false,
        startMs: MOOD_ANIMATION.fallingAsleep.startMs,
        endMs: MOOD_ANIMATION.fallingAsleep.endMs,
      },
      {
        assetKey: "sleeping",
        loop: true,
        startMs: MOOD_ANIMATION.sleeping.startMs,
        endMs: MOOD_ANIMATION.sleeping.endMs,
      },
    ],
  },
  wakeUp: {
    id: "wakeUp",
    label: "Waking up…",
    steps: [
      {
        assetKey: "sleeping",
        loop: false,
        reverse: true,
        startMs: MOOD_ANIMATION.fallingAsleep.startMs,
        endMs: MOOD_ANIMATION.fallingAsleep.endMs,
      },
    ],
  },
};

export const dogVideoRegistry: PetMediaRegistry = {
  petType: "dog",
  mediaKind: "video",
  oneShotStates: ONE_SHOT_ANIMATIONS,
  pickExcitedMood: () => "excited",
  getSegment: segmentFromMood,
  getScenario: (id) => DOG_SCENARIOS[id],
};

/** Prime positions (seconds) for each dog video clip. */
export const DOG_VIDEO_PRIME_SEC: Record<DogVideoAssetKey, number> = {
  idle: 0,
  happy_bounce: (MOOD_ANIMATION.excited.startMs ?? 0) / 1000,
  victory_spin: (MOOD_ANIMATION.dancing.startMs ?? 0) / 1000,
  eating: (MOOD_ANIMATION.eating.startMs ?? 0) / 1000,
  sad: 0,
  sad2: (MOOD_ANIMATION.angry.startMs ?? 0) / 1000,
  sleeping: (MOOD_ANIMATION.sleeping.startMs ?? 0) / 1000,
  correct: 5,
  catches_a_coin: 5,
};

const REGISTRIES: Record<PetType, PetMediaRegistry> = {
  dog: dogVideoRegistry,
  cat: dogVideoRegistry,
};

export function getPetMediaRegistry(petType: PetType): PetMediaRegistry {
  return REGISTRIES[petType] ?? dogVideoRegistry;
}
