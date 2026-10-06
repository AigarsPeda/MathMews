export type CatWalkAnimation = "walk" | "walkAway" | "walkToward" | "walkAwayDiagonal" | "walkTowardDiagonal";
export type CatRoomAnimation = CatWalkAnimation | "sit" | "jumpOn" | "jumpOff" | "curlUp" | "curlSleep" | "batToy" | "eating";

export const SOFA_JUMP_DURATION_MS = 900;
export const CAT_WALK_CYCLES_PER_SECOND = 2.25;
export const CAT_WALK_STRIDE_UNITS = 0.8;

export function isCatJump(animation: CatRoomAnimation | undefined) {
  return animation === "jumpOn" || animation === "jumpOff";
}

/** Match the baked crouch, airborne paws, and landing frames. */
export function getCatJumpMotion(fromY: number, toY: number, petSize: number, durationMs = SOFA_JUMP_DURATION_MS) {
  return { prepareMs: durationMs * .2, riseMs: durationMs * .25, fallMs: durationMs * .25,
    flightMs: durationMs * .5, apexY: Math.min(fromY, toY) - petSize * .13 };
}

export function isCatWalk(animation: CatRoomAnimation | undefined): animation is CatWalkAnimation {
  return animation?.startsWith("walk") ?? false;
}

/** Match the Blender camera and planted-paw travel in the 24-frame gait cycle. */
export function getCatWalkMotion(from: { x: number; y: number }, to: { x: number; y: number }, petSize: number) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const angle = Math.atan2(Math.abs(dy) / 0.28, Math.abs(dx));
  const heading = angle > Math.PI * 3 / 8 ? Math.PI / 2 : angle > Math.PI / 8 ? Math.PI / 4 : 0;
  const animation: CatWalkAnimation = heading === 0 ? "walk"
    : heading === Math.PI / 2 ? dy < 0 ? "walkAway" : "walkToward"
    : dy < 0 ? "walkAwayDiagonal" : "walkTowardDiagonal";
  const stridePixels = Math.floor(petSize * 0.9) * CAT_WALK_STRIDE_UNITS / 2.7 * Math.hypot(Math.cos(heading), 0.28 * Math.sin(heading));
  const cycles = Math.hypot(dx, dy) / Math.max(1, stridePixels);
  return { animation, facing: heading === Math.PI / 2 || dx >= 0 ? 1 : -1,
    durationMs: Math.ceil(Math.max(180, cycles / CAT_WALK_CYCLES_PER_SECOND * 1000)), cycles };
}
