import { usePetDisplayEngine } from "@/pet-display/engine/use-pet-display-engine";
import type { PetProfile } from "@/types/game";
import type { WorldClock } from '@/utils/world-clock';

/** Command-driven pet display state for home / care interactions. */
export function usePetDisplay(pet: PetProfile, clock?: WorldClock) {
  return usePetDisplayEngine(pet, clock);
}
