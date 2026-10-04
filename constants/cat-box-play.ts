/** Jump and hide, peek and hide, then emerge and settle. */
export const BOX_PLAY_ANIMATION_IDS = ["box1", "box2", "box3"] as const;

export type BoxPlayAnimationId = (typeof BOX_PLAY_ANIMATION_IDS)[number];

export function buildBoxPlaySequence(): BoxPlayAnimationId[] {
  return [...BOX_PLAY_ANIMATION_IDS];
}
