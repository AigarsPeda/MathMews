/** Three Blender box-play clips, chained by the pet engine. */
export const BOX_PLAY_ANIMATION_IDS = ["box2", "box1", "box3"] as const;

export type BoxPlayAnimationId = (typeof BOX_PLAY_ANIMATION_IDS)[number];

/** Long box2 bookends with shuffled shorter clips in the middle. */
export function buildBoxPlaySequence(): BoxPlayAnimationId[] {
  const middle =
    Math.random() < 0.5
      ? (["box1", "box3"] as const)
      : (["box3", "box1"] as const);
  return ["box2", middle[0], middle[1], "box2"];
}
