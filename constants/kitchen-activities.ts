export function isKitchenChairDecorationId(id: string): boolean {
  return /^kitchenChair(Windsor|Mint|Upholstered|Bistro)$/.test(id);
}

export function isKitchenIslandDecorationId(id: string): boolean {
  return id === 'kitchenIsland' || /^kitchenModernIsland(White|Sage|Navy|Charcoal)$/.test(id);
}

/** Dry countertop surfaces which can support a cat watching a nearby window. */
export function isKitchenPerchDecorationId(id: string): boolean {
  return isKitchenIslandDecorationId(id) || /^kitchenModern(Counter|FloorShelf|Sink)(White|Sage|Navy|Charcoal)$/.test(id);
}
