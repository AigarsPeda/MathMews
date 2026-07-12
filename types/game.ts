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
export type PetReaction = "correct" | "coinCatch" | "playBox";

export type PetAnimationState = PetMood | PetReaction;

export type PetType = "dog" | "cat";

export type PetStats = {
  level: number;
  hunger: number;
  happiness: number;
  cleanliness: number;
};

export type RoomItemOffset = {
  x: number;
  y: number;
};

export type PlacedToy = {
  toyId: string;
  /** Unique id per placed instance (supports multiple of the same toy). */
  instanceId: string;
  offset: RoomItemOffset;
};

export type PlacedDecoration = {
  decorationId: string;
  /** Unique id per placed instance (supports multiple of the same decoration). */
  instanceId: string;
  offset: RoomItemOffset;
  /** Sprite variant when the decoration has rotation options. */
  rotationIndex?: number;
  /** Mirror horizontally for the opposite isometric wall (windows). */
  wallFlipped?: boolean;
  /** Display scale multiplier (default 1). */
  scale?: number;
};

/** Draw order for bed, placed decor, and toys (pet stays on top). */
export type RoomLayerItem =
  | { kind: "bed" }
  | { kind: "decoration"; decorationId: string; instanceId: string }
  | { kind: "toy"; toyId: string; instanceId: string };

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
  /** Owned room background for cat pets (`room1` default). */
  roomId?: string;
  /** Normalized offset from room center (-1..1). */
  roomPetOffset?: { x: number; y: number };
  /** Equipped bed in the cat room (`brown`, `green`, …). */
  bedId?: string;
  /** Normalized offset for the equipped bed (-1..1). */
  roomBedOffset?: { x: number; y: number };
  /** Toys currently placed in the cat room. */
  placedToys?: PlacedToy[];
  /** Decorations currently placed in the cat room. */
  placedDecorations?: PlacedDecoration[];
  /** Bottom-to-top draw order for room furniture (pet renders above this). */
  roomLayerOrder?: RoomLayerItem[];
  /** Cat fur color (`orange`, `grey`, `white`). */
  catSkinId?: string;
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
  /** Consecutive puzzle answers answered correctly (resets on a wrong answer). */
  puzzleStreak: number;
  puzzlesSolved: PuzzleProgress;
  lives: LivesState;
  /** Puzzle ids with a permanently unlocked visual help. */
  visualHelpsUnlocked: string[];
  /** Cat room backgrounds the player owns (`room1` is always included). */
  roomsUnlocked: string[];
  /** Cat beds the player owns. */
  bedsUnlocked: string[];
  /** Cat toys the player owns. */
  toysUnlocked: string[];
  /** How many of each toy type the player has purchased. */
  toyQuantities?: Record<string, number>;
  /** Room decorations the player owns. */
  decorationsUnlocked: string[];
  /** How many of each decoration type the player has purchased. */
  decorationQuantities?: Record<string, number>;
  /** Cat fur colors the player owns. */
  skinsUnlocked: string[];
};
