import { PetVideoRenderer } from "@/pet-display/media/video/PetVideoRenderer";
import { getPetMediaRegistry } from "@/pet-display/registry/dog-video-registry";
import type {
  PetAnimationState,
  PetPlaybackState,
  PetType,
} from "@/pet-display/types";
import { moderateScale } from "@/utils/scale";
import { useMemo } from "react";

type PetDisplayProps = {
  petType: PetType;
  playback?: PetPlaybackState;
  /** Convenience — builds a single-segment playback from a mood. */
  mood?: PetAnimationState;
  width?: number;
  loop?: boolean;
  onAnimationComplete?: () => void;
  onStepComplete?: (stepIndex: number) => void;
  onPress?: () => void;
};

export function PetDisplay({
  petType,
  playback,
  mood,
  width = moderateScale(200),
  loop = false,
  onAnimationComplete,
  onStepComplete,
  onPress,
}: PetDisplayProps) {
  const registry = getPetMediaRegistry(petType);

  const resolvedPlayback = useMemo((): PetPlaybackState => {
    if (playback) return playback;

    const resolvedMood = mood ?? "idle";
    return {
      kind: "segment",
      segment: registry.getSegment(resolvedMood),
      mood: resolvedMood,
    };
  }, [mood, playback, registry]);

  if (registry.mediaKind === "video") {
    if (resolvedPlayback.kind === "scenario") {
      return (
        <PetVideoRenderer
          scenarioSteps={resolvedPlayback.steps}
          size={width}
          loop={loop}
          onAnimationComplete={onAnimationComplete}
          onStepComplete={onStepComplete}
          onPress={onPress}
        />
      );
    }

    return (
      <PetVideoRenderer
        segment={resolvedPlayback.segment}
        size={width}
        loop={loop}
        onAnimationComplete={onAnimationComplete}
        onStepComplete={onStepComplete}
        onPress={onPress}
      />
    );
  }

  return null;
}
