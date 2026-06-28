import {
  HAPPINESS_DECAY_LOW_HUNGER_PER_HOUR,
  HAPPINESS_DECAY_PER_HOUR,
  HUNGER_DECAY_PER_HOUR,
  HUNGER_SPEECH_FULLNESS_MAX,
  LOW_HUNGER_THRESHOLD,
} from "@/constants/game";
import type { PetProfile, PetStats } from "@/types/game";

const MS_PER_HOUR = 60 * 60 * 1000;
const MIN_DECAY_MS = 30_000;

export function clampStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function isStatMax(value: number): boolean {
  return value >= 100;
}

export function boostStat(current: number, amount: number): number {
  return isStatMax(current) ? current : clampStat(current + amount);
}

export function isHappinessMax(stats: PetStats): boolean {
  return isStatMax(stats.happiness);
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

/** Box play helps when happiness can still rise (asleep pets can always be woken). */
export function canPlayBoxForEffect(stats: PetStats, isAsleep: boolean): boolean {
  return isAsleep || !isHappinessMax(stats);
}

export function applyPetTimeDecay(
  pet: PetProfile,
  now = Date.now(),
): PetProfile {
  const elapsedMs = now - pet.lastCareAt;
  if (elapsedMs < MIN_DECAY_MS) {
    return pet;
  }

  const hours = elapsedMs / MS_PER_HOUR;
  const hunger = clampStat(pet.stats.hunger - HUNGER_DECAY_PER_HOUR * hours);

  let happinessLoss = HAPPINESS_DECAY_PER_HOUR * hours;
  if (hunger < LOW_HUNGER_THRESHOLD) {
    happinessLoss += HAPPINESS_DECAY_LOW_HUNGER_PER_HOUR * hours;
  }

  return {
    ...pet,
    lastCareAt: now,
    stats: {
      ...pet.stats,
      hunger,
      happiness: clampStat(pet.stats.happiness - happinessLoss),
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
