import { MOOD_ANIMATION } from "@/constants/game";
import { getPetVideo } from "@/constants/pet-videos";
import type { PetAnimationState } from "@/types/game";
import type {
  PetAnimationScenario,
  PetScenarioId,
  PetVideoSegment,
} from "@/types/pet-animation";

function segmentFromMood(mood: PetAnimationState): PetVideoSegment {
  const config = getPetVideo(mood);
  return {
    videoKey: config.videoKey,
    loop: config.loop,
    startMs: config.startMs,
    endMs: config.endMs,
  };
}

export const PET_SCENARIOS: Record<PetScenarioId, PetAnimationScenario> = {
  fallAsleep: {
    id: "fallAsleep",
    label: "Getting sleepy…",
    steps: [
      {
        videoKey: "sleeping",
        loop: false,
        startMs: MOOD_ANIMATION.fallingAsleep.startMs,
        endMs: MOOD_ANIMATION.fallingAsleep.endMs,
      },
      {
        videoKey: "sleeping",
        loop: true,
        startMs: MOOD_ANIMATION.sleeping.startMs,
        endMs: MOOD_ANIMATION.sleeping.endMs,
      },
    ],
  },
  wakeUp: {
    id: "wakeUp",
    label: "Waking up…",
    steps: [
      {
        videoKey: "sleeping",
        loop: false,
        reverse: true,
        startMs: MOOD_ANIMATION.fallingAsleep.startMs,
        endMs: MOOD_ANIMATION.fallingAsleep.endMs,
      },
    ],
  },
};

export function getPetScenario(id: PetScenarioId): PetAnimationScenario {
  return PET_SCENARIOS[id];
}

export function moodToSegment(mood: PetAnimationState): PetVideoSegment {
  return segmentFromMood(mood);
}
