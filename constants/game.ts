import type { PetAnimationState, PetMood } from "@/types/game";

export const GameColors = {
  background: "#FFF5EB",
  card: "#FFFFFF",
  cardBorder: "#FFE0CC",
  primary: "#FF6B6B",
  primaryDark: "#E85555",
  secondary: "#4ECDC4",
  coin: "#F7B731",
  coinText: "#8B6914",
  text: "#2D3436",
  textMuted: "#636E72",
  hunger: "#FF9F43",
  happiness: "#FF6B9D",
  success: "#6BCB77",
  stageBg: "#FFFFFF",
  stageBorder: "#4ECDC4",
  /** Matches white background in pet MP4 videos */
  petVideoBg: "#FFFFFF",
} as const;

export const DEFAULT_PET = {
  type: "dog" as const,
  name: "Buddy",
  stats: {
    hunger: 72,
    happiness: 85,
    level: 1,
  },
};

export const DEFAULT_WALLET = { coins: 42 };
export const DEFAULT_PROGRESS = {
  streak: 0,
  puzzlesSolved: { easy: 0, medium: 0, hard: 0 },
};

export const FEED_COST = 10;
export const FEED_HUNGER_RESTORE = 25;
export const PET_HAPPINESS_BOOST = 10;

export const PUZZLE_COIN_REWARDS = {
  easy: 5,
  medium: 10,
  hard: 20,
} as const;

/** Bonus coins for replaying a puzzle you've already cracked. */
export const PUZZLE_REPLAY_COIN_REWARDS = {
  easy: 2,
  medium: 4,
  hard: 8,
} as const;

export const PUZZLE_HAPPINESS_BOOST = 5;
export const PUZZLE_REPLAY_HAPPINESS_BOOST = 2;

export type MoodAnimationConfig = {
  frameMs: number;
  loop: boolean;
  /** Full 4-frame cycles before one-shot moods finish. Ignored when loop is true. */
  cycles?: number;
};

export const MOOD_ANIMATION: Record<PetMood, MoodAnimationConfig> = {
  idle: { frameMs: 400, loop: true },
  excited: { frameMs: 200, loop: false, cycles: 2 },
  excited2: { frameMs: 200, loop: false, cycles: 2 },
  dancing: { frameMs: 150, loop: false, cycles: 3 },
  eating: { frameMs: 300, loop: false, cycles: 1 },
  angry: { frameMs: 400, loop: true },
  sad: { frameMs: 500, loop: true },
  sleeping: { frameMs: 600, loop: true },
};

export const MOOD_LABELS: Record<PetMood, string> = {
  idle: "Feeling good",
  excited: "So happy!",
  excited2: "So happy!",
  dancing: "Party time!",
  eating: "Yum yum!",
  angry: "Missed you!",
  sad: "Needs attention",
  sleeping: "Zzz…",
};

export const ANIMATION_LABELS: Record<PetAnimationState, string> = {
  ...MOOD_LABELS,
  correct: "Nice one!",
  coinCatch: "Coin caught!",
};

/** One-shot clips that return to the base mood when finished. */
export const ONE_SHOT_ANIMATIONS: PetAnimationState[] = [
  "excited",
  "excited2",
  "eating",
  "dancing",
  "correct",
  "coinCatch",
];
