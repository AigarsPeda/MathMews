import clips from "@/scripts/3d/clips.json";

/** Authored frame counts and rates, shared by the exporter and native playback. */
export const CAT_ANIMATION_CLIPS = clips;
export type CatAnimationId = keyof typeof clips;
