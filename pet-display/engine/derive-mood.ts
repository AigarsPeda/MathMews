import { MOOD_ANIMATION } from "@/constants/game";
import { worldClockReading, type WorldClock } from '@/utils/world-clock';
import { useWorldClockNow } from '@/hooks/use-world-clock-now';
import type { PetAnimationState, PetMood, PetProfile } from "@/types/game";
import { isPetHungry } from "@/utils/pet-care";
import { useCallback, useMemo, useState } from "react";

const LOW_STAT_THRESHOLD = 30;
export const IDLE_REST_MS = 3 * 60 * 1000;
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

export function shouldPetSleep(pet: PetProfile, now = Date.now(), night?: boolean): boolean {
  if (isPetHungry(pet.stats)) {
    return false;
  }
  if (pet.type === 'cat' && night !== undefined) {
    return night && now - getLastInteractionAt(pet) >= 60_000;
  }
  return isPetSleepy(pet) || isPetIdleSleepy(pet, now);
}

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

export function derivePetMood(pet: PetProfile, now = Date.now(), night?: boolean): PetMood {
  const { stats } = pet;

  if (shouldPetSleep(pet, now, night)) {
    return "sleeping";
  }

  if (isPetHungry(stats) || stats.happiness < LOW_STAT_THRESHOLD) {
    return "sad";
  }

  if (pet.type === "cat" && night !== false && now - getLastInteractionAt(pet) >= (night ? 30_000 : IDLE_REST_MS)) return "resting";
  return "idle";
}

export function derivePetVideoMood(
  pet: PetProfile,
  fallAsleepDone: boolean,
  now = Date.now(),
  lieDownDone = false,
  night?: boolean,
): PetAnimationState {
  // Clock-driven sleep ends at dawn, including an old saved sleeping flag.
  if (pet.isAsleep && (pet.type !== 'cat' || night === undefined || night && !isPetHungry(pet.stats))) {
    return "sleeping";
  }

  const base = derivePetMood(pet, now, night);
  if (pet.type === "cat" && (base === "resting" || base === "sleeping")) {
    if (!lieDownDone) return "lyingDown";
    if (base === "resting") return "resting";
  }
  if (!shouldPetSleep(pet, now, night)) return base;

  if (fallAsleepDone) {
    return "sleeping";
  }

  return "fallingAsleep";
}

export function usePetBaseMood(pet: PetProfile, clock?: WorldClock) {
  const now = useWorldClockNow(clock ? 5000 : 30_000);
  const night = clock ? worldClockReading(clock, now).period === 'night' : undefined;
  const interactionAt = getLastInteractionAt(pet);
  const asleep = pet.isAsleep === true && (pet.type !== 'cat' || night !== false);
  const [phase, setPhase] = useState(() => ({
    interactionAt, asleep, night, lieDownDone: asleep, fallAsleepDone: asleep,
  }));
  // Reset transitions for a new interaction, rather than every stat-decay tick.
  if (phase.interactionAt !== interactionAt || phase.asleep !== asleep || phase.night !== night) {
    setPhase({ interactionAt, asleep, night, lieDownDone: asleep, fallAsleepDone: asleep });
  }
  const mood = useMemo(
    () => derivePetVideoMood(pet, phase.fallAsleepDone, now, phase.lieDownDone, night),
    [pet, phase.fallAsleepDone, phase.lieDownDone, now, night],
  );
  const onFallAsleepComplete = useCallback(() => {
    if (shouldPetSleep(pet, Date.now(), night)) setPhase(current => current.interactionAt === interactionAt
      ? { ...current, fallAsleepDone: true } : current);
  }, [pet, interactionAt, night]);
  const onLieDownComplete = useCallback(() => {
    setPhase(current => current.interactionAt === interactionAt
      ? { ...current, lieDownDone: true } : current);
  }, [interactionAt]);
  return { mood, onFallAsleepComplete, onLieDownComplete };
}
