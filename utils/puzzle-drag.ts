export type PuzzleDropZone = { id: string; x: number; y: number; width: number; height: number };

export function findPuzzleDropZone(zones: readonly PuzzleDropZone[], x: number, y: number): string | null {
  "worklet";
  for (let i = zones.length - 1; i >= 0; i--) {
    const zone = zones[i];
    if (zone.width > 0 && zone.height > 0 && x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height) return zone.id;
  }
  return null;
}

/** Moving between filled gaps swaps the tiles. Dropping from the bank replaces a tile. */
export function movePatternTile(placements: readonly (number | null)[], tile: number, slot: number | null): (number | null)[] {
  if (!Number.isInteger(tile) || tile < 0 || (slot !== null && (!Number.isInteger(slot) || slot < 0 || slot >= placements.length))) return [...placements];
  const next = [...placements], previous = next.indexOf(tile);
  if (previous >= 0) next[previous] = slot === null ? null : next[slot];
  if (slot !== null) next[slot] = tile;
  return next;
}
