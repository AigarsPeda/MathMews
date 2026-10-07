type ImageEntry = { source: number; displaySize: number };

export const KITCHEN_CHAIR_DECORATION_CATALOG = {
  kitchenChairWindsor: { source: require("@/assets/3d/decoration/kitchenChairWindsor.png"), displaySize: 48 },
  kitchenChairMint: { source: require("@/assets/3d/decoration/kitchenChairMint.png"), displaySize: 48 },
  kitchenChairUpholstered: { source: require("@/assets/3d/decoration/kitchenChairUpholstered.png"), displaySize: 48 },
  kitchenChairBistro: { source: require("@/assets/3d/decoration/kitchenChairBistro.png"), displaySize: 48 },
} as const satisfies Record<string, ImageEntry>;

export const KITCHEN_ADDITION_DECORATION_CATALOG = {
  kitchenWallCabinetSage: { source: require("@/assets/3d/decoration/kitchenWallCabinetSage.png"), displaySize: 72 },
  kitchenWallCabinetOak: { source: require("@/assets/3d/decoration/kitchenWallCabinetOak.png"), displaySize: 72 },
  kitchenWallCabinetGlass: { source: require("@/assets/3d/decoration/kitchenWallCabinetGlass.png"), displaySize: 72 },
  kitchenIsland: { source: require("@/assets/3d/decoration/kitchenIsland.png"), displaySize: 88 },
  kitchenBarStoolOak: { source: require("@/assets/3d/decoration/kitchenBarStoolOak.png"), displaySize: 48 },
  kitchenBarStoolMetal: { source: require("@/assets/3d/decoration/kitchenBarStoolMetal.png"), displaySize: 48 },
  kitchenBarStoolVelvet: { source: require("@/assets/3d/decoration/kitchenBarStoolVelvet.png"), displaySize: 48 },
  kitchenMixerStand: { source: require("@/assets/3d/decoration/kitchenMixerStand.png"), displaySize: 32 },
  kitchenMixerHand: { source: require("@/assets/3d/decoration/kitchenMixerHand.png"), displaySize: 28 },
  ...KITCHEN_CHAIR_DECORATION_CATALOG,
} as const satisfies Record<string, ImageEntry>;

/** Counter stools also belong in the general Chairs section. */
export const KITCHEN_SEATING_DECORATION_CATALOG = {
  ...KITCHEN_CHAIR_DECORATION_CATALOG,
  kitchenBarStoolOak: KITCHEN_ADDITION_DECORATION_CATALOG.kitchenBarStoolOak,
  kitchenBarStoolMetal: KITCHEN_ADDITION_DECORATION_CATALOG.kitchenBarStoolMetal,
  kitchenBarStoolVelvet: KITCHEN_ADDITION_DECORATION_CATALOG.kitchenBarStoolVelvet,
} as const satisfies Record<string, ImageEntry>;

