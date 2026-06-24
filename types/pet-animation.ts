import type { PetVideoKey } from "@/constants/pet-videos";

/** One playable slice of a pet video — building block for moods and scenarios. */
export type PetVideoSegment = {
  videoKey: PetVideoKey;
  loop?: boolean;
  startMs?: number;
  endMs?: number;
  /** Play the segment backwards (endMs → startMs). */
  reverse?: boolean;
};

export type PetScenarioId = "fallAsleep" | "wakeUp";

export type PetAnimationScenario = {
  id: PetScenarioId;
  label: string;
  steps: PetVideoSegment[];
};
