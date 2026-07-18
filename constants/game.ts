import { DEFAULT_CAT_ROOM_ID } from "@/constants/cat-rooms";
import { DEFAULT_CAT_SKIN_ID } from "@/constants/cat-skins";
import type { PetAnimationState, PetMood, TopicStatsMap } from "@/types/game";
import type { PuzzleDifficulty } from "@/types/puzzle";

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
  cleanliness: "#74B9FF",
  wisdom: "#A29BFE",
  success: "#6BCB77",
  stageBg: "#FFFFFF",
  stageBorder: "#4ECDC4",
  /** Matches white background in pet MP4 videos */
  petVideoBg: "#FFFFFF",
} as const;

/** Home header control height (store, lives, coins, settings). */
export const HEADER_CHIP_SIZE = 38;

export const DEFAULT_PET = {
  type: "cat" as const,
  name: "Whiskers",
  stats: {
    hunger: 72,
    happiness: 85,
    cleanliness: 80,
    level: 1,
  },
  lastCareAt: Date.now(),
  lastInteractionAt: Date.now(),
  isAsleep: false,
  roomId: DEFAULT_CAT_ROOM_ID,
  catSkinId: DEFAULT_CAT_SKIN_ID,
};

export const DEFAULT_WALLET = { coins: 42 };
export const DEFAULT_PROGRESS = {
  streak: 0,
  puzzleStreak: 0,
  puzzlesSolved: { easy: 0, medium: 0, hard: 0 },
  lives: { current: 5, nextRegenAt: null },
  visualHelpsUnlocked: [] as string[],
  roomsUnlocked: [DEFAULT_CAT_ROOM_ID] as string[],
  bedsUnlocked: [] as string[],
  toysUnlocked: [] as string[],
  toyQuantities: {} as Record<string, number>,
  decorationsUnlocked: [] as string[],
  decorationQuantities: {} as Record<string, number>,
  skinsUnlocked: [] as string[],
  topicStats: {} as TopicStatsMap,
};

export const MAX_LIVES = 5;
/** Minutes until one life regenerates. */
export const LIFE_REGEN_MINUTES = 30;
export const LIFE_BUY_COST = 15;

export const FEED_COST = 10;
export const BOX_PLAY_COST = 7;
export const FEED_HUNGER_RESTORE = 25;
export const FEED_HAPPINESS_BOOST = 5;
export const PET_HAPPINESS_BOOST = 10;
export const BOX_PLAY_HAPPINESS_BOOST = 18;
/** Max hunger / happiness (0–100). */
export const MAX_PET_STAT = 100;
/** Cooldown after a pet or feed action finishes. */
export const PET_CARE_COOLDOWN_MS = 4_000;

export const PUZZLE_COIN_REWARDS = {
  easy: 4,
  medium: 7,
  hard: 9,
} as const;

/** Costs more than the first-clear coin reward for that difficulty. */
export function getVisualHelpCost(difficulty: PuzzleDifficulty): number {
  return PUZZLE_COIN_REWARDS[difficulty] + 1;
}

/** Bonus coins for replaying a puzzle you've already cracked. */
export const PUZZLE_REPLAY_COIN_REWARDS = {
  easy: 1,
  medium: 2,
  hard: 3,
} as const;

export const PUZZLE_HAPPINESS_BOOST = 5;
export const PUZZLE_REPLAY_HAPPINESS_BOOST = 2;
export const PUZZLE_WRONG_HAPPINESS_PENALTY = 4;
/** Hunger spent per puzzle attempt (thinking makes them peckish). */
export const PUZZLE_HUNGER_COST = 2;

/** Show hungry speech when fullness is at or below this (0–100). */
export const HUNGER_SPEECH_FULLNESS_MAX = 30;

/** Stat decay while the app is closed or idle (per hour). */
export const HUNGER_DECAY_PER_HOUR = 5;
export const HAPPINESS_DECAY_PER_HOUR = 1;
/** Extra happiness lost per hour when hunger drops below 50. */
export const HAPPINESS_DECAY_LOW_HUNGER_PER_HOUR = 3;
export const LOW_HUNGER_THRESHOLD = 50;

export function getPuzzleCoinReward(
  difficulty: PuzzleDifficulty,
  replay = false,
): number {
  return replay
    ? PUZZLE_REPLAY_COIN_REWARDS[difficulty]
    : PUZZLE_COIN_REWARDS[difficulty];
}

export type MoodAnimationConfig = {
  loop: boolean;
  /** Video clip in-point (ms). */
  startMs?: number;
  /** Video clip out-point (ms) — segment end for loop or one-shot. */
  endMs?: number;
  /** Skip intro mood and jump to loop after this much time away (sleeping only). */
  skipIntroAfterAwayMs?: number;
  /** Fall asleep after this long without a tap while the app is open. */
  idleAsleepMs?: number;
};

export const MOOD_ANIMATION: Record<PetMood, MoodAnimationConfig> = {
  idle: { loop: true },
  excited: { loop: false, startMs: 5500 },
  dancing: { loop: false, startMs: 5000 },
  eating: { loop: false, startMs: 5000 },
  sad: { loop: true, startMs: 5000 },
  angry: { loop: true, startMs: 5000 },
  /** sleeping.mp4 lie-down intro. */
  fallingAsleep: { loop: false, startMs: 0, endMs: 7550 },
  /** sleeping.mp4 breathing loop. */
  sleeping: {
    loop: true,
    startMs: 7750,
    endMs: 9000,
    skipIntroAfterAwayMs: 30 * 60 * 1000,
    idleAsleepMs: 30 * 60 * 1000,
  },
};

export const MOOD_LABELS: Record<PetMood, string> = {
  idle: "Feeling good",
  excited: "So happy!",
  dancing: "Party time!",
  eating: "Yum yum!",
  angry: "Missed you!",
  sad: "Needs attention",
  fallingAsleep: "Getting sleepy…",
  sleeping: "Zzz…",
};

export const ANIMATION_LABELS: Record<PetAnimationState, string> = {
  ...MOOD_LABELS,
  correct: "Nice one!",
  coinCatch: "Coin caught!",
  playBox: "Box time!",
};

/** One-shot clips that return to the base mood when finished. */
export const ONE_SHOT_ANIMATIONS: PetAnimationState[] = [
  "excited",
  "eating",
  "dancing",
  "playBox",
  "correct",
  "coinCatch",
];
