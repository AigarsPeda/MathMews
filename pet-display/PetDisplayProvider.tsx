import { useGame } from "@/contexts/GameProvider";
import { PetVideoMediaProvider } from "@/pet-display/media/video/PetVideoMediaProvider";
import type { ReactNode } from "react";

/** Root provider for pet display media (video pool, future sprite sheets, etc.). */
export function PetDisplayProvider({ children }: { children: ReactNode }) {
  const { pet, isReady } = useGame();
  return isReady && pet.type === "dog" ? <PetVideoMediaProvider>{children}</PetVideoMediaProvider> : <>{children}</>;
}
