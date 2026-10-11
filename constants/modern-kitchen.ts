type ImageEntry = { source: number; displaySize: number };

/** Matching modular pieces share cabinet finishes and stone worktops. */
export const MODERN_KITCHEN_DECORATION_CATALOG = {
  kitchenModernFloorShelfWhite: { source: require("@/assets/3d/decoration/kitchenModernFloorShelfWhite.png"), displaySize: 60.100178 },
  kitchenModernFloorShelfSage: { source: require("@/assets/3d/decoration/kitchenModernFloorShelfSage.png"), displaySize: 60.100178 },
  kitchenModernFloorShelfNavy: { source: require("@/assets/3d/decoration/kitchenModernFloorShelfNavy.png"), displaySize: 60.100178 },
  kitchenModernFloorShelfCharcoal: { source: require("@/assets/3d/decoration/kitchenModernFloorShelfCharcoal.png"), displaySize: 60.100178 },
  kitchenModernSinkWhite: { source: require("@/assets/3d/decoration/kitchenModernSinkWhite.png"), displaySize: 74.466031 },
  kitchenModernSinkSage: { source: require("@/assets/3d/decoration/kitchenModernSinkSage.png"), displaySize: 74.466031 },
  kitchenModernSinkNavy: { source: require("@/assets/3d/decoration/kitchenModernSinkNavy.png"), displaySize: 74.466031 },
  kitchenModernSinkCharcoal: { source: require("@/assets/3d/decoration/kitchenModernSinkCharcoal.png"), displaySize: 74.466031 },
  kitchenModernCounterWhite: { source: require("@/assets/3d/decoration/kitchenModernCounterWhite.png"), displaySize: 72 },
  kitchenModernCounterSage: { source: require("@/assets/3d/decoration/kitchenModernCounterSage.png"), displaySize: 72 },
  kitchenModernCounterNavy: { source: require("@/assets/3d/decoration/kitchenModernCounterNavy.png"), displaySize: 72 },
  kitchenModernCounterCharcoal: { source: require("@/assets/3d/decoration/kitchenModernCounterCharcoal.png"), displaySize: 72 },
  kitchenModernInductionWhite: { source: require("@/assets/3d/decoration/kitchenModernInductionWhite.png"), displaySize: 72 },
  kitchenModernInductionSage: { source: require("@/assets/3d/decoration/kitchenModernInductionSage.png"), displaySize: 72 },
  kitchenModernInductionNavy: { source: require("@/assets/3d/decoration/kitchenModernInductionNavy.png"), displaySize: 72 },
  kitchenModernInductionCharcoal: { source: require("@/assets/3d/decoration/kitchenModernInductionCharcoal.png"), displaySize: 72 },
  kitchenModernWallCabinetWhite: { source: require("@/assets/3d/decoration/kitchenModernWallCabinetWhite.png"), displaySize: 54.4 },
  kitchenModernWallCabinetSage: { source: require("@/assets/3d/decoration/kitchenModernWallCabinetSage.png"), displaySize: 54.4 },
  kitchenModernWallCabinetNavy: { source: require("@/assets/3d/decoration/kitchenModernWallCabinetNavy.png"), displaySize: 54.4 },
  kitchenModernWallCabinetCharcoal: { source: require("@/assets/3d/decoration/kitchenModernWallCabinetCharcoal.png"), displaySize: 54.4 },
  kitchenModernShelfWhite: { source: require("@/assets/3d/decoration/kitchenModernShelfWhite.png"), displaySize: 56 },
  kitchenModernShelfSage: { source: require("@/assets/3d/decoration/kitchenModernShelfSage.png"), displaySize: 56 },
  kitchenModernShelfNavy: { source: require("@/assets/3d/decoration/kitchenModernShelfNavy.png"), displaySize: 56 },
  kitchenModernShelfCharcoal: { source: require("@/assets/3d/decoration/kitchenModernShelfCharcoal.png"), displaySize: 56 },
  kitchenModernFridgeWhite: { source: require("@/assets/3d/decoration/kitchenModernFridgeWhite.png"), displaySize: 105.448774 },
  kitchenModernFridgeSage: { source: require("@/assets/3d/decoration/kitchenModernFridgeSage.png"), displaySize: 105.448774 },
  kitchenModernFridgeNavy: { source: require("@/assets/3d/decoration/kitchenModernFridgeNavy.png"), displaySize: 105.448774 },
  kitchenModernFridgeCharcoal: { source: require("@/assets/3d/decoration/kitchenModernFridgeCharcoal.png"), displaySize: 105.448774 },
  kitchenModernIslandWhite: { source: require("@/assets/3d/decoration/kitchenModernIslandWhite.png"), displaySize: 98.027031 },
  kitchenModernIslandSage: { source: require("@/assets/3d/decoration/kitchenModernIslandSage.png"), displaySize: 98.027031 },
  kitchenModernIslandNavy: { source: require("@/assets/3d/decoration/kitchenModernIslandNavy.png"), displaySize: 98.027031 },
  kitchenModernIslandCharcoal: { source: require("@/assets/3d/decoration/kitchenModernIslandCharcoal.png"), displaySize: 98.027031 },
} as const satisfies Record<string, ImageEntry>;

