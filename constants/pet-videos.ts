import { MOOD_ANIMATION } from "@/constants/game";
import type { PetAnimationState, PetMood } from "@/types/game";

export const PET_VIDEO_SOURCES = {
  idle: require("@/assets/video/idle.mp4"),
  happy_bounce: require("@/assets/video/happy_bounce.mp4"),
  victory_spin: require("@/assets/video/victory_spin.mp4"),
  eating: require("@/assets/video/eating.mp4"),
  sad: require("@/assets/video/sad.mp4"),
  sad2: require("@/assets/video/sad2.mp4"),
  sleeping: require("@/assets/video/sleeping.mp4"),
  correct: require("@/assets/video/correct.mp4"),
  catches_a_coin: require("@/assets/video/catches_a_coin.mp4"),
} as const;

export type PetVideoKey = keyof typeof PET_VIDEO_SOURCES;

export const PET_VIDEO_KEYS = Object.keys(PET_VIDEO_SOURCES) as PetVideoKey[];

/** Mood / care clips — kept mounted on the home pet. */
export const PET_MOOD_VIDEO_KEYS = PET_VIDEO_KEYS.filter(
  (key) => key !== "correct" && key !== "catches_a_coin",
) as PetVideoKey[];

export type PetVideoConfig = {
  loop: boolean;
  startMs?: number;
  endMs?: number;
  videoKey: PetVideoKey;
};

const MOOD_VIDEO_KEYS: Record<PetMood, PetVideoKey> = {
  idle: "idle",
  excited: "happy_bounce",
  dancing: "victory_spin",
  eating: "eating",
  angry: "sad2",
  sad: "sad",
  fallingAsleep: "sleeping",
  sleeping: "sleeping",
};

const REACTION_VIDEO: Record<"correct" | "coinCatch", PetVideoConfig> = {
  correct: { videoKey: "correct", loop: false, startMs: 5000 },
  coinCatch: { videoKey: "catches_a_coin", loop: false, startMs: 5000 },
};

function moodToVideoConfig(mood: PetMood): PetVideoConfig {
  const anim = MOOD_ANIMATION[mood];
  return {
    loop: anim.loop,
    endMs: anim.endMs,
    startMs: anim.startMs,
    videoKey: MOOD_VIDEO_KEYS[mood],
  };
}

export function getPetVideo(state: PetAnimationState): PetVideoConfig {
  if (state === "correct" || state === "coinCatch") {
    return REACTION_VIDEO[state];
  }
  return moodToVideoConfig(state);
}

export type ExcitedMood = "excited";

export function pickRandomExcitedMood(): ExcitedMood {
  return "excited";
}
