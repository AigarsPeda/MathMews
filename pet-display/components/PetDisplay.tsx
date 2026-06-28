import { PetSpriteRenderer } from "@/pet-display/media/sprite/PetSpriteRenderer";
import { PetVideoRenderer } from "@/pet-display/media/video/PetVideoRenderer";
import { resolveCatSkinId, type CatSkinId } from "@/constants/cat-skins";
import { getPetMediaRegistry } from "@/pet-display/registry/dog-video-registry";
import type {
  PetAnimationState,
  PetPlaybackState,
  PetType,
} from "@/pet-display/types";
import { moderateScale } from "@/utils/scale";
import { useMemo } from "react";

type PetDisplayProps = {
  width?: number;
  loop?: boolean;
  transparentBackground?: boolean;
  petType: PetType;
  catSkinId?: CatSkinId | string;
  /** Convenience — builds a single-segment playback from a mood. */
  mood?: PetAnimationState;
  playback?: PetPlaybackState;
  onPress?: () => void;
  onAnimationComplete?: () => void;
  onStepComplete?: (stepIndex: number) => void;
};

export function PetDisplay({
  mood,
  petType,
  catSkinId,
  playback,
  onPress,
  onStepComplete,
  onAnimationComplete,
  loop = false,
  transparentBackground = false,
  width = moderateScale(200),
}: PetDisplayProps) {
  const registry = getPetMediaRegistry(petType, {
    catSkinId: resolveCatSkinId(catSkinId),
  });

  const resolvedPlayback = useMemo((): PetPlaybackState => {
    if (playback) return playback;

    const resolvedMood = mood ?? "idle";
    return {
      kind: "segment",
      segment: registry.getSegment(resolvedMood),
      mood: resolvedMood,
    };
  }, [mood, playback, registry]);

  if (registry.mediaKind === "sprite") {
    if (resolvedPlayback.kind === "scenario") {
      return (
        <PetSpriteRenderer
          loop={loop}
          size={width}
          transparentBackground={transparentBackground}
          scenarioSteps={resolvedPlayback.steps}
          onAnimationComplete={onAnimationComplete}
          onStepComplete={onStepComplete}
          onPress={onPress}
        />
      );
    }

    return (
      <PetSpriteRenderer
        loop={loop}
        size={width}
        transparentBackground={transparentBackground}
        segment={resolvedPlayback.segment}
        onAnimationComplete={onAnimationComplete}
        onStepComplete={onStepComplete}
        onPress={onPress}
      />
    );
  }

  if (resolvedPlayback.kind === "scenario") {
    return (
      <PetVideoRenderer
        loop={loop}
        size={width}
        transparentBackground={transparentBackground}
        scenarioSteps={resolvedPlayback.steps}
        onAnimationComplete={onAnimationComplete}
        onStepComplete={onStepComplete}
        onPress={onPress}
      />
    );
  }

  return (
    <PetVideoRenderer
      loop={loop}
      size={width}
      transparentBackground={transparentBackground}
      segment={resolvedPlayback.segment}
      onAnimationComplete={onAnimationComplete}
      onStepComplete={onStepComplete}
      onPress={onPress}
    />
  );
}
