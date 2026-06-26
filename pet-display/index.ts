export { PetDisplay } from "./components/PetDisplay";
export { PetDisplayProvider } from "./PetDisplayProvider";
export { usePetDisplay } from "./hooks/use-pet-display";

export { usePetDisplayEngine } from "./engine/use-pet-display-engine";
export {
  derivePetMood,
  derivePetVideoMood,
  getLastInteractionAt,
  isPetIdleSleepy,
  isPetSleepy,
  resolveAsleepOnLoad,
  shouldPetSleep,
  usePetBaseMood,
} from "./engine/derive-mood";

export {
  dogVideoRegistry,
  getPetMediaRegistry,
  DOG_VIDEO_ASSET_KEYS,
  DOG_VIDEO_SOURCES,
  DOG_MOOD_VIDEO_ASSET_KEYS,
} from "./registry/dog-video-registry";

export type {
  PetDisplayCommand,
  PetDisplayEngine,
  PetDisplayEngineState,
  PetDisplayRenderProps,
  PetMediaKind,
  PetMediaRegistry,
  PetMediaScenario,
  PetMediaSegment,
  PetPlaybackState,
  PetScenarioId,
} from "./types";
