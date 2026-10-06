import { useGame } from "@/contexts/GameProvider";
import { PetVideoMediaProvider } from "@/pet-display/media/video/PetVideoMediaProvider";
import type { ReactNode } from "react";

/** Mount the dog video pool only when the selected companion needs it. */
export function PetDisplayProvider({ children }: { children: ReactNode }) {
  const { pet, isReady } = useGame();
  return isReady && pet.type === "dog" ? <PetVideoMediaProvider>{children}</PetVideoMediaProvider> : <>{children}</>;
}
