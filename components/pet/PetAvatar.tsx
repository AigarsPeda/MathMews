import { PetVideoAvatar } from "@/components/pet/PetVideoAvatar";
import { moodToSegment } from "@/constants/pet-scenarios";
import type { PetPlaybackState } from "@/hooks/use-pet-playback";
import type { PetAnimationState } from "@/types/game";
import { moderateScale } from "@/utils/scale";

type PetAvatarProps = {
  playback?: PetPlaybackState;
  /** Convenience — builds a single-segment playback from a mood. */
  mood?: PetAnimationState;
  width?: number;
  loop?: boolean;
  onAnimationComplete?: () => void;
  onStepComplete?: (stepIndex: number) => void;
  onPress?: () => void;
};

/** Pet avatar — plays mood videos from assets/video/ */
export function PetAvatar({
  playback,
  mood,
  width = moderateScale(200),
  loop = false,
  onAnimationComplete,
  onStepComplete,
  onPress,
}: PetAvatarProps) {
  const resolvedPlayback: PetPlaybackState =
    playback ??
    (mood
      ? { kind: "segment", segment: moodToSegment(mood), mood }
      : { kind: "segment", segment: moodToSegment("idle"), mood: "idle" });

  if (resolvedPlayback.kind === "scenario") {
    return (
      <PetVideoAvatar
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
    <PetVideoAvatar
      segment={resolvedPlayback.segment}
      size={width}
      loop={loop}
      onAnimationComplete={onAnimationComplete}
      onStepComplete={onStepComplete}
      onPress={onPress}
    />
  );
}