export type ModernKitchenDecorationId = keyof typeof MODERN_KITCHEN_DECORATION_CATALOG;

export const MODERN_KITCHEN_DECORATION_IDS = Object.keys(
  MODERN_KITCHEN_DECORATION_CATALOG,
) as ModernKitchenDecorationId[];

export const MODERN_KITCHEN_COUNTER_IDS: readonly ModernKitchenDecorationId[] = [
  "kitchenModernCounterWhite", "kitchenModernCounterSage", "kitchenModernCounterNavy", "kitchenModernCounterCharcoal",
];

export const MODERN_KITCHEN_FLOOR_SHELF_IDS: readonly ModernKitchenDecorationId[] = [
  "kitchenModernFloorShelfWhite", "kitchenModernFloorShelfSage", "kitchenModernFloorShelfNavy", "kitchenModernFloorShelfCharcoal",
];

export const MODERN_KITCHEN_SINK_IDS: readonly ModernKitchenDecorationId[] = [
  "kitchenModernSinkWhite", "kitchenModernSinkSage", "kitchenModernSinkNavy", "kitchenModernSinkCharcoal",
];

export const MODERN_KITCHEN_INDUCTION_IDS: readonly ModernKitchenDecorationId[] = [
  "kitchenModernInductionWhite", "kitchenModernInductionSage", "kitchenModernInductionNavy", "kitchenModernInductionCharcoal",
];

export const MODERN_KITCHEN_STORAGE_IDS: readonly ModernKitchenDecorationId[] = [
  "kitchenModernWallCabinetWhite", "kitchenModernWallCabinetSage", "kitchenModernWallCabinetNavy", "kitchenModernWallCabinetCharcoal",
  "kitchenModernShelfWhite", "kitchenModernShelfSage", "kitchenModernShelfNavy", "kitchenModernShelfCharcoal",
];

const WALL_IDS = new Set<string>(MODERN_KITCHEN_STORAGE_IDS);

export function isModernKitchenWallDecoration(id: string): boolean {
  return WALL_IDS.has(id);
}

export const MODERN_KITCHEN_FRIDGE_IDS: readonly ModernKitchenDecorationId[] = [
  "kitchenModernFridgeWhite", "kitchenModernFridgeSage", "kitchenModernFridgeNavy", "kitchenModernFridgeCharcoal",
];

export const MODERN_KITCHEN_ISLAND_IDS: readonly ModernKitchenDecorationId[] = [
  "kitchenModernIslandWhite", "kitchenModernIslandSage", "kitchenModernIslandNavy", "kitchenModernIslandCharcoal",
];
