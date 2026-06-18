import type { PetMood, PetProfile } from '@/types/game';

const LOW_STAT_THRESHOLD = 30;
const SLEEPING_HUNGER_THRESHOLD = 25;
const SLEEPING_HAPPINESS_THRESHOLD = 35;

export function derivePetMood(pet: PetProfile): PetMood {
  const { stats } = pet;

  if (
    stats.hunger < SLEEPING_HUNGER_THRESHOLD &&
    stats.happiness < SLEEPING_HAPPINESS_THRESHOLD
  ) {
    return 'sleeping';
  }
  if (stats.hunger < LOW_STAT_THRESHOLD || stats.happiness < LOW_STAT_THRESHOLD) {
    return 'sad';
  }
  return 'idle';
}

export function usePetMood(pet: PetProfile): PetMood {
  return derivePetMood(pet);
}
