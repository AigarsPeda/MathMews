import { PetVideoAvatar } from "@/components/pet/PetVideoAvatar";
import type { PetAnimationState } from "@/types/game";
import { moderateScale } from "@/utils/scale";

type PetAvatarProps = {
  mood: PetAnimationState;
  width?: number;
  loop?: boolean;
  onAnimationComplete?: () => void;
  onPress?: () => void;
};

/** Pet avatar — plays mood videos from assets/video/ */
export function PetAvatar({
  mood,
  width = moderateScale(200),
  loop = false,
  onAnimationComplete,
  onPress,
}: PetAvatarProps) {
  return (
    <PetVideoAvatar
      mood={mood}
      size={width}
      loop={loop}
      onAnimationComplete={onAnimationComplete}
      onPress={onPress}
    />
  );
}
