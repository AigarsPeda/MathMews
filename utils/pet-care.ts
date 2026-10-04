import {
  HAPPINESS_DECAY_LOW_HUNGER_PER_HOUR,
  HAPPINESS_DECAY_PER_HOUR,
  HUNGER_DECAY_PER_HOUR,
  HUNGER_SPEECH_FULLNESS_MAX,
  LOW_HUNGER_THRESHOLD,
} from "@/constants/game";
import type { PetProfile, PetStats } from "@/types/game";

const MS_PER_HOUR = 60 * 60 * 1000;

export function clampStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function isStatMax(value: number): boolean {
  return value >= 100;
}

export function boostStat(current: number, amount: number): number {
  return Math.max(0, Math.min(100, current + amount));
}

export function isHungerMax(stats: PetStats): boolean {
  return isStatMax(stats.hunger);
}

/** True when the pet needs food (fullness is low). */
export function isPetHungry(stats: PetStats): boolean {
  return stats.hunger <= HUNGER_SPEECH_FULLNESS_MAX;
}

/** Feed has an effect unless hunger is already full (asleep pets can always be woken). */
export function canFeedForEffect(stats: PetStats, isAsleep: boolean): boolean {
  return isAsleep || !isHungerMax(stats);
}

export function applyPetTimeDecay(
  pet: PetProfile,
  now = Date.now(),
): PetProfile {
  const elapsedMs = now - pet.lastCareAt;
  if (elapsedMs <= 0) {
    return pet;
  }

  const hours = Math.min(elapsedMs / MS_PER_HOUR, 6);
  const hunger = Math.max(0, Math.min(100, pet.stats.hunger - HUNGER_DECAY_PER_HOUR * hours));

  let happinessLoss = HAPPINESS_DECAY_PER_HOUR * hours;
  const hoursUntilLow = Math.max(0, (pet.stats.hunger - LOW_HUNGER_THRESHOLD) / HUNGER_DECAY_PER_HOUR);
  happinessLoss += HAPPINESS_DECAY_LOW_HUNGER_PER_HOUR * Math.max(0, hours - hoursUntilLow);

  return {
    ...pet,
    lastCareAt: now,
    stats: {
      ...pet.stats,
      hunger,
      happiness: Math.max(0, Math.min(100, pet.stats.happiness - happinessLoss)),
    },
  };
}

export function withPetCareUpdate(
  pet: PetProfile,
  update: (stats: PetStats) => PetStats,
  now = Date.now(),
): PetProfile {
  const decayed = applyPetTimeDecay(pet, now);
  return {
    ...decayed,
    lastCareAt: now,
    stats: update(decayed.stats),
  };
}
