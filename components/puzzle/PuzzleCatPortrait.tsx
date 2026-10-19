import { PetDisplay } from "@/pet-display/components/PetDisplay";
import { createPuzzleReactionSegment } from "@/pet-display/registry/cat-model-registry";
import type { PuzzleCatReaction } from "@/constants/puzzle-cat-reactions";
import type { PetAnimationState, PetType } from "@/types/game";
import { moderateScale } from "@/utils/scale";
import { useMemo, useState } from "react";
import { View } from "react-native";

type Props = { petType: PetType; catSkinId?: string; mood: PetAnimationState; reaction?: PuzzleCatReaction; size: number };

/** A single performance followed by idle. Callers key each new result/attempt. */
export function PuzzleCatPortrait({ petType, catSkinId, mood, reaction, size }: Props) {
  const [finished, setFinished] = useState(false);
  const playback = useMemo(() => petType === "cat" && reaction && !finished
    ? { kind: "segment" as const, segment: createPuzzleReactionSegment(reaction), mood }
    : undefined, [petType, reaction, finished, mood]);
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <PetDisplay petType={petType} catSkinId={catSkinId} mood={finished ? "idle" : mood}
      playback={playback}
      width={moderateScale(size)} onAnimationComplete={() => setFinished(true)} transparentBackground />
  </View>;
}
