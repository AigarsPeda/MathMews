import type { PetType } from "@/types/game";
import type { PetMediaRegistry } from "@/pet-display/types";
import { catModelRegistry } from "./cat-model-registry";
import { dogVideoRegistry } from "./dog-video-registry";
export function getPetMediaRegistry(petType: PetType): PetMediaRegistry {
  return petType === "cat" ? catModelRegistry : dogVideoRegistry;
}
