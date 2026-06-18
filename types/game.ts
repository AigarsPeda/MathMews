export type PetMood =
  | 'idle'
  | 'excited'
  | 'excited2'
  | 'dancing'
  | 'eating'
  | 'angry'
  | 'sad'
  | 'sleeping';

/** Short puzzle / reward clips — not derived from pet stats. */
export type PetReaction = 'correct' | 'coinCatch';

export type PetAnimationState = PetMood | PetReaction;

export type PetType = 'dog' | 'cat';

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
};
