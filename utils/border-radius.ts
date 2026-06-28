/** Concentric corner radius for a box nested inside a padded rounded container. */
export function nestedBorderRadius(outerRadius: number, inset: number): number {
  return Math.max(0, outerRadius - inset);
}
