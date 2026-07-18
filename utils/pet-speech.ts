import { hasIncompletePuzzles } from "@/constants/puzzles";
import type { PetAnimationState, PetProfile, PuzzleProgress } from "@/types/game";
import type { AppLocale } from "@/types/locale";
import { isPetHungry } from "@/utils/pet-care";

const PET_TAP_KEYS = [
  "pet.speech.petTap1",
  "pet.speech.petTap2",
  "pet.speech.petTap3",
] as const;

const QUIET_SPEECH_KEYS = new Set(["pet.speech.idle", "pet.speech.happy"]);

export type PetTapSpeechKey = (typeof PET_TAP_KEYS)[number];

export type IdleSpeechContext = {
  pet: PetProfile;
  mood: PetAnimationState;
  locale: AppLocale;
  puzzlesSolved: PuzzleProgress;
  puzzleStreak: number;
};

export type IdleSpeech = {
  key: string;
  params?: Record<string, number>;
};

export function pickPetTapSpeechKey(): PetTapSpeechKey {
  const index = Math.floor(Math.random() * PET_TAP_KEYS.length);
  return PET_TAP_KEYS[index] ?? PET_TAP_KEYS[0];
}

export function getIdleSpeech({
  pet,
  mood,
  locale,
  puzzlesSolved,
}: IdleSpeechContext): IdleSpeech {
  if (pet.isAsleep || mood === "sleeping") {
    return { key: "pet.speech.sleeping" };
  }
  if (mood === "fallingAsleep") {
    return { key: "pet.speech.sleepy" };
  }
  if (pet.stats.happiness < 30) {
    return { key: "pet.speech.sad" };
  }
  if (isPetHungry(pet.stats)) {
    return { key: "pet.speech.hungry" };
  }
  if (hasIncompletePuzzles(locale, puzzlesSolved)) {
    return { key: "pet.speech.solvePuzzles" };
  }
  if (pet.stats.happiness >= 80) {
    return { key: "pet.speech.happy" };
  }
  return { key: "pet.speech.idle" };
}

export function shouldShowContextualSpeech(context: IdleSpeechContext): boolean {
  return !QUIET_SPEECH_KEYS.has(getIdleSpeech(context).key);
}

export function getContextualSpeechMessage(
  context: IdleSpeechContext,
  translate: (key: string, params?: Record<string, unknown>) => string,
): string | null {
  const { key, params } = getIdleSpeech(context);
  if (QUIET_SPEECH_KEYS.has(key)) {
    return null;
  }

  return translate(key, { name: context.pet.name, ...params });
}
