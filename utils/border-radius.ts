/** Derive a concentric inner corner from the actual edge-to-edge inset.
 * Include padding and borders in the inset, using the same (already scaled) units.
 */
export function insetRadius(outerRadius: number, inset: number): number {
  return Math.max(0, outerRadius - inset);
}
