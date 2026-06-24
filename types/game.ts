export type PetMood =
  | "idle"
  | "excited"
  | "dancing"
  | "eating"
  | "angry"
  | "sad"
  | "fallingAsleep"
  | "sleeping";

/** Short puzzle / reward clips — not derived from pet stats. */
export type PetReaction = "correct" | "coinCatch";

export type PetAnimationState = PetMood | PetReaction;

export type PetType = "dog" | "cat";

export type PetStats = {
  hunger: number;
  happiness: number;
  level: number;
};

export type PetProfile = {
  type: PetType;
  name: string;
  stats: PetStats;
  /** Unix ms — anchor for hunger/happiness decay between sessions. */
  lastCareAt: number;
  /** Unix ms — last tap anywhere in the app; used for idle sleep. */
  lastInteractionAt?: number;
  /** Persisted asleep loop — cleared when the player feeds or pets. */
  isAsleep?: boolean;
};

export type Wallet = {
  coins: number;
};

export type PuzzleProgress = {
  easy: number;
  medium: number;
  hard: number;
};

export type LivesState = {
  current: number;
  /** When the next life regenerates (null when at max lives). */
  nextRegenAt: number | null;
};

export type Progress = {
  streak: number;
  puzzlesSolved: PuzzleProgress;
  lives: LivesState;
  /** Puzzle ids with a permanently unlocked visual help. */
  visualHelpsUnlocked: string[];
};
