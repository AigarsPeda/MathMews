/** Broad-leaved plants whose individual leaves can be pawed at. */
export const PLAYABLE_PLANT_IDS = ['plantSmall', 'plantA', 'plantB', 'plantE', 'plantPotted',
  'plantTallGreen', 'plantTallPink', 'plantTallBlue', 'plantTallPurple'] as const;

export function isPlayablePlant(id: string): boolean {
  'worklet';
  return (PLAYABLE_PLANT_IDS as readonly string[]).includes(id);
}
