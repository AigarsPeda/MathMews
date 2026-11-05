import type { PracticeToken } from "@/types/visual-explanation";

export const PRACTICE_BOARD_WIDTH = 300;
export const PRACTICE_BOARD_HEIGHT = 140;

/** Unscaled dimensions used by the board renderer, in board coordinates. */
export function getPracticeTokenSize(token: PracticeToken) {
  return {
    width: token.width ?? (token.shape === "plain" ? Math.max(40, token.label.length * 14) : 40),
    height: token.height ?? 36,
  };
}

/** Settled bounds after scaling about the token's center, as rendered by RN. */
export function getPracticeTokenBounds(token: PracticeToken) {
  const { width, height } = getPracticeTokenSize(token);
  const scale = Math.abs(token.scale ?? 1);
  return {
    left: token.x - width * scale / 2,
    top: token.y - height * scale / 2,
    right: token.x + width * scale / 2,
    bottom: token.y + height * scale / 2,
  };
}
