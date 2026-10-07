import { KITCHEN_ADDITION_DECORATION_CATALOG } from "@/constants/kitchen-additions";
type ImageEntry = { source: number; displaySize: number };

export const KITCHEN_DECORATION_CATALOG = {
  ...KITCHEN_ADDITION_DECORATION_CATALOG,
  kitchenFridge: { source: require("@/assets/3d/decoration/kitchenFridge.png"), displaySize: 72 },
  kitchenRange: { source: require("@/assets/3d/decoration/kitchenRange.png"), displaySize: 64 },
  kitchenSinkCabinet: { source: require("@/assets/3d/decoration/kitchenSinkCabinet.png"), displaySize: 72 },
  kitchenDiningTable: { source: require("@/assets/3d/decoration/kitchenDiningTable.png"), displaySize: 72 },
  kitchenMicrowave: { source: require("@/assets/3d/decoration/kitchenMicrowave.png"), displaySize: 36 },
  kitchenBreadBasket: { source: require("@/assets/3d/decoration/kitchenBreadBasket.png"), displaySize: 28 },
} as const satisfies Record<string, ImageEntry>;

export const KITCHEN_DECORATION_IDS = Object.keys(KITCHEN_DECORATION_CATALOG) as (keyof typeof KITCHEN_DECORATION_CATALOG)[];

export const BEDROOM_DECORATION_CATALOG = {
  bedroomDoubleBed: { source: require("@/assets/3d/decoration/bedroomDoubleBed.png"), displaySize: 88 },
  bedroomDresser: { source: require("@/assets/3d/decoration/bedroomDresser.png"), displaySize: 64 },
  bedroomNightstand: { source: require("@/assets/3d/decoration/bedroomNightstand.png"), displaySize: 40 },
  bedroomWardrobe: { source: require("@/assets/3d/decoration/bedroomWardrobe.png"), displaySize: 80 },
  bedroomFloorLamp: { source: require("@/assets/3d/decoration/bedroomFloorLamp.png"), displaySize: 56 },
} as const satisfies Record<string, ImageEntry>;

export const BEDROOM_DECORATION_IDS = Object.keys(BEDROOM_DECORATION_CATALOG) as (keyof typeof BEDROOM_DECORATION_CATALOG)[];

export const HALLOWEEN_DECORATION_CATALOG = {
  halloweenPumpkin: { source: require("@/assets/3d/decoration/halloweenPumpkin.png"), displaySize: 36 },
  halloweenGhostLantern: { source: require("@/assets/3d/decoration/halloweenGhostLantern.png"), displaySize: 40 },
  halloweenBatGarland: { source: require("@/assets/3d/decoration/halloweenBatGarland.png"), displaySize: 64 },
  halloweenWitchHat: { source: require("@/assets/3d/decoration/halloweenWitchHat.png"), displaySize: 36 },
  halloweenCauldron: { source: require("@/assets/3d/decoration/halloweenCauldron.png"), displaySize: 44 },
} as const satisfies Record<string, ImageEntry>;

export const HALLOWEEN_DECORATION_IDS = Object.keys(HALLOWEEN_DECORATION_CATALOG) as (keyof typeof HALLOWEEN_DECORATION_CATALOG)[];

