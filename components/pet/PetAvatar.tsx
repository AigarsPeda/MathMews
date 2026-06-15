import { PetVideoAvatar } from '@/components/pet/PetVideoAvatar';
import type { PetAnimationState } from '@/types/game';
import { moderateScale } from '@/utils/scale';

type PetAvatarProps = {
  mood: PetAnimationState;
  width?: number;
  onAnimationComplete?: () => void;
  onPress?: () => void;
};

/** Pet avatar — plays mood videos from assets/video/ */
export function PetAvatar({
  mood,
  width = moderateScale(200),
  onAnimationComplete,
  onPress,
}: PetAvatarProps) {
  return (
    <PetVideoAvatar
      mood={mood}
      size={width}
      onAnimationComplete={onAnimationComplete}
      onPress={onPress}
    />
  );
}
