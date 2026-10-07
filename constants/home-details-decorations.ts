type ImageEntry = { source: number; displaySize: number };

export const DOOR_DECORATION_CATALOG = {
  doorOakPanel: { source: require("@/assets/3d/decoration/doorOakPanel.png"), displaySize: 80 },
  doorMintGlass: { source: require("@/assets/3d/decoration/doorMintGlass.png"), displaySize: 80 },
  doorBarnSliding: { source: require("@/assets/3d/decoration/doorBarnSliding.png"), displaySize: 80 },
} as const satisfies Record<string, ImageEntry>;

export const DOOR_DECORATION_IDS = Object.keys(DOOR_DECORATION_CATALOG) as (keyof typeof DOOR_DECORATION_CATALOG)[];

export const LAMP_DECORATION_CATALOG = {
  lampFloorArc: { source: require("@/assets/3d/decoration/lampFloorArc.png"), displaySize: 72 },
  lampFloorTripod: { source: require("@/assets/3d/decoration/lampFloorTripod.png"), displaySize: 64 },
  lampFloorPaper: { source: require("@/assets/3d/decoration/lampFloorPaper.png"), displaySize: 64 },
  lampTableMushroom: { source: require("@/assets/3d/decoration/lampTableMushroom.png"), displaySize: 32 },
  lampTableCeramic: { source: require("@/assets/3d/decoration/lampTableCeramic.png"), displaySize: 36 },
  lampTableBanker: { source: require("@/assets/3d/decoration/lampTableBanker.png"), displaySize: 36 },
} as const satisfies Record<string, ImageEntry>;

export const LAMP_DECORATION_IDS = Object.keys(LAMP_DECORATION_CATALOG) as (keyof typeof LAMP_DECORATION_CATALOG)[];

export const CURTAIN_DECORATION_CATALOG = {
  curtainRoseTieback: { source: require("@/assets/3d/decoration/curtainRoseTieback.png"), displaySize: 76 },
  curtainBlueDrape: { source: require("@/assets/3d/decoration/curtainBlueDrape.png"), displaySize: 76 },
  curtainCreamLinen: { source: require("@/assets/3d/decoration/curtainCreamLinen.png"), displaySize: 76 },
} as const satisfies Record<string, ImageEntry>;

export const CURTAIN_DECORATION_IDS = Object.keys(CURTAIN_DECORATION_CATALOG) as (keyof typeof CURTAIN_DECORATION_CATALOG)[];

