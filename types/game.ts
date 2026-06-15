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
};

export type Wallet = {
  coins: number;
};

export type Progress = {
  streak: number;
};
