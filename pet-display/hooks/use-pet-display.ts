import { usePetDisplayEngine } from "@/pet-display/engine/use-pet-display-engine";
import type { PetProfile } from "@/types/game";

/** Command-driven pet display state for home / care interactions. */
export function usePetDisplay(pet: PetProfile) {
  return usePetDisplayEngine(pet);
}
