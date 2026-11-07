import { PetDisplay } from "@/pet-display/components/PetDisplay";
import { createPuzzleReactionSegment } from "@/pet-display/registry/cat-model-registry";
import type { PuzzleCatReaction } from "@/constants/puzzle-cat-reactions";
import type { PetAnimationState, PetType } from "@/types/game";
import { moderateScale } from "@/utils/scale";
import { useMemo, useState } from "react";
import { View } from "react-native";

type Props = { petType: PetType; catSkinId?: string; mood: PetAnimationState; reaction?: PuzzleCatReaction; size: number; brief?: boolean; replayKey?: number };

/** A single performance followed by idle. replayKey restarts it without reloading the cat. */
export function PuzzleCatPortrait({ petType, catSkinId, mood, reaction, size, brief = false, replayKey = 0 }: Props) {
  const [performance, setPerformance] = useState({ key: replayKey, finished: false });
  if (performance.key !== replayKey) setPerformance({ key: replayKey, finished: false });
  const playback = useMemo(() => petType === "cat" && reaction && !performance.finished
    ? { kind: "segment" as const, segment: createPuzzleReactionSegment(reaction, brief), mood }
    : undefined, [petType, reaction, performance, mood, brief]);
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <PetDisplay petType={petType} catSkinId={catSkinId} mood={performance.finished ? "idle" : mood}
      playback={playback}
      width={moderateScale(size)} onAnimationComplete={() => setPerformance(current => current.key === replayKey ? { ...current, finished: true } : current)} transparentBackground />
  </View>;
}
