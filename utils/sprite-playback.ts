/** Deterministic eight-frame UI strip playback, capped after slow frames. */
export function advanceSpritePlayback(
  frame: number, elapsed: number, delta: number, frameCount: number, fps: number,
) {
  "worklet";
  elapsed += Math.min(delta, 100);
  const frameMs = 1000 / fps;
  while (elapsed + 1e-7 >= frameMs) {
    frame = (frame + 1) % frameCount;
    elapsed = Math.max(0, elapsed - frameMs);
  }
  return { frame, elapsed };
}
