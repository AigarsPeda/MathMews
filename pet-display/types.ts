import type {
  PetAnimationState,
  PetMood,
  PetProfile,
  PetType,
} from "@/types/game";

export type PetMediaSegment = {
  assetKey: string;
  loop?: boolean;
  startMs?: number;
  endMs?: number;
  /** Play the segment backwards (endMs → startMs). Native models and videos. */
  reverse?: boolean;
  model?: { duration: number; rate: number };
};

export type PetScenarioId = "fallAsleep" | "wakeUp" | "standUp" | "playBox";

export type BuiltInPetScenarioId = Exclude<PetScenarioId, "playBox">;

export type PetMediaScenario = {
  id: PetScenarioId;
  label: string;
  steps: PetMediaSegment[];
};

export type PetPlaybackState =
  | {
      kind: "scenario";
      scenario: PetMediaScenario;
      steps: PetMediaSegment[];
    }
  | { kind: "segment"; segment: PetMediaSegment; mood: PetAnimationState };

/** Commands sent to the pet display engine from game screens. */
export type PetDisplayCommand =
  | { type: "petTap"; wasAsleep: boolean }
  | { type: "playAction"; wasAsleep: boolean; mood: PetAnimationState }
  | { type: "feed"; wasAsleep: boolean }
  | { type: "beginCareAction" }
  | { type: "playReaction"; mood: PetAnimationState }
  | { type: "animationComplete"; completedMood: PetAnimationState };

export type PetMediaKind = "video" | "model";

export type PetMediaRegistry = {
  petType: PetType;
  mediaKind: PetMediaKind;
  oneShotStates: readonly PetAnimationState[];
  pickExcitedMood: () => PetAnimationState;
  getSegment: (state: PetAnimationState) => PetMediaSegment;
  getScenario: (id: BuiltInPetScenarioId) => PetMediaScenario;
};

export type PetDisplayEngineState = {
  playback: PetPlaybackState;
  baseMood: PetAnimationState;
  displayLabel: string;
  isCareBlocked: boolean;
  isCareAnimationPlaying: boolean;
};

export type PetDisplayEngine = PetDisplayEngineState & {
  send: (command: PetDisplayCommand) => void;
};

/** Snapshot passed to renderers — keeps pet type for registry lookup. */
export type PetDisplayRenderProps = {
  pet: PetProfile;
  playback: PetPlaybackState;
  width: number;
  loop?: boolean;
  onPress?: () => void;
  onAnimationComplete?: () => void;
  onStepComplete?: (stepIndex: number) => void;
};

export type { PetAnimationState, PetMood, PetProfile, PetType };
