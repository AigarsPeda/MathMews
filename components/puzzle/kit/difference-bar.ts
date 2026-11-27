import { Shape } from '@/constants/puzzle-theme';

/** Fit a legible difference between two labelled pieces within the entry bar. */
export function differenceBarWidths(width: number, total: number, target: number, attempt: number) {
  const space = Math.max(0, width - 2 * Shape.space.seam);
  // Owner rule (2026-11-26): an amber difference is at least 56 pt, never a sliver; its label sits inside it.
  const MIN_DIFFERENCE = 56;
  const minimumSide = Math.min(56, Math.max(0, (space - MIN_DIFFERENCE) / 2));
  const delta = Math.min(space - 2 * minimumSide, Math.max(MIN_DIFFERENCE, space * Math.abs(target - attempt) / total));
  const cut = (width - Shape.space.seam) * target / total;
  const left = Math.max(minimumSide, Math.min(space - delta - minimumSide,
    attempt < target ? cut - delta - Shape.space.seam : cut));
  return { left, delta, right: space - left - delta };
}
