import type { PetAnimationState } from "@/types/game";

export const PET_VIDEO_SOURCES = {
  idle: require("@/assets/video/idle.mp4"),
  happy_bounce: require("@/assets/video/happy_bounce.mp4"),
  happy_bounce2: require("@/assets/video/happy_bounce2.mp4"),
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

export type PetVideoConfig = {
  loop: boolean;
  startMs?: number;
  videoKey: PetVideoKey;
};

const loopAt5s = { loop: true, startMs: 5000 } as const;
const oneShotAt5s = { loop: false, startMs: 5000 } as const;

const CLIPS: Record<PetVideoKey, Omit<PetVideoConfig, "videoKey">> = {
  idle: { loop: true },
  happy_bounce: { loop: false, startMs: 8000 },
  happy_bounce2: { ...oneShotAt5s },
  victory_spin: { ...oneShotAt5s },
  eating: { ...oneShotAt5s },
  sad: { ...loopAt5s },
  sad2: { ...loopAt5s },
  sleeping: { ...loopAt5s },
  correct: { ...oneShotAt5s },
  catches_a_coin: { ...oneShotAt5s },
};

const MOOD_CLIPS: Record<PetAnimationState, PetVideoKey> = {
  idle: "idle",
  excited: "happy_bounce",
  excited2: "happy_bounce2",
  dancing: "victory_spin",
  eating: "eating",
  angry: "sad2",
  sad: "sad",
  sleeping: "sleeping",
  correct: "correct",
  coinCatch: "catches_a_coin",
};

function clipConfig(key: PetVideoKey): PetVideoConfig {
  return { videoKey: key, ...CLIPS[key] };
}

export function getPetVideo(state: PetAnimationState): PetVideoConfig {
  return clipConfig(MOOD_CLIPS[state]);
}

const EXCITED_MOODS = ["excited", "excited2"] as const;

export type ExcitedMood = (typeof EXCITED_MOODS)[number];

export function pickRandomExcitedMood(): ExcitedMood {
  return EXCITED_MOODS[Math.floor(Math.random() * EXCITED_MOODS.length)];
}
