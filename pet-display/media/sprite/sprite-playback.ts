/** Deterministic playback used by the UI clock and asset regression checks. */
export function advanceSpritePlayback(frame: number, elapsed: number, delta: number,
  frameCount: number, fps: number, reverse: boolean, loop: boolean,
  framesPerPage: number, readyPages: readonly number[]) {
  "worklet";
  if (!readyPages.includes(Math.floor(frame / framesPerPage))) return { frame, elapsed, finished: false };
  elapsed += Math.min(delta, 100);
  const frameMs = 1000 / fps;
  while (elapsed + 1e-7 >= frameMs) {
    const candidate = frame + (reverse ? -1 : 1);
    if ((candidate < 0 || candidate >= frameCount) && !loop) return { frame, elapsed: 0, finished: true };
    const next = (candidate + frameCount) % frameCount;
    if (!readyPages.includes(Math.floor(next / framesPerPage))) return { frame, elapsed: 0, finished: false };
    frame = next;
    elapsed = Math.max(0, elapsed-frameMs);
  }
  return { frame, elapsed, finished: false };
}
