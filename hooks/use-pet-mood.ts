import { MOOD_ANIMATION } from "@/constants/game";
import type { PetAnimationState, PetMood, PetProfile } from "@/types/game";
import { isPetHungry } from "@/utils/pet-care";
import { useCallback, useEffect, useMemo, useState } from "react";

const LOW_STAT_THRESHOLD = 30;
const SLEEPING_HUNGER_THRESHOLD = 25;
const SLEEPING_HAPPINESS_THRESHOLD = 35;

const SLEEP_SKIP_INTRO_MS =
  MOOD_ANIMATION.sleeping.skipIntroAfterAwayMs ?? 30 * 60 * 1000;

const IDLE_ASLEEP_MS =
  MOOD_ANIMATION.sleeping.idleAsleepMs ?? SLEEP_SKIP_INTRO_MS;

export function getLastInteractionAt(pet: PetProfile): number {
  return pet.lastInteractionAt ?? pet.lastCareAt;
}

export function isPetSleepy(pet: PetProfile): boolean {
  const { stats } = pet;
  return (
    stats.hunger < SLEEPING_HUNGER_THRESHOLD &&
    stats.happiness < SLEEPING_HAPPINESS_THRESHOLD
  );
}

export function isPetIdleSleepy(pet: PetProfile, now = Date.now()): boolean {
  return now - getLastInteractionAt(pet) >= IDLE_ASLEEP_MS;
}

export function shouldPetSleep(pet: PetProfile, now = Date.now()): boolean {
  // Hungry pets stay awake — low fullness shows as sad, not sleep.
  if (isPetHungry(pet.stats)) {
    return false;
  }
  return isPetSleepy(pet) || isPetIdleSleepy(pet, now);
}

/**
 * After time away: mark asleep so reopen skips the lie-down intro.
 * While the app stays open, idle sleep plays the lie-down intro first.
 */
export function resolveAsleepOnLoad(
  pet: PetProfile,
  awayMs: number,
  now = Date.now(),
): PetProfile {
  if (!shouldPetSleep(pet, now)) {
    return { ...pet, isAsleep: false };
  }
  const wasAsleep = pet.isAsleep === true;
  const longAbsence = awayMs >= SLEEP_SKIP_INTRO_MS;
  return { ...pet, isAsleep: wasAsleep || longAbsence };
}

export function derivePetMood(pet: PetProfile, now = Date.now()): PetMood {
  const { stats } = pet;

  if (shouldPetSleep(pet, now)) {
    return "sleeping";
  }

  if (isPetHungry(stats) || stats.happiness < LOW_STAT_THRESHOLD) {
    return "sad";
  }

  return "idle";
}

/** Picks lie-down intro vs asleep loop clip from sleeping.mp4. */
export function derivePetVideoMood(
  pet: PetProfile,
  fallAsleepDone: boolean,
  now = Date.now(),
): PetAnimationState {
  if (pet.isAsleep) {
    return "sleeping";
  }

  if (!shouldPetSleep(pet, now)) {
    return derivePetMood(pet, now);
  }

  if (fallAsleepDone) {
    return "sleeping";
  }

  return "fallingAsleep";
}

export function usePetMood(pet: PetProfile): PetMood {
  return derivePetMood(pet);
}

export function usePetVideoMood(pet: PetProfile) {
  const [fallAsleepDone, setFallAsleepDone] = useState(pet.isAsleep === true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (pet.isAsleep === true) {
      setFallAsleepDone(true);
      return;
    }
    if (!shouldPetSleep(pet, now)) {
      setFallAsleepDone(false);
    }
  }, [
    pet.isAsleep,
    pet.lastInteractionAt,
    pet.stats.hunger,
    pet.stats.happiness,
    now,
  ]);

  const mood = useMemo(
    () => derivePetVideoMood(pet, fallAsleepDone, now),
    [pet, fallAsleepDone, now],
  );

  const onFallAsleepComplete = useCallback(() => {
    if (shouldPetSleep(pet)) {
      setFallAsleepDone(true);
    }
  }, [pet]);

  return { mood, onFallAsleepComplete };
}
