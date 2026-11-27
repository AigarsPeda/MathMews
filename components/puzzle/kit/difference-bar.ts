import { Shape } from '@/constants/puzzle-theme';

/** Fit a legible difference between two labelled pieces within the entry bar. */
export function differenceBarWidths(width: number, total: number, target: number, attempt: number) {
  const space = Math.max(0, width - 2 * Shape.space.seam);
  const minimumSide = Math.min(56, Math.max(0, (space - 44) / 2));
  const delta = Math.min(space - 2 * minimumSide, Math.max(44, space * Math.abs(target - attempt) / total));
  const cut = (width - Shape.space.seam) * target / total;
  const left = Math.max(minimumSide, Math.min(space - delta - minimumSide,
    attempt < target ? cut - delta - Shape.space.seam : cut));
  return { left, delta, right: space - left - delta };
}
