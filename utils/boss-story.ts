/** Session phase, rather than lifetime completion, drives resumed and replayed scenes. */
export function getBossSceneProgress(phase: number, correct = false) {
  const stage = Number.isFinite(phase) ? Math.max(0, Math.min(2, Math.floor(phase))) : 0;
  return stage + (correct ? 1 : 0);
}

/** One-shot playback: the last frame holds; a slow frame cannot skip the whole ending. */
export function advanceBossOutcome(elapsed: number, delta: number, frameCount = 16) {
  "worklet";
  const next = Math.min(frameCount * 125, elapsed + Math.max(0, Math.min(100, delta)));
  return { elapsed: next, frame: Math.min(frameCount - 1, Math.floor(next / 125)), finished: next >= frameCount * 125 };
}
